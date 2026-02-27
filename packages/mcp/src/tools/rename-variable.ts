import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';
import { RenameVariableInputSchema } from '../types.js';

type Input = z.infer<typeof RenameVariableInputSchema>;

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

export async function renameVariable(input: Input): Promise<string> {
  const { workspaceId, oldName, newName } = input;

  const command = {
    type: 'rename_variable',
    spec: { oldName, newName },
  };

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

  return JSON.stringify({
    status: poll.status,
    oldName,
    newName,
    commandId: result.commandId,
    message: poll.status === 'success'
      ? `✅ Renamed "${oldName}" → "${newName}"`
      : poll.status === 'timeout'
        ? '⏱ Command sent but plugin response timed out — check Figma'
        : `❌ Plugin error: ${poll.message ?? 'unknown'}`,
  }, null, 2);
}
