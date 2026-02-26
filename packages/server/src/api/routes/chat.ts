import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { AIAnalyzer, ChatMessage, ChatAction } from '../../services/ai-analyzer';
import { query } from '../../db/connection';
import { UserRepository } from '../../db/repositories';
import { AgentConfigRepository } from '../../db/repositories/agent-config.repository';
import { PlanRepository } from '../../db/repositories/plan.repository';
import { getConnectedPluginsStatus, emitToPlugin } from '../../websocket/handlers';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authMiddleware);

interface WorkspaceContext {
  variables: Array<{ name: string; type: string; value: any; collection_name: string | null }>;
  components: Array<{ name: string; type: string; description: string | null }>;
  collections: Array<{ name: string; modes: any }>;
}

async function fetchWorkspaceContext(workspaceId: string): Promise<WorkspaceContext> {
  const [variablesResult, componentsResult, collectionsResult] = await Promise.all([
    query(
      `SELECT v.name, v.type, v.value, vc.name as collection_name
       FROM variables v
       LEFT JOIN variable_collections vc ON vc.figma_id = v.collection_id
       WHERE v.workspace_id = $1
       ORDER BY v.sort_order ASC
       LIMIT 100`,
      [workspaceId]
    ),
    query(
      `SELECT name, type, description
       FROM components
       WHERE workspace_id = $1
       ORDER BY name ASC
       LIMIT 50`,
      [workspaceId]
    ),
    query(
      `SELECT name, modes
       FROM variable_collections
       WHERE workspace_id = $1`,
      [workspaceId]
    )
  ]);

  return {
    variables: variablesResult.rows,
    components: componentsResult.rows,
    collections: collectionsResult.rows
  };
}

function routeToAgent(message: string): 'uiux' | 'design-system' {
  const lowerMsg = message.toLowerCase();

  const dsKeywords = [
    'variable', 'token', 'create component', 'add component',
    'new component', 'component set', 'naming', 'collection',
    'binding', 'property', 'variant', 'color value', 'spacing value',
    'create a button', 'add a button', 'build a', 'create a', 'add a',
    'oluştur', 'yap', 'ekle', 'component', 'bileşen', 'sayfa'
  ];

  const uiuxKeywords = [
    'evaluate', 'suggest', 'best practice', 'review', 'improve',
    'accessible', 'accessibility', 'wcag', 'contrast', 'hierarchy',
    'layout', 'design principle', 'ux', 'user experience', 'feedback',
    'critique', 'audit', 'recommendation', 'pattern', 'guideline'
  ];

  const dsScore = dsKeywords.filter(k => lowerMsg.includes(k)).length;
  const uiuxScore = uiuxKeywords.filter(k => lowerMsg.includes(k)).length;

  return dsScore > uiuxScore ? 'design-system' : 'uiux';
}

function buildContextBlock(context: WorkspaceContext): string {
  const collSummary = context.collections
    .map(c => {
      const modesArr = Array.isArray(c.modes) ? c.modes : [];
      return `  - ${c.name} (${modesArr.length} modes)`;
    })
    .join('\n');

  const varSummary = context.variables.slice(0, 40)
    .map(v => {
      const valStr = v.value ? JSON.stringify(v.value).slice(0, 50) : 'null';
      return `  - ${v.name} (${v.type}): ${valStr}`;
    })
    .join('\n');

  const compSummary = context.components.slice(0, 20)
    .map(c => `  - ${c.name}${c.description ? `: ${c.description}` : ''}`)
    .join('\n');

  return `## Current Design System State

### Variable Collections (${context.collections.length} total)
${collSummary || '  (none synced yet)'}

### Variables (showing up to 40 of ${context.variables.length})
${varSummary || '  (none synced yet)'}

### Components (${context.components.length} total)
${compSummary || '  (none synced yet)'}`;
}

