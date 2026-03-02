import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';

// ── batch_update_nodes Schema ───────────────────────────────────────────────────

const NodeUpdateSpec = z.object({
  nodeId: z.string().describe('Figma node ID to update'),
  updates: z.object({
    fills: z.array(z.object({
      type: z.enum(['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'IMAGE']),
      color: z.string().optional(),
      opacity: z.number().min(0).max(1).optional(),
    })).optional(),
    strokes: z.array(z.object({
      type: z.enum(['SOLID']),
      color: z.string(),
      opacity: z.number().min(0).max(1).optional(),
    })).optional(),
    strokeWeight: z.number().min(0).optional(),
    cornerRadius: z.number().min(0).optional(),
    opacity: z.number().min(0).max(1).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    rotation: z.number().optional(),
    characters: z.string().optional(),
    fontSize: z.number().min(1).optional(),
    fontWeight: z.number().optional(),
    textColor: z.string().optional(),
    name: z.string().optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
  }),
});

export const BatchUpdateNodesInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodes: z.array(NodeUpdateSpec).min(1).max(50).describe(
    'Array of node update specs (max 50 nodes per batch)'
  ),
}).describe('Update multiple nodes in a single batch operation');

type Input = z.infer<typeof BatchUpdateNodesInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse {
  status: string;
  commandId: string;
  message?: string;
  results?: Array<{ nodeId: string; success: boolean; message?: string }>;
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

export async function batchUpdateNodes(input: Input): Promise<string> {
  const { workspaceId, nodes } = input;

  const command = {
    type: 'batch_update_nodes',
    params: { nodes },
  };

  const result = await apiPost<ExecuteResponse>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  if (result.commandStatus === 'no_plugin') {
    return JSON.stringify({
      status: 'no_plugin',
      nodeCount: nodes.length,
      message: '⚠️ No Figma plugin connected — open the Tokenhaus plugin in Figma first',
    }, null, 2);
  }

  // Poll until plugin confirms completion
  const poll = await pollResult(result.commandId);

  if (poll.status === 'success' && poll.results) {
    const successCount = poll.results.filter(r => r.success).length;
    const failureCount = poll.results.filter(r => !r.success).length;

    return JSON.stringify({
      status: 'success',
      nodeCount: nodes.length,
      successCount,
      failureCount,
      results: poll.results,
      message: `✅ Batch update completed: ${successCount} succeeded, ${failureCount} failed`,
    }, null, 2);
  }

  if (poll.status === 'timeout') {
    return JSON.stringify({
      status: 'timeout',
      nodeCount: nodes.length,
      message: '⏱ Batch update timed out — operation may be too large',
    }, null, 2);
  }

  return JSON.stringify({
    status: 'error',
    nodeCount: nodes.length,
    message: `❌ Batch update failed: ${poll.message ?? 'unknown error'}`,
  }, null, 2);
}
