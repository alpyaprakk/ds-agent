import { create } from 'zustand';
import { apiClient, AppNotification } from '../lib/api-client';

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  isOpen: boolean;

  fetchNotifications: (options?: { limit?: number; offset?: number; unread?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addNotification: (notification: AppNotification) => void;
  setOpen: (open: boolean) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  loading: false,
  loadingMore: false,
  hasMore: false,
  isOpen: false,

  fetchNotifications: async (options) => {
    set({ loading: true });
    try {
      const limit = options?.limit || 30;
      const data = await apiClient.getNotifications({ ...options, limit });
      set({
        notifications: data.notifications,
        total: data.total,
        unreadCount: data.unread_count,
        hasMore: data.notifications.length < data.total,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { notifications, loadingMore, hasMore } = get();
    if (loadingMore || !hasMore) return;

    set({ loadingMore: true });
    try {
      const data = await apiClient.getNotifications({
        limit: 30,
        offset: notifications.length,
      });
      set((state) => ({
        notifications: [...state.notifications, ...data.notifications],
        total: data.total,
        unreadCount: data.unread_count,
        hasMore: state.notifications.length + data.notifications.length < data.total,
        loadingMore: false,
      }));
    } catch (error) {
      console.error('Failed to load more notifications:', error);
      set({ loadingMore: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { count } = await apiClient.getUnreadNotificationCount();
      set({ unreadCount: count });
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  },

  markAsRead: async (id) => {
    const prev = get();
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
    try {
      await apiClient.markNotificationAsRead(id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Rollback
      set({ notifications: prev.notifications, unreadCount: prev.unreadCount });
    }
  },

  markAllAsRead: async () => {
    const prev = get();
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    try {
      await apiClient.markAllNotificationsAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // Rollback
      set({ notifications: prev.notifications, unreadCount: prev.unreadCount });
    }
  },

  deleteNotification: async (id) => {
    const prev = get();
    const notification = prev.notifications.find((n) => n.id === id);
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      total: state.total - 1,
      unreadCount: notification && !notification.read
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));
    try {
      await apiClient.deleteNotification(id);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Rollback
      set({ notifications: prev.notifications, total: prev.total, unreadCount: prev.unreadCount });
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      total: state.total + 1,
      unreadCount: state.unreadCount + 1,
    }));
  },

  setOpen: (open) => set({ isOpen: open }),
}));
