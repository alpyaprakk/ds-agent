import { apiPost } from '../client.js';
import { z } from 'zod';
import { SetTokensInputSchema } from '../types.js';

type Input = z.infer<typeof SetTokensInputSchema>;

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

  const result = await apiPost<{ commandStatus: string; commandId: string }>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  return JSON.stringify({
    status: result.commandStatus,
    tokenCount: tokens.length,
    commandId: result.commandId,
    message: result.commandStatus === 'sent'
      ? `✅ ${tokens.length} token(s) sent to Figma plugin`
      : '⚠️ No Figma plugin connected — open the plugin in Figma and try again',
  }, null, 2);
}
