const BASE = import.meta.env.VITE_API_URL || 'https://ds-agent.alpy.io';

function getToken() {
  return localStorage.getItem('admin_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Auth
export const adminLogin = (email: string, password: string) =>
  request<{ token: string; user: AdminUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const adminMe = () => request<{ user: AdminUser }>('/auth/me');

// Stats
export const getStats = () =>
  request<{ totalUsers: number; totalWorkspaces: number; activeProUsers: number; aiMessagesThisMonth: number }>('/stats');

// Users
export const getUsers = (page = 1, limit = 20, search = '') =>
  request<{ users: AdminUserRow[]; total: number; page: number; limit: number }>(
    `/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
  );

export const getUserDetail = (id: string) =>
  request<{ user: AdminUserDetail }>(`/users/${id}`);

export const suspendUser = (id: string) =>
  request<{ success: boolean }>(`/users/${id}/suspend`, { method: 'POST' });

export const unsuspendUser = (id: string) =>
  request<{ success: boolean }>(`/users/${id}/unsuspend`, { method: 'POST' });

export const setUserPlan = (id: string, plan: string) =>
  request<{ success: boolean }>(`/users/${id}/plan`, {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });

// Workspaces
export const getWorkspaces = (page = 1, limit = 20, search = '') =>
  request<{ workspaces: AdminWorkspaceRow[]; total: number; page: number; limit: number }>(
    `/workspaces?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
  );

export const deleteWorkspace = (id: string) =>
  request<{ success: boolean }>(`/workspaces/${id}`, { method: 'DELETE' });

export const transferWorkspace = (id: string, newOwnerId: string) =>
  request<{ success: boolean }>(`/workspaces/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ newOwnerId }),
  });

// Plans
export const getPlans = () => request<{ plans: Plan[] }>('/plans');

export const updatePlan = (id: string, data: Partial<Plan>) =>
  request<{ plan: Plan }>(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Agent Configs
export const getAgentConfigs = () => request<{ configs: AgentConfigRow[] }>('/agent-configs');

// Per-workspace agent config (uses regular /api/agent-configs endpoint)
export async function getWorkspaceAgentConfigs(workspaceId: string) {
  const token = getToken();
  const res = await fetch(`${BASE}/api/agent-configs/${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed');
  return res.json() as Promise<{ configs: AgentConfigRow[] }>;
}

export async function saveAgentConfig(workspaceId: string, agentType: string, data: object) {
  const token = getToken();
  const res = await fetch(`${BASE}/api/agent-configs/${workspaceId}/${agentType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

// Types
export interface AdminUser { id: string; email: string; name: string; }
export interface AdminUserRow {
  id: string; email: string; name: string; avatar?: string;
  plan_name: string; plan_display: string; owned_workspaces: number;
  suspended_at: string | null; created_at: string; is_superadmin: boolean;
}
export interface AdminUserDetail extends AdminUserRow {
  plan_status: string; valid_until: string | null; ai_messages_this_month: number;
}
export interface AdminWorkspaceRow {
  id: string; name: string; icon: string; color: string;
  owner_email: string; owner_name: string; member_count: number;
  component_count: number; variable_count: number; last_synced: string | null;
  health_score: number; created_at: string;
}
export interface Plan {
  id: string; name: string; display_name: string;
  workspace_limit: number; seat_limit: number; variable_limit: number;
  component_limit: number; ai_messages_per_month: number;
  price_monthly_usd: number; is_active: boolean;
}
export interface AgentConfigRow {
  id: string; workspace_id: string; workspace_name: string;
  agent_type: string; name: string; identity: string; tone: string;
  system_prompt: string; capabilities: string[]; context_rules: string; is_active: boolean;
}
