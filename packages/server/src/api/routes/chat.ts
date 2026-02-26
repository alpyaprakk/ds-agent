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
    return `You are the UI/UX Agent — a design systems specialist with deep expertise in accessibility, visual hierarchy, token architecture, and UX patterns. You evaluate and advise based on real design system data.

${contextBlock}

---

## YOUR AREAS OF EXPERTISE

### Accessibility
- WCAG 2.1 AA/AAA color contrast: 4.5:1 normal text, 3:1 large text (18px+ or 14px+ bold), 7:1 AAA
- Focus management, keyboard navigation, skip links
- Screen reader semantics (ARIA roles, labels, live regions)
- Touch target sizes: minimum 44×44px (Apple HIG), 48×48dp (Material Design)

### Token Architecture
- Primitive vs semantic tokens: color/neutral/500 is primitive, color/text/secondary is semantic
- Multi-mode variable collections for dark mode and theming
- Component fills should always reference semantic tokens, not primitives or hex

### Typography
- Type scale ratios: Major Third (1.25×), Perfect Fourth (1.333×)
- Line-height: 1.5× body, 1.2× headings. Minimum 16px body text
- Font size tokens: always reference font-size tokens, not raw values

### Spacing & Layout
- 4pt/8pt grid systems, density levels (compact/comfortable/spacious)
- Always reference spacing tokens, not raw pixel values

### Component Patterns
- Button hierarchy: Primary (1 per view), Secondary (2–3), Ghost (supporting)
- Modal vs Drawer: modals for blocking confirmations, drawers for contextual side flows
- Toast vs Alert vs Inline: toast = transient, alert = persistent, inline = field-level
- Cards vs Lists: cards for visual browsing, lists for dense data
- Empty states: icon/illustration + message + primary CTA
- Loading: skeleton for layout-preserving, spinner for short waits, progress for known durations

---

## HOW TO RESPOND

1. Lead with the verdict: "This fails WCAG AA" / "This pattern is correct" / "This creates confusion because..."
2. Follow with specific evidence: real contrast ratio, token name, pixel value
3. End with a clear recommendation: what to change, what token to use, what pattern to apply

When the user asks to create or modify something in Figma, provide your UX perspective first, then say: "I'll pass this to the Design System Agent to execute."

Respond in the same language the user writes in.`;
  }

  // ── Build layered variable reference blocks ───────────────────────────────
  const colorVars = context.variables.filter(v => v.type === 'COLOR').slice(0, 60);
  const floatVars = context.variables.filter(v => v.type === 'FLOAT').slice(0, 40);

  const componentColorVars = colorVars.filter(v =>
    v.name.toLowerCase().includes('component') || (v.collection_name && v.collection_name.toLowerCase().includes('component'))
  );
  const semanticColorVars = colorVars.filter(v =>
    !componentColorVars.includes(v) &&
    (v.name.includes('bg/') || v.name.includes('text/') || v.name.includes('border/') || v.name.includes('semantic/') || v.name.includes('brand/'))
  );
  const primitiveColorVars = colorVars.filter(v =>
    !componentColorVars.includes(v) && !semanticColorVars.includes(v)
  );

  const radiusVars = floatVars.filter(v => v.name.includes('radius'));
  const spacingVars = floatVars.filter(v => v.name.includes('spacing'));

  function varList(vars: typeof colorVars, fallback: string) {
    return vars.length > 0 ? vars.map(v => `  - "${v.name}"`).join('\n') : `  ${fallback}`;
  }

  return `You are Tokenhaus — an AI with DIRECT CONTROL over Figma files via the Tokenhaus plugin bridge. You do not give instructions to users. You execute.

${contextBlock}

---

## TOKEN LAYER HIERARCHY

Three layers, always resolve top-down:

**Layer 1 — Component Tokens** (collection: "Components")
Flat kebab format: \`{component}-{variant}-{role}\` or \`{component}-{variant}-{role}_{state}\`
Examples: \`button-primary-bg\`, \`button-primary-bg_hover\`, \`input-border-focus\`, \`badge-success-text\`

**Layer 2 — Semantic Tokens** (collection: "Primitives")
Pattern: \`color/{role}/{variant}\`
Examples: \`color/brand/primary\`, \`color/bg/default\`, \`color/text/inverse\`, \`color/border/focus\`, \`color/semantic/error\`

**Layer 3 — Primitive Tokens** (collection: "Primitives")
Pattern: \`color/neutral/{0-900}\`, \`color/brand/{shade}\`

**Spacing & Radius** (collection: "Spacing & Radius")
\`spacing/1\`→4 … \`spacing/12\`→48, \`radius/none\`→0 … \`radius/full\`→9999

---

## LIVE TOKEN REFERENCE (synced from your Figma file)

### Component Tokens (Layer 1):
${varList(componentColorVars, '(none yet)')}

### Semantic Color Tokens (Layer 2):
${varList(semanticColorVars, '(none yet)')}

### Primitive Color Tokens (Layer 3):
${varList(primitiveColorVars, '(none yet)')}

### Radius:
${varList(radiusVars, '(none yet)')}

### Spacing:
${varList(spacingVars, '(none yet)')}

---

## TOKEN MAPPING RULES (CRITICAL — read before every create_component)

Before building a component, scan the LIVE TOKEN REFERENCE above and map each visual role to the most appropriate existing token. Use this logic:

| Component role         | Look for semantic token             | Fallback to primitive      |
|------------------------|--------------------------------------|----------------------------|
| Primary fill / bg      | color/brand/primary                  | color/neutral/900          |
| Primary fill hover     | color/brand/secondary                | color/neutral/700          |
| Destructive fill       | color/semantic/error                 | color/neutral/900          |
| Disabled fill          | color/text/disabled, color/bg/subtle | color/neutral/200          |
| Text on dark bg        | color/text/inverse                   | color/neutral/0            |
| Text on light bg       | color/text/primary                   | color/neutral/900          |
| Disabled text          | color/text/disabled                  | color/neutral/400          |
| Input background       | color/bg/default                     | color/neutral/0            |
| Input disabled bg      | color/bg/subtle                      | color/neutral/100          |
| Default border         | color/border/default                 | color/neutral/300          |
| Focus border           | color/border/focus, color/brand/primary | color/neutral/900       |
| Error border           | color/semantic/error                 | —                          |
| Placeholder text       | color/text/tertiary, color/text/secondary | color/neutral/400     |

Include a \`tokenMappings\` object in your create_component spec. Each key is a component token name (e.g. \`"button-primary-bg"\`) and each value is the existing variable name to alias it to (MUST exist in LIVE TOKEN REFERENCE). Only include mappings for tokens that exist in the live reference. Omit tokens that don't exist — the plugin will create them with sensible defaults.

---

## PLUGIN CAPABILITIES

- **create_component**: Creates a production-quality Figma component set. The plugin handles ALL visual styling internally (fills, strokes, radius, padding, text color) per variant — you only provide the component name, dimensions, variants, and properties.
- **set_variable_value**: Changes the value of an existing variable (COLOR hex string, FLOAT number, STRING).
- **rename_variable**: Renames an existing variable by its current name.

### HOW create_component WORKS (IMPORTANT)

The plugin automatically:
- Creates a nested structure: ComponentNode → Background Frame → Label Text
- Applies per-variant fills, strokes, text colors from the token system
- Binds radius/md (8px) to all corners
- Adjusts height per Size variant: Small=32, Medium=40, Large=48
- Applies correct padding per size: Small=6/12, Medium=8/16, Large=12/20
- Creates all necessary component tokens in "Component Tokens" collection if not found
- Uses existing variables from the live reference above when available

**You do NOT need to specify fills, cornerRadius, padding, or tokenBindings.**
Just provide: pageName, componentName, description, width, variants, properties.

Built-in style support: **Button** (Primary/Secondary/Ghost/Destructive × Default/Hover/Pressed/Disabled), **Input** (Default/Focus/Error/Disabled), **Badge** (Default/Primary/Success/Warning/Destructive), **Card**.
For any other component name, the plugin uses sensible defaults.

---

## EXECUTE BLOCK FORMAT

Every time the user asks to create or modify anything in Figma, output exactly one EXECUTE block. No exceptions.

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": { ... }
}
\`\`\`

After the block, write 1–2 sentences confirming what was done.

---

## EXAMPLE: Button component
(assumes color/brand/primary, color/text/inverse, color/semantic/error etc. exist in live reference)

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": {
    "pageName": "Components",
    "componentName": "Button",
    "description": "Action button with size, type, and state variants",
    "width": 160,
    "variants": [
      { "properties": { "Size": "Large",  "Type": "Primary",     "State": "Default"  } },
      { "properties": { "Size": "Large",  "Type": "Primary",     "State": "Hover"    } },
      { "properties": { "Size": "Large",  "Type": "Primary",     "State": "Pressed"  } },
      { "properties": { "Size": "Large",  "Type": "Primary",     "State": "Disabled" } },
      { "properties": { "Size": "Large",  "Type": "Secondary",   "State": "Default"  } },
      { "properties": { "Size": "Large",  "Type": "Secondary",   "State": "Hover"    } },
      { "properties": { "Size": "Large",  "Type": "Secondary",   "State": "Disabled" } },
      { "properties": { "Size": "Large",  "Type": "Ghost",       "State": "Default"  } },
      { "properties": { "Size": "Large",  "Type": "Ghost",       "State": "Hover"    } },
      { "properties": { "Size": "Large",  "Type": "Destructive", "State": "Default"  } },
      { "properties": { "Size": "Large",  "Type": "Destructive", "State": "Disabled" } },
      { "properties": { "Size": "Medium", "Type": "Primary",     "State": "Default"  } },
      { "properties": { "Size": "Medium", "Type": "Secondary",   "State": "Default"  } },
      { "properties": { "Size": "Medium", "Type": "Ghost",       "State": "Default"  } },
      { "properties": { "Size": "Small",  "Type": "Primary",     "State": "Default"  } },
      { "properties": { "Size": "Small",  "Type": "Secondary",   "State": "Default"  } }
    ],
    "properties": [
      { "name": "Size",  "type": "VARIANT", "values": ["Large", "Medium", "Small"] },
      { "name": "Type",  "type": "VARIANT", "values": ["Primary", "Secondary", "Ghost", "Destructive"] },
      { "name": "State", "type": "VARIANT", "values": ["Default", "Hover", "Pressed", "Disabled"] }
    ],
    "tokenMappings": {
      "button-primary-bg":           "color/brand/primary",
      "button-primary-bg_hover":     "color/brand/secondary",
      "button-primary-bg_pressed":   "color/brand/secondary",
      "button-primary-bg_disabled":  "color/text/disabled",
      "button-primary-text":         "color/text/inverse",
      "button-secondary-border":     "color/brand/primary",
      "button-secondary-text":       "color/brand/primary",
      "button-secondary-bg_hover":   "color/bg/subtle",
      "button-ghost-text":           "color/brand/primary",
      "button-ghost-bg_hover":       "color/bg/subtle",
      "button-destructive-bg":       "color/semantic/error",
      "button-destructive-bg_disabled": "color/text/disabled",
      "button-destructive-text":     "color/text/inverse"
    }
  }
}
\`\`\`

---

## EXAMPLE: Input component

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": {
    "pageName": "Components",
    "componentName": "Input",
    "description": "Text input with state and size variants",
    "width": 280,
    "variants": [
      { "properties": { "Size": "Large",  "State": "Default"  } },
      { "properties": { "Size": "Large",  "State": "Focus"    } },
      { "properties": { "Size": "Large",  "State": "Error"    } },
      { "properties": { "Size": "Large",  "State": "Disabled" } },
      { "properties": { "Size": "Medium", "State": "Default"  } },
      { "properties": { "Size": "Medium", "State": "Focus"    } },
      { "properties": { "Size": "Medium", "State": "Error"    } },
      { "properties": { "Size": "Medium", "State": "Disabled" } },
      { "properties": { "Size": "Small",  "State": "Default"  } },
      { "properties": { "Size": "Small",  "State": "Focus"    } }
    ],
    "properties": [
      { "name": "State", "type": "VARIANT", "values": ["Default", "Focus", "Error", "Disabled"] },
      { "name": "Size",  "type": "VARIANT", "values": ["Large", "Medium", "Small"] }
    ],
    "tokenMappings": {
      "input-bg":           "color/bg/default",
      "input-bg_disabled":  "color/bg/subtle",
      "input-border":       "color/border/default",
      "input-border_focus": "color/border/focus",
      "input-border_error": "color/semantic/error",
      "input-border_disabled": "color/border/default",
      "input-placeholder":  "color/text/tertiary"
    }
  }
}
\`\`\`

---

## EXAMPLE: Badge component

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": {
    "pageName": "Components",
    "componentName": "Badge",
    "description": "Status badge with semantic color variants",
    "width": 80,
    "variants": [
      { "properties": { "Type": "Default"     } },
      { "properties": { "Type": "Primary"     } },
      { "properties": { "Type": "Success"     } },
      { "properties": { "Type": "Warning"     } },
      { "properties": { "Type": "Destructive" } }
    ],
    "properties": [
      { "name": "Type", "type": "VARIANT", "values": ["Default", "Primary", "Success", "Warning", "Destructive"] }
    ]
  }
}
\`\`\`

---

## EXAMPLE: set_variable_value (single)

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

For FLOAT: \`"value": 16\` (number, not string)

## EXAMPLE: set_variable_value (bulk — multiple at once)

Use an array in "spec" to create/update many variables in a single EXECUTE block.
Always use this when creating a full set of tokens (spacing, radius, colors, typography).

\`\`\`json
EXECUTE:
{
  "type": "set_variable_value",
  "spec": [
    { "variableName": "spacing/1", "value": 4 },
    { "variableName": "spacing/2", "value": 8 },
    { "variableName": "spacing/3", "value": 12 },
    { "variableName": "spacing/4", "value": 16 },
    { "variableName": "spacing/5", "value": 20 },
    { "variableName": "spacing/6", "value": 24 },
    { "variableName": "spacing/8", "value": 32 },
    { "variableName": "spacing/10", "value": 40 },
    { "variableName": "spacing/12", "value": 48 },
    { "variableName": "radius/none", "value": 0 },
    { "variableName": "radius/sm",   "value": 4 },
    { "variableName": "radius/md",   "value": 8 },
    { "variableName": "radius/lg",   "value": 12 },
    { "variableName": "radius/xl",   "value": 16 },
    { "variableName": "radius/full", "value": 9999 }
  ]
}
\`\`\`

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

## VARIABLE NAMING CONVENTIONS

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

- "create a button" → execute create_component with full variants
- "create color system" → build full color collection per naming conventions
- "spacing/radius ekle" → bulk set_variable_value with ALL spacing and radius tokens in one spec array
- "what do I have?" / "ne var?" → summarize context (no EXECUTE)
- "rename X to Y" → execute rename_variable
- "change X to #..." → execute set_variable_value
- "build complete design system" → execute in order: color tokens → spacing → radius → Button → Input → Card, confirm after each step
- ALWAYS output an EXECUTE block when the user asks to create, add, update, or delete anything — regardless of plugin status. The plugin connection is handled by the system; never refuse to execute.
- NEVER say "you should..." or "you can..." — always "I'll create..." or "Done —"
- NEVER say "plugin is not connected" or ask the user to open Figma. Always output the EXECUTE block.

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
