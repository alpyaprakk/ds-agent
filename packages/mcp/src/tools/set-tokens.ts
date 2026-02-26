import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';
import { SetTokensInputSchema } from '../types.js';

type Input = z.infer<typeof SetTokensInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse    { status: string; commandId: string; message?: string; }

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

export async function setTokens(input: Input): Promise<string> {
  const { workspaceId, tokens } = input;

  const command = {
    type: 'set_variable_value',
    spec: tokens.map(t => ({
      variableName: t.variableName,
      value: t.value,
      ...(t.type ? { type: t.type } : {}),
    })),
  };

  const result = await apiPost<ExecuteResponse>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  if (result.commandStatus === 'no_plugin') {
    return JSON.stringify({
      status: 'no_plugin',
      tokenCount: tokens.length,
      message: '⚠️ No Figma plugin connected — open the Tokenhaus plugin in Figma first',
    }, null, 2);
  }

  const poll = await pollResult(result.commandId);

  return JSON.stringify({
    status: poll.status,
    tokenCount: tokens.length,
    commandId: result.commandId,
    message: poll.status === 'success'
      ? `✅ ${tokens.length} token${tokens.length !== 1 ? 's' : ''} set in Figma`
      : poll.status === 'timeout'
        ? '⏱ Tokens sent but plugin response timed out — check Figma'
        : `❌ Plugin error: ${poll.message ?? 'unknown'}`,
  }, null, 2);
}
