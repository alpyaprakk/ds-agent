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
  member_role?: string;
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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface UserSettings {
  ai_provider: string;
  has_anthropic_key: boolean;
  has_openai_key: boolean;
  has_figma_token: boolean;
  anthropic_api_key_preview?: string;
  openai_api_key_preview?: string;
  figma_access_token_preview?: string;
  preferences: Record<string, any>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string): Promise<{ user: AuthUser; token: string }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async getMe(): Promise<{ user: AuthUser }> {
    return this.request('/api/auth/me');
  }

  async getUserSettings(): Promise<{ settings: UserSettings | null }> {
    return this.request('/api/auth/settings');
  }

  async updateUserSettings(data: {
    ai_provider?: string;
    anthropic_api_key?: string;
    openai_api_key?: string;
    figma_access_token?: string;
  }): Promise<{ settings: any }> {
    return this.request('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateProfile(data: { name?: string; avatar?: string }): Promise<{ user: AuthUser }> {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  async deleteFigmaFile(
    workspaceId: string,
    fileId: string
  ): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'DELETE',
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
