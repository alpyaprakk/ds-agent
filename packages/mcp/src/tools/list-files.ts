import { apiGet } from '../client.js';
import { z } from 'zod';

// ── list_files Schema ───────────────────────────────────────────────────────

export const ListFilesInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
}).describe('List all Figma files associated with a workspace');

type Input = z.infer<typeof ListFilesInputSchema>;

interface FigmaFile {
  id: string;
  workspace_id: string;
  figma_key: string;
  name: string;
  url?: string;
  role: 'primary' | 'secondary' | 'reference';
  type?: string;
  last_synced?: string;
  sync_status: 'pending' | 'syncing' | 'success' | 'error';
  sync_error?: string;
  stats?: {
    variables?: number;
    collections?: number;
    components?: number;
  };
  added_at: string;
  updated_at: string;
}

export async function listFiles(input: Input): Promise<string> {
  const { workspaceId } = input;

  const data = await apiGet<{ files: FigmaFile[] }>(`/api/workspaces/${workspaceId}/files`);

  return JSON.stringify({
    workspaceId,
    fileCount: data.files.length,
    files: data.files.map(f => ({
      id: f.id,
      figmaKey: f.figma_key,
      name: f.name,
      url: f.url,
      role: f.role,
      type: f.type,
      syncStatus: f.sync_status,
      syncError: f.sync_error,
      stats: f.stats,
      lastSynced: f.last_synced,
      addedAt: f.added_at,
    })),
  }, null, 2);
}
