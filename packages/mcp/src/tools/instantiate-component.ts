import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';

// ── instantiate_component Schema ────────────────────────────────────────────────

export const InstantiateComponentInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  componentKey: z.string().describe(
    'Component key or component name to instantiate. Can be a Figma component key or the exact component name.'
  ),
  variant: z.record(z.string(), z.string()).optional().describe(
    'Variant properties to select specific variant. E.g. { "Type": "Primary", "Size": "Large", "State": "Default" }'
  ),
  position: z.object({
    x: z.number().describe('X coordinate in pixels'),
    y: z.number().describe('Y coordinate in pixels'),
  }).optional().describe('Position where the instance should be placed'),
  size: z.object({
    width: z.number().describe('Width in pixels'),
    height: z.number().describe('Height in pixels'),
  }).optional().describe('Custom size for the instance (overrides component default)'),
  parentId: z.string().optional().describe(
    'Parent node ID to append the instance to. If not provided, adds to current page.'
  ),
  overrides: z.record(z.string(), z.any()).optional().describe(
    'Property overrides for the instance. E.g. text content, visibility, etc.'
  ),
});

type Input = z.infer<typeof InstantiateComponentInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse {
  status: string;
  commandId: string;
  message?: string;
  nodeId?: string;
  instanceName?: string;
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

export async function instantiateComponent(input: Input): Promise<string> {
  const { workspaceId, ...params } = input;

  const command = {
    type: 'instantiate_component',
    params: {
      componentKey: params.componentKey,
      variant: params.variant,
      position: params.position,
      size: params.size,
      parentId: params.parentId,
      overrides: params.overrides,
    },
  };

  const result = await apiPost<ExecuteResponse>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  if (result.commandStatus === 'no_plugin') {
    return JSON.stringify({
      status: 'no_plugin',
      componentKey: params.componentKey,
      message: '⚠️ No Figma plugin connected — open the Tokenhaus plugin in Figma first',
    }, null, 2);
  }

  // Poll until plugin confirms completion
  const poll = await pollResult(result.commandId);

  if (poll.status === 'success' && poll.nodeId) {
    return JSON.stringify({
      status: 'success',
      componentKey: params.componentKey,
      nodeId: poll.nodeId,
      instanceName: poll.instanceName || 'Instance',
      variant: params.variant,
      message: `✅ Component instance created: ${poll.instanceName || params.componentKey}`,
    }, null, 2);
  }

  if (poll.status === 'timeout') {
    return JSON.stringify({
      status: 'timeout',
      componentKey: params.componentKey,
      message: '⏱ Component instantiation timed out — check Figma plugin',
    }, null, 2);
  }

  return JSON.stringify({
    status: 'error',
    componentKey: params.componentKey,
    message: `❌ Component instantiation failed: ${poll.message ?? 'unknown error'}`,
  }, null, 2);
}
