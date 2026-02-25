const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  health_score?: number;
  total_components?: number;
  total_variables?: number;
}

export interface FigmaFile {
  id: string;
  workspace_id: string;
  figma_key: string;
  name: string;
  role: 'primary' | 'secondary' | 'reference';
  sync_status: string;
  last_synced?: string;
}

export interface Conflict {
  id: string;
  workspace_id: string;
  conflict_type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved' | 'dismissed';
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  description?: string;
  resolution_method?: string;
  created_at: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Workspaces
  async getWorkspaces(): Promise<{ workspaces: Workspace[] }> {
    return this.request('/api/workspaces');
  }

  async getWorkspace(id: string): Promise<{ workspace: Workspace }> {
    return this.request(`/api/workspaces/${id}`);
  }

  async createWorkspace(data: Partial<Workspace>): Promise<{ workspace: Workspace }> {
    return this.request('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkspace(id: string, data: Partial<Workspace>): Promise<{ workspace: Workspace }> {
    return this.request(`/api/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkspace(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${id}`, {
      method: 'DELETE',
    });
  }

  async getWorkspaceHealth(id: string): Promise<{ health: any }> {
    return this.request(`/api/workspaces/${id}/health`);
  }

  // Figma Files
  async getFigmaFiles(workspaceId: string): Promise<{ files: FigmaFile[] }> {
    return this.request(`/api/workspaces/${workspaceId}/files`);
  }

  async addFigmaFile(
    workspaceId: string,
    data: Partial<FigmaFile>
  ): Promise<{ file: FigmaFile }> {
    return this.request(`/api/workspaces/${workspaceId}/files`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async syncFile(fileId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/sync/files/${fileId}`, {
      method: 'POST',
    });
  }

  // Conflicts
  async getConflicts(
    workspaceId: string,
    status?: string
  ): Promise<{ conflicts: Conflict[] }> {
    const query = status ? `?status=${status}` : '';
    return this.request(`/api/workspaces/${workspaceId}/conflicts${query}`);
  }

  async getConflictsSummary(workspaceId: string): Promise<{ summary: any[] }> {
    return this.request(`/api/workspaces/${workspaceId}/conflicts/summary`);
  }

  async resolveConflict(
    conflictId: string,
    data: {
      method: string;
      chosen: string;
      value?: any;
      resolvedBy: string;
    }
  ): Promise<{ conflict: Conflict }> {
    return this.request(`/api/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async dismissConflict(
    conflictId: string,
    actor: string
  ): Promise<{ conflict: Conflict }> {
    return this.request(`/api/conflicts/${conflictId}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  }
}

export const apiClient = new ApiClient();