function buildDefaultSystemPrompt(agentType: 'uiux' | 'design-system', context: WorkspaceContext): string {
  const contextBlock = buildContextBlock(context);

  if (agentType === 'uiux') {
    return `You are the UI/UX Agent, a specialist in design systems, user interface design, and user experience best practices.

Your expertise includes:
- Accessibility (WCAG guidelines, color contrast, focus management)
- Design hierarchy and visual consistency
- Typography scales and readability
- Spacing systems and visual rhythm
- Component patterns (cards vs lists, modal vs drawer, etc.)
- Evaluation of existing designs against industry standards

${contextBlock}

When a user asks about creating or modifying components or variables, acknowledge their request and suggest coordinating with the Design System Agent, but still provide your UX perspective first.

Respond conversationally. Be specific and reference the actual design system data above when relevant. Keep responses focused and practical. Respond in the same language the user writes in.`;
  }

  const colorVariables = context.variables.filter(v => v.type === 'COLOR').slice(0, 60);
  const otherVariables = context.variables.filter(v => v.type !== 'COLOR').slice(0, 40);

  const colorVarsBlock = colorVariables.length > 0
    ? colorVariables.map(v => `- "${v.name}"`).join('\n')
    : '(none synced yet — use hex for fills)';

  const otherVarsBlock = otherVariables.length > 0
    ? otherVariables.map(v => `- "${v.name}" (${v.type})`).join('\n')
    : '(none synced yet)';

  return `You are DS Agent — an AI with DIRECT CONTROL over Figma files via the DS Agent plugin bridge. You do not give instructions to users. You execute.

${contextBlock}

---

## LIVE VARIABLE REFERENCE

### COLOR variables (use these for fills):
${colorVarsBlock}

### FLOAT / STRING variables (use for cornerRadius, spacing, font sizes):
${otherVarsBlock}

---

## PLUGIN CAPABILITIES

- **create_component**: Creates a Figma component set with variants, auto layout, fills, and corner radius on a dedicated page.
- **set_variable_value**: Changes the value of an existing variable. Supports COLOR (hex string), FLOAT (number), STRING.
- **rename_variable**: Renames an existing variable by its current name.

---

## EXECUTE BLOCK FORMAT

Every time the user asks to create or modify anything in Figma, output an EXECUTE block. No exceptions.

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": { ... }
}
\`\`\`

After the block, write 1–2 sentences confirming what was done.

---

## EXAMPLE: create_component

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": {
    "pageName": "Button",
    "componentName": "Button",
    "description": "Primary action button with size, type, and state variants",
    "width": 120,
    "height": 40,
    "layoutMode": "HORIZONTAL",
    "padding": { "top": 8, "right": 16, "bottom": 8, "left": 16 },
    "itemSpacing": 8,
    "fills": [{ "hex": "#1A1A1A" }],
    "cornerRadius": 8,
    "variants": [
      { "properties": { "Size": "Large", "Type": "Primary", "State": "Default" } },
      { "properties": { "Size": "Large", "Type": "Primary", "State": "Hover" } },
      { "properties": { "Size": "Large", "Type": "Primary", "State": "Disabled" } },
      { "properties": { "Size": "Large", "Type": "Secondary", "State": "Default" } },
      { "properties": { "Size": "Large", "Type": "Ghost", "State": "Default" } },
      { "properties": { "Size": "Medium", "Type": "Primary", "State": "Default" } },
      { "properties": { "Size": "Small", "Type": "Primary", "State": "Default" } }
    ],
    "properties": [
      { "name": "Size", "type": "VARIANT", "values": ["Large", "Medium", "Small"] },
      { "name": "Type", "type": "VARIANT", "values": ["Primary", "Secondary", "Ghost"] },
      { "name": "State", "type": "VARIANT", "values": ["Default", "Hover", "Pressed", "Disabled"] }
    ]
  }
}
\`\`\`

---

## EXAMPLE: set_variable_value

\`\`\`json
EXECUTE:
{
  "type": "set_variable_value",
  "spec": {
    "variableName": "color/brand/primary",
    "value": "#2563EB"
  }
}
\`\`\`

For FLOAT variables: \`"value": 16\` (number, not string)

---

## EXAMPLE: rename_variable

\`\`\`json
EXECUTE:
{
  "type": "rename_variable",
  "spec": {
    "oldName": "color/primary",
    "newName": "color/brand/primary"
  }
}
\`\`\`

---

## FILLS RULES (CRITICAL)

- Use COLOR variables from the live list above: \`"fills": [{ "variableName": "color/brand/primary" }]\`
- If the variable is NOT in the COLOR list above, use hex: \`"fills": [{ "hex": "#1A1A1A" }]\`
- NEVER use FLOAT or STRING variables for fills — this crashes the plugin
- For transparent/no fill: \`"fills": []\`
- cornerRadius: always a number (e.g. 8) unless a matching FLOAT variable exists

---

## VARIABLE NAMING CONVENTIONS

When creating variable collections:
Colors (COLOR): color/brand/primary, color/brand/secondary, color/neutral/0–900, color/semantic/success, color/semantic/warning, color/semantic/error, color/semantic/info, color/bg/default, color/bg/subtle, color/bg/overlay, color/text/primary, color/text/secondary, color/text/disabled, color/border/default, color/border/strong
Spacing (FLOAT): spacing/1→4, spacing/2→8, spacing/3→12, spacing/4→16, spacing/5→20, spacing/6→24, spacing/8→32, spacing/10→40, spacing/12→48
Radius (FLOAT): radius/none→0, radius/sm→4, radius/md→8, radius/lg→12, radius/xl→16, radius/full→9999
Font size (FLOAT): font-size/xs→12, font-size/sm→14, font-size/md→16, font-size/lg→18, font-size/xl→20, font-size/2xl→24, font-size/3xl→30

---

## COMPONENT BUILD ORDER

1. Foundation — color tokens, spacing, radius, typography
2. Primitives — Button, Input, Checkbox, Radio, Toggle, Badge, Tag
3. Feedback — Alert, Toast, Modal, Tooltip, Skeleton, Progress
4. Navigation — Navbar, Sidebar, Tabs, Breadcrumb, Pagination
5. Data Display — Table, Card, List, Avatar, Stat card, Empty state
6. Forms — Select, Datepicker, FileUpload, Textarea

---

## CONVERSATION RULES

- "create a button" → execute create_component for Button with Size × Type × State variants
- "create color system" → build full color collection per naming conventions
- "what do I have?" / "ne var?" → summarize context
- "rename X to Y" → execute rename_variable
- "change X to #..." → execute set_variable_value
- "build complete design system" → execute in order: color tokens → spacing → radius → Button → Input → Card, confirm after each step
- No plugin connected → "Open your Figma file and activate the DS Agent plugin, then try again."
- NEVER say "you should..." or "you can..." — always "I'll create..." or "Done —"

Respond in the same language the user writes in.`;
}

