import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';
import { ListPagesInputSchema } from '../types.js';

type Input = z.infer<typeof ListPagesInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse    { status: string; commandId: string; message?: string; data?: any; }

async function pollResult(commandId: string, maxWaitMs = 30_000): Promise<PollResponse> {
  const interval = 2_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval));
    const res = await apiGet<PollResponse>(`/api/commands/${commandId}/result`);
    if (res.status !== 'pending') return res;
  }

  return { status: 'timeout', commandId, message: 'Plugin did not respond within 30s' };
}

export async function listPages(input: Input): Promise<string> {
  const { workspaceId } = input;

  const command = { type: 'list_pages', spec: {} };

  const result = await apiPost<ExecuteResponse>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  if (result.commandStatus === 'no_plugin') {
    return JSON.stringify({
      status: 'no_plugin',
      message: '⚠️ No Figma plugin connected — open the Tokenhaus plugin in Figma first',
    }, null, 2);
  }

  const poll = await pollResult(result.commandId);

  if (poll.status === 'success') {
    return JSON.stringify({
      status: 'success',
      pages: poll.data?.pages ?? [],
      message: `✅ ${poll.data?.pages?.length ?? 0} page(s) found`,
    }, null, 2);
  }

  return JSON.stringify({
    status: poll.status,
    message: poll.status === 'timeout'
      ? '⏱ Plugin did not respond — check Figma'
      : `❌ ${poll.message ?? 'unknown error'}`,
  }, null, 2);
}
