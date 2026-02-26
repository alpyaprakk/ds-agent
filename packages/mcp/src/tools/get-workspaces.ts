import { apiGet } from '../client.js';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  total_components: number;
  total_variables: number;
}

export async function getWorkspaces(): Promise<string> {
  const data = await apiGet<{ workspaces: Workspace[] }>('/api/workspaces');
  return JSON.stringify({
    workspaces: data.workspaces.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      icon: w.icon,
      stats: { components: w.total_components, variables: w.total_variables },
    })),
  }, null, 2);
}