async function buildSystemPrompt(agentType: 'uiux' | 'design-system', context: WorkspaceContext, workspaceId: string): Promise<string> {
  const contextBlock = buildContextBlock(context);
  const dbConfig = await AgentConfigRepository.findOne(workspaceId, agentType).catch(() => null);

  // If a custom system_prompt is stored, inject all placeholders
  if (dbConfig?.system_prompt) {
    const colorVariables = context.variables.filter(v => v.type === 'COLOR');
    const otherVariables = context.variables.filter(v => v.type !== 'COLOR');

    const colorVarsBlock = colorVariables.length > 0
      ? colorVariables.map(v => `- "${v.name}"`).join('\n')
      : '(none synced yet — use hex for fills)';

    const otherVarsBlock = otherVariables.length > 0
      ? otherVariables.map(v => `- "${v.name}" (${v.type})`).join('\n')
      : '(none synced yet)';

    let prompt = dbConfig.system_prompt
      .replace('{{CONTEXT}}', contextBlock)
      .replace('{{COLOR_VARIABLES}}', colorVarsBlock)
      .replace('{{OTHER_VARIABLES}}', otherVarsBlock);

    if (dbConfig.context_rules) {
      prompt += `\n\n## Additional Rules\n${dbConfig.context_rules}`;
    }
    return prompt;
  }

  // Fall back to default prompt, but append context_rules if set
  const defaultPrompt = buildDefaultSystemPrompt(agentType, context);
  if (dbConfig?.context_rules) {
    return defaultPrompt + `\n\n## Additional Rules\n${dbConfig.context_rules}`;
  }
  return defaultPrompt;
}

