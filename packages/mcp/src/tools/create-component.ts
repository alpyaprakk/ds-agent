import { apiPost } from '../client.js';
import { z } from 'zod';
import { CreateComponentInputSchema } from '../types.js';

type Input = z.infer<typeof CreateComponentInputSchema>;

export async function createComponent(input: Input): Promise<string> {
  const { workspaceId, ...spec } = input;

  const command = {
    type: 'create_component',
    spec,
  };

  const result = await apiPost<{ commandStatus: string; commandId: string }>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  return JSON.stringify({
    status: result.commandStatus,
    component: spec.componentName,
    page: spec.pageName,
    variantCount: spec.variants?.length ?? 0,
    commandId: result.commandId,
    message: result.commandStatus === 'sent'
      ? `✅ Component "${spec.componentName}" sent to Figma plugin (${spec.variants?.length ?? 0} variants)`
      : '⚠️ No Figma plugin connected — open the plugin in Figma and try again',
  }, null, 2);
}
