import { apiGet } from '../client.js';
import { z } from 'zod';
import { GetSyncStatusInputSchema } from '../types.js';

type Input = z.infer<typeof GetSyncStatusInputSchema>;

interface PluginStatus {
  connected: boolean;
  count: number;
  plugins: Array<{
    plugin: string;
    connectedAt: string;
    lastHeartbeat: string;
    socketId: string;
  }>;
}

export async function getSyncStatus(input: Input): Promise<string> {
  const { workspaceId } = input;

  const pluginStatus = await apiGet<PluginStatus>('/api/plugins/status');

  let workspaceInfo: Record<string, unknown> = {};
  if (workspaceId) {
    try {
      const ws = await apiGet<{ workspace: Record<string, unknown> }>(
        `/api/workspaces/${workspaceId}`
      );
      workspaceInfo = {
        name: ws.workspace.name,
        totalVariables: ws.workspace.total_variables,
        totalComponents: ws.workspace.total_components,
        lastAudit: ws.workspace.last_audit,
        healthScore: ws.workspace.health_score,
      };
    } catch {
      // Non-critical
    }
  }

  return JSON.stringify({
    plugin: {
      connected: pluginStatus.connected,
      count: pluginStatus.count,
      instances: pluginStatus.plugins.map(p => ({
        name: p.plugin,
        connectedAt: p.connectedAt,
        lastHeartbeat: p.lastHeartbeat,
      })),
    },
    ...(workspaceId ? { workspace: workspaceInfo } : {}),
    readyToExecute: pluginStatus.connected,
    message: pluginStatus.connected
      ? `✅ ${pluginStatus.count} Figma plugin(s) connected — ready to execute commands`
      : '⚠️ No Figma plugin connected — open Tokenhaus plugin in Figma first',
  }, null, 2);
}
