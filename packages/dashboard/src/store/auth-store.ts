import { create } from 'zustand';
import { apiClient, AuthUser, UserSettings } from '../lib/api-client';

interface AuthStore {
  user: AuthUser | null;
  settings: UserSettings | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: {
    ai_provider?: string;
    anthropic_api_key?: string;
    openai_api_key?: string;
    figma_access_token?: string;
  }) => Promise<void>;
  updateProfile: (data: { name?: string; avatar?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  settings: null,
  token: localStorage.getItem('auth_token'),
  loading: false,
  initialized: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { user, token } = await apiClient.login(email, password);
      localStorage.setItem('auth_token', token);
      set({ user, token, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  register: async (email, password, name) => {
    set({ loading: true });
    try {
      const { user, token } = await apiClient.register(email, password, name);
      localStorage.setItem('auth_token', token);
      set({ user, token, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, settings: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ initialized: true });
      return;
    }

    try {
      const { user } = await apiClient.getMe();
      set({ user, token, initialized: true });
    } catch {
      localStorage.removeItem('auth_token');
      set({ user: null, token: null, initialized: true });
    }
  },

  fetchSettings: async () => {
    try {
      const { settings } = await apiClient.getUserSettings();
      set({ settings });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  },

  updateSettings: async (data) => {
    try {
      await apiClient.updateUserSettings(data);
      // Refresh settings to get masked values
      await get().fetchSettings();
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },

  updateProfile: async (data) => {
    try {
      const { user } = await apiClient.updateProfile(data);
      set({ user });
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },
}));
