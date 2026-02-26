import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';
import { CreateComponentInputSchema } from '../types.js';

type Input = z.infer<typeof CreateComponentInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse    { status: string; commandId: string; message?: string; }

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

export async function createComponent(input: Input): Promise<string> {
  const { workspaceId, ...spec } = input;

  const command = { type: 'create_component', spec };

  const result = await apiPost<ExecuteResponse>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  if (result.commandStatus === 'no_plugin') {
    return JSON.stringify({
      status: 'no_plugin',
      component: spec.componentName,
      message: '⚠️ No Figma plugin connected — open the Tokenhaus plugin in Figma first',
    }, null, 2);
  }

  // Poll until plugin confirms completion
  const poll = await pollResult(result.commandId);

  return JSON.stringify({
    status: poll.status,
    component: spec.componentName,
    page: spec.pageName,
    variantCount: spec.variants?.length ?? 0,
    commandId: result.commandId,
    message: poll.status === 'success'
      ? `✅ "${spec.componentName}" created in Figma (${spec.variants?.length ?? 0} variants on page "${spec.pageName}")`
      : poll.status === 'timeout'
        ? '⏱ Command sent but plugin response timed out — check Figma'
        : `❌ Plugin error: ${poll.message ?? 'unknown'}`,
  }, null, 2);
}
