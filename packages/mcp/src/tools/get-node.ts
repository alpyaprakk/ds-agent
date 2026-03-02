import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';

// ── get_node Schema ─────────────────────────────────────────────────────────

export const GetNodeInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe(
    'Figma node ID to read (e.g. "123:456"). Can be any node: frame, component, text, shape, etc.'
  ),
  includeChildren: z.boolean().default(false).optional().describe(
    'Include immediate children in the response (default: false)'
  ),
  depth: z.number().min(1).max(3).default(1).optional().describe(
    'How many levels deep to traverse children (1-3, default: 1). Security: Limited to 3 to prevent memory exhaustion.'
  ),
});

type Input = z.infer<typeof GetNodeInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse {
  status: string;
  commandId: string;
  message?: string;
  nodeData?: any;
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

export async function getNode(input: Input): Promise<string> {
  const { workspaceId, ...params } = input;

  const command = {
    type: 'get_node',
    params: {
      nodeId: params.nodeId,
      includeChildren: params.includeChildren ?? false,
      depth: params.depth ?? 1,
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

  if (poll.status === 'success' && poll.nodeData) {
    return JSON.stringify({
      status: 'success',
      nodeId: params.nodeId,
      nodeData: poll.nodeData,
      message: `✅ Node data retrieved: ${poll.nodeData.type} "${poll.nodeData.name}"`,
    }, null, 2);
  }

  if (poll.status === 'timeout') {
    return JSON.stringify({
      status: 'timeout',
      nodeId: params.nodeId,
      message: '⏱ Node read timed out — node may be too complex or plugin unresponsive',
    }, null, 2);
  }

  return JSON.stringify({
    status: 'error',
    nodeId: params.nodeId,
    message: `❌ Node read failed: ${poll.message ?? 'unknown error'}`,
  }, null, 2);
}
