import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { AIAnalyzer, ChatMessage, ChatAction } from '../../services/ai-analyzer';
import { query } from '../../db/connection';
import { UserRepository } from '../../db/repositories';

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
    'create a button', 'add a button', 'build a', 'create a', 'add a'
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

  return `You are the Design System Agent, a specialist in Figma design systems, design tokens, and component architecture.

Your expertise includes:
- Variable/token naming conventions and structure (primitive → semantic → component hierarchy)
- Component creation with proper variable bindings
- Collection organization and mode management (light/dark, mobile/desktop)
- Design token best practices for scalable systems
- Figma component variants and properties

${contextBlock}

When asked to create a component, analyze the existing variables above and describe:
1. What existing variables you would bind to the component
2. Any missing variables that need to be created first
3. The component structure, variants, and properties

If the user asks conceptual UI/UX questions, acknowledge them and suggest the UI/UX Agent would be better suited, but still answer from a technical perspective.

Respond conversationally. Reference actual variable names and component names from the context above. Be specific and actionable. Respond in the same language the user writes in.`;
}

function parseReplyForActions(rawReply: string, agentType: 'uiux' | 'design-system'): { reply: string; actions?: ChatAction[] } {
  const actions: ChatAction[] = [];

  if (agentType === 'design-system') {
    const createMatch = rawReply.match(/create (?:a |the )?(?:new )?component[:\s]+["']?([A-Za-z/\s]+?)["']?(?:\n|\.|\s*$)/i);
    if (createMatch) {
      actions.push({
        type: 'create_component',
        label: `Create component: ${createMatch[1].trim()}`,
        payload: { componentName: createMatch[1].trim() }
      });
    }
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

    // Access check
    const isMember = await UserRepository.isWorkspaceMember(req.user!.id, workspaceId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get workspace owner's AI keys (same pattern as analyzeDesignSystemAsync in handlers.ts)
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

    // Fetch workspace design system context for prompt injection
    const context = await fetchWorkspaceContext(workspaceId);

    // Route to agent
    const agentType = routeToAgent(message);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(agentType, context);

    // Build full history including new user message
    const fullHistory: ChatMessage[] = [
      ...(history || []),
      { role: 'user', content: message }
    ];

    // Call AI
    const analyzer = new AIAnalyzer({
      provider: (ownerSettings.ai_provider as 'anthropic' | 'openai') || 'anthropic',
      anthropicApiKey: ownerSettings.anthropic_api_key,
      openaiApiKey: ownerSettings.openai_api_key
    });

    const aiReply = await analyzer.chat(systemPrompt, fullHistory);

    // Parse for optional action buttons
    const { reply, actions } = parseReplyForActions(aiReply, agentType);

    return res.json({ reply, agentType, actions });
  } catch (error: any) {
    console.error('Chat route error:', error);
    return res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