function parseReplyForCommands(rawReply: string): { reply: string; command?: any; actions?: ChatAction[] } {
  // Look for EXECUTE: JSON block
  const executeMatch = rawReply.match(/```json\s*\nEXECUTE:\s*\n([\s\S]*?)```/);
  if (executeMatch) {
    try {
      const command = JSON.parse(executeMatch[1].trim());
      // Remove the JSON block from reply text
      const cleanReply = rawReply.replace(/```json\s*\nEXECUTE:\s*\n[\s\S]*?```/, '').trim();
      return { reply: cleanReply, command };
    } catch {
      // JSON parse failed, return as-is
    }
  }

  // Fallback: legacy text-based action detection
  const actions: ChatAction[] = [];
  const createMatch = rawReply.match(/create (?:a |the )?(?:new )?component[:\s]+["']?([A-Za-z/\s]+?)["']?(?:\n|\.|\s*$)/i);
  if (createMatch) {
    actions.push({
      type: 'create_component',
      label: `Create component: ${createMatch[1].trim()}`,
      payload: { componentName: createMatch[1].trim() }
    });
  }

  return { reply: rawReply, actions: actions.length > 0 ? actions : undefined };
}

// POST /api/chat
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { message, history, workspaceId } = req.body as {
      message: string;
      history: ChatMessage[];
      workspaceId: string;
    };

    if (!message || !workspaceId) {
      return res.status(400).json({ error: 'message and workspaceId are required' });
    }

    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, workspaceId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const aiAllowed = await PlanRepository.checkLimit(req.user!.id, 'ai_message');
    if (!aiAllowed) {
      return res.status(403).json({ error: 'plan_limit_exceeded', limit: 'ai_message' });
    }

    const ownerResult = await query(
      `SELECT us.ai_provider, us.anthropic_api_key, us.openai_api_key
       FROM workspace_members wm
       INNER JOIN user_settings us ON us.user_id = wm.user_id
       WHERE wm.workspace_id = $1 AND wm.role = 'owner'
       LIMIT 1`,
      [workspaceId]
    );

    const ownerSettings = ownerResult.rows[0];
    if (!ownerSettings?.anthropic_api_key && !ownerSettings?.openai_api_key) {
      return res.status(400).json({
        error: 'AI not configured for this workspace. Add an API key in Settings.'
      });
    }

    const context = await fetchWorkspaceContext(workspaceId);
    const agentType = routeToAgent(message);
    const systemPrompt = await buildSystemPrompt(agentType, context, workspaceId);

    const fullHistory: ChatMessage[] = [
      ...(history || []),
      { role: 'user', content: message }
    ];

    const analyzer = new AIAnalyzer({
      provider: (ownerSettings.ai_provider as 'anthropic' | 'openai') || 'anthropic',
      anthropicApiKey: ownerSettings.anthropic_api_key,
      openaiApiKey: ownerSettings.openai_api_key
    });

    const aiReply = await analyzer.chat(systemPrompt, fullHistory);
    const { reply, command, actions } = parseReplyForCommands(aiReply);

    // Track AI usage for this user
    PlanRepository.incrementAiUsage(req.user!.id).catch(() => {});

    // If AI produced a command and plugin is connected, execute it
    let commandStatus: 'sent' | 'no_plugin' | undefined;
    if (command) {
      const pluginStatus = getConnectedPluginsStatus();
      if (pluginStatus.count > 0) {
        const commandId = randomUUID();
        emitToPlugin('execute-command', { command, commandId });
        commandStatus = 'sent';
      } else {
        commandStatus = 'no_plugin';
      }
    }

    return res.json({ reply, agentType, actions, command, commandStatus });
  } catch (error: any) {
    console.error('Chat route error:', error);
    return res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
