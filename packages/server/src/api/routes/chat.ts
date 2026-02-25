import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { AIAnalyzer, ChatMessage, ChatAction } from '../../services/ai-analyzer';
import { query } from '../../db/connection';
import { UserRepository } from '../../db/repositories';
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

function buildSystemPrompt(agentType: 'uiux' | 'design-system', context: WorkspaceContext): string {
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

  return `You are the Design System Agent. You have DIRECT CONTROL over the Figma file through the plugin bridge. When asked to create or modify anything, you DO IT — you don't give instructions to the user.

${contextBlock}

## Your Capabilities (via plugin)
You can execute these commands directly in Figma:
- **create_component**: Create a component with variants on a dedicated page
- **rename_variable**: Rename a variable
- **set_variable_value**: Change a variable's value

## How to Execute
When the user asks you to create/modify something, respond with:
1. A brief confirmation of what you're about to do
2. A JSON command block (will be auto-executed):

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": {
    "pageName": "Button",
    "componentName": "Button",
    "description": "Primary action button",
    "width": 120,
    "height": 40,
    "layoutMode": "HORIZONTAL",
    "padding": { "top": 8, "right": 16, "bottom": 8, "left": 16 },
    "itemSpacing": 8,
    "fills": [{ "variableName": "Colors/Base/white" }],
    "cornerRadius": "radius-xs",
    "variants": [
      { "properties": { "Type": "Primary", "State": "Default" } },
      { "properties": { "Type": "Primary", "State": "Hover" } },
      { "properties": { "Type": "Secondary", "State": "Default" } },
      { "properties": { "Type": "Secondary", "State": "Hover" } }
    ],
    "properties": [
      { "name": "Type", "type": "VARIANT", "values": ["Primary", "Secondary"] },
      { "name": "State", "type": "VARIANT", "values": ["Default", "Hover"] }
    ]
  }
}
\`\`\`

## Rules
- Always use existing variable names from the context above for fills, cornerRadius etc.
- Page name = component name (one component per page)
- Always add relevant variants (Type, State, Size etc.)
- After executing, briefly explain what was created

## Variable names available
${context.variables.slice(0, 20).map(v => `- ${v.name} (${v.type})`).join('\n') || '(none synced yet)'}

Respond in the same language the user writes in. Be concise — act, don't lecture.`;
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
    const systemPrompt = buildSystemPrompt(agentType, context);

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
