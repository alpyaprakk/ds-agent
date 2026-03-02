import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';

// ── generate_code Schema ───────────────────────────────────────────────────────

export const GenerateCodeInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe(
    'Figma node ID to generate code from (e.g. "123:456"). Can be a frame, component, or any design node.'
  ),
  framework: z.enum(['react', 'vue', 'svelte', 'html']).describe('Target framework for code generation'),
  styling: z.enum(['tailwind', 'css-modules', 'styled-components', 'css']).describe('Styling approach'),
  useTokens: z.boolean().default(true).optional().describe(
    'Map colors and spacing to design tokens (recommended: true)'
  ),
  includeTypes: z.boolean().default(true).optional().describe(
    'Generate TypeScript types for React/Vue/Svelte (ignored for HTML)'
  ),
  componentName: z.string().optional().describe(
    'Custom component name (default: auto-generated from node name)'
  ),
});

type Input = z.infer<typeof GenerateCodeInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse {
  status: string;
  commandId: string;
  message?: string;
  code?: string;
  assets?: Record<string, string>;
  tokens?: string[];
}

/** Poll for a command result, waiting up to maxWaitMs (default 60s). */
async function pollResult(commandId: string, maxWaitMs = 60_000): Promise<PollResponse> {
  const interval = 2_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval));
    const res = await apiGet<PollResponse>(`/api/commands/${commandId}/result`);
    if (res.status !== 'pending') return res;
  }

  return { status: 'timeout', commandId, message: 'Plugin did not respond within 60s' };
}

export async function generateCode(input: Input): Promise<string> {
  const { workspaceId, ...params } = input;

  const command = {
    type: 'generate_code',
    params: {
      nodeId: params.nodeId,
      framework: params.framework,
      styling: params.styling,
      useTokens: params.useTokens ?? true,
      includeTypes: params.includeTypes ?? true,
      componentName: params.componentName,
    },
  };

  const result = await apiPost<ExecuteResponse>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  if (result.commandStatus === 'no_plugin') {
    return JSON.stringify({
      status: 'no_plugin',
      nodeId: params.nodeId,
      message: '⚠️ No Figma plugin connected — open the Tokenhaus plugin in Figma first',
    }, null, 2);
  }

  // Poll until plugin confirms completion
  const poll = await pollResult(result.commandId);

  if (poll.status === 'success' && poll.code) {
    return JSON.stringify({
      status: 'success',
      nodeId: params.nodeId,
      framework: params.framework,
      styling: params.styling,
      code: poll.code,
      assets: poll.assets ?? {},
      tokensUsed: poll.tokens ?? [],
      message: `✅ Code generated successfully (${params.framework} + ${params.styling})`,
    }, null, 2);
  }

  if (poll.status === 'timeout') {
    return JSON.stringify({
      status: 'timeout',
      nodeId: params.nodeId,
      message: '⏱ Code generation timed out — check Figma plugin or try simpler node',
    }, null, 2);
  }

  return JSON.stringify({
    status: 'error',
    nodeId: params.nodeId,
    message: `❌ Code generation failed: ${poll.message ?? 'unknown error'}`,
  }, null, 2);
}
