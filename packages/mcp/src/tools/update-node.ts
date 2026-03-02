import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';

// ── update_node Schema ──────────────────────────────────────────────────────

export const UpdateNodeInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe('Figma node ID to update (e.g. "123:456")'),
  updates: z.object({
    // Visual properties
    fills: z.array(z.object({
      type: z.enum(['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'IMAGE']),
      color: z.string().optional().describe('Hex color for SOLID fills'),
      opacity: z.number().min(0).max(1).optional(),
    })).optional().describe('Fill paints - hex colors or token names'),

    strokes: z.array(z.object({
      type: z.enum(['SOLID']),
      color: z.string().describe('Hex color or token name'),
      opacity: z.number().min(0).max(1).optional(),
    })).optional().describe('Stroke paints'),

    strokeWeight: z.number().min(0).optional().describe('Stroke thickness in pixels'),
    cornerRadius: z.number().min(0).optional().describe('Corner radius in pixels'),
    opacity: z.number().min(0).max(1).optional().describe('Node opacity (0-1)'),

    // Layout properties
    x: z.number().optional().describe('X position in pixels'),
    y: z.number().optional().describe('Y position in pixels'),
    width: z.number().min(0).optional().describe('Width in pixels'),
    height: z.number().min(0).optional().describe('Height in pixels'),
    rotation: z.number().optional().describe('Rotation in degrees'),

    // Text properties (for text nodes only)
    characters: z.string().optional().describe('Text content'),
    fontSize: z.number().min(1).optional().describe('Font size in pixels'),
    fontWeight: z.number().optional().describe('Font weight (400, 500, 600, 700)'),
    textColor: z.string().optional().describe('Text color - hex or token name'),

    // Other
    name: z.string().optional().describe('Node name'),
    visible: z.boolean().optional().describe('Visibility'),
    locked: z.boolean().optional().describe('Lock state'),
  }).describe('Properties to update - only specified properties will be changed'),
}).describe('Update visual, layout, and text properties of any Figma node');

type Input = z.infer<typeof UpdateNodeInputSchema>;

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

export async function updateNode(input: Input): Promise<string> {
  const { workspaceId, ...params } = input;

  const command = {
    type: 'update_node',
    params: {
      nodeId: params.nodeId,
      updates: params.updates,
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

  if (poll.status === 'success') {
    const updateCount = Object.keys(params.updates).length;
    return JSON.stringify({
      status: 'success',
      nodeId: params.nodeId,
      updates: params.updates,
      message: `✅ Node updated: ${updateCount} propert${updateCount === 1 ? 'y' : 'ies'} changed`,
    }, null, 2);
  }

  if (poll.status === 'timeout') {
    return JSON.stringify({
      status: 'timeout',
      nodeId: params.nodeId,
      message: '⏱ Node update timed out — node may not exist or plugin unresponsive',
    }, null, 2);
  }

  return JSON.stringify({
    status: 'error',
    nodeId: params.nodeId,
    message: `❌ Node update failed: ${poll.message ?? 'unknown error'}`,
  }, null, 2);
}
