const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function getAvatarUrl(avatar?: string | null): string {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  return `${API_URL}${avatar}`;
}

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
  member_count?: number;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  created_at: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  invited_by: string;
  email: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
  workspace_name?: string;
  workspace_icon?: string;
  inviter_name?: string;
}

export interface VariableCollection {
  id: string;
  workspace_id: string;
  figma_file_id?: string;
  name: string;
  figma_key: string;
  figma_id: string;
  modes: any[];
  variable_count: number;
  created_at: string;
  updated_at: string;
}

export interface DesignVariable {
  id: string;
  workspace_id: string;
  figma_file_id?: string;
  name: string;
  figma_key: string;
  figma_id?: string;
  type: string;
  value: any;
  collection_id: string;
  collection_name?: string;
  scopes: any[];
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DesignComponent {
  id: string;
  workspace_id: string;
  figma_file_id?: string;
  name: string;
  figma_key: string;
  type: string;
  description?: string;
  properties: Record<string, any>;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

export interface FigmaFile {
  id: string;
  workspace_id: string;
  figma_key: string;
  name: string;
  url?: string;
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

export interface AppNotification {
  id: string;
  user_id: string;
  workspace_id?: string;
  type: string;
  title: string;
  message?: string;
  actor_id?: string;
  reference_type?: string;
  reference_id?: string;
  read: boolean;
  created_at: string;
  actor_name?: string;
  actor_avatar?: string;
  workspace_name?: string;
  workspace_icon?: string;
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

  async uploadAvatar(file: File): Promise<{ user: AuthUser }> {
    const url = `${this.baseUrl}/api/auth/avatar`;
    const token = this.getToken();
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
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

  async getCollections(workspaceId: string): Promise<{ collections: VariableCollection[] }> {
    return this.request(`/api/workspaces/${workspaceId}/collections`);
  }

  async getVariables(workspaceId: string, collectionKey?: string): Promise<{ variables: DesignVariable[] }> {
    const params = collectionKey ? `?collection=${encodeURIComponent(collectionKey)}` : '';
    return this.request(`/api/workspaces/${workspaceId}/variables${params}`);
  }

  async getComponents(workspaceId: string, search?: string): Promise<{ components: DesignComponent[] }> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/api/workspaces/${workspaceId}/components${params}`);
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

  // Members
  async getWorkspaceMembers(workspaceId: string): Promise<{ members: WorkspaceMember[] }> {
    return this.request(`/api/workspaces/${workspaceId}/members`);
  }

  async inviteMember(
    workspaceId: string,
    email: string,
    role: string = 'member'
  ): Promise<{ invitation: WorkspaceInvitation }> {
    return this.request(`/api/workspaces/${workspaceId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async getWorkspaceInvitations(workspaceId: string): Promise<{ invitations: WorkspaceInvitation[] }> {
    return this.request(`/api/workspaces/${workspaceId}/members/invitations`);
  }

  async cancelInvitation(workspaceId: string, invitationId: string): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${workspaceId}/members/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  }

  async updateMemberRole(workspaceId: string, userId: string, role: string): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${workspaceId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeMember(workspaceId: string, userId: string): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // Invitations (user-level)
  async getMyInvitations(): Promise<{ invitations: WorkspaceInvitation[] }> {
    return this.request('/api/auth/invitations');
  }

  async acceptInvitation(token: string): Promise<{ success: boolean; workspace_id: string; workspace_name: string }> {
    return this.request(`/api/auth/invitations/${token}/accept`, {
      method: 'POST',
    });
  }

  async rejectInvitation(token: string): Promise<{ success: boolean }> {
    return this.request(`/api/auth/invitations/${token}/reject`, {
      method: 'POST',
    });
  }

  // Notifications
  async getNotifications(options?: { limit?: number; offset?: number; unread?: boolean }): Promise<{
    notifications: AppNotification[];
    total: number;
    unread_count: number;
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.unread) params.set('unread', 'true');
    const query = params.toString() ? `?${params}` : '';
    return this.request(`/api/notifications${query}`);
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    return this.request('/api/notifications/unread-count');
  }

  async markNotificationAsRead(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsAsRead(): Promise<{ success: boolean; count: number }> {
    return this.request('/api/notifications/read-all', { method: 'POST' });
  }

  async deleteNotification(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/notifications/${id}`, { method: 'DELETE' });
  }

  async getNotificationPreferences(): Promise<{ preferences: Record<string, boolean> }> {
    return this.request('/api/notifications/preferences');
  }

  async updateNotificationPreferences(preferences: Record<string, boolean>): Promise<{ preferences: Record<string, boolean> }> {
    return this.request('/api/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  }
}

export const apiClient = new ApiClient();
