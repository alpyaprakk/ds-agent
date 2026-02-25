import { create } from 'zustand';
import { AdminUser, adminLogin, adminMe } from '@/lib/admin-api';

interface AdminStore {
  user: AdminUser | null;
  token: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAdminStore = create<AdminStore>((set) => ({
  user: null,
  token: localStorage.getItem('admin_token'),
  initialized: false,

  login: async (email, password) => {
    const { token, user } = await adminLogin(email, password);
    localStorage.setItem('admin_token', token);
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) { set({ initialized: true }); return; }
    try {
      const { user } = await adminMe();
      set({ user, token, initialized: true });
    } catch {
      localStorage.removeItem('admin_token');
      set({ user: null, token: null, initialized: true });
    }
  },
}));
