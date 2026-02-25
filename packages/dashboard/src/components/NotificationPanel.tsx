import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Notification03Icon,
  UserAdd02Icon,
  Tick02Icon,
  Cancel01Icon,
  UserRemove02Icon,
  Exchange01Icon,
  File02Icon,
  RefreshIcon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationStore } from '@/store/notification-store';
import { AppNotification } from '@/lib/api-client';

const notificationIcons: Record<string, typeof Notification03Icon> = {
  workspace_invitation: UserAdd02Icon,
  invitation_accepted: Tick02Icon,
  invitation_rejected: Cancel01Icon,
  member_removed: UserRemove02Icon,
  role_changed: Exchange01Icon,
  figma_file_added: File02Icon,
  figma_file_removed: Delete02Icon,
  figma_synced: RefreshIcon,
  conflict_detected: Alert02Icon,
  conflict_resolved: CheckmarkCircle02Icon,
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getNotificationRoute(type: string): string | null {
  switch (type) {
    case 'workspace_invitation':
    case 'invitation_accepted':
    case 'invitation_rejected':
    case 'member_removed':
    case 'role_changed':
      return '/settings';
    case 'conflict_detected':
    case 'conflict_resolved':
      return '/conflicts';
    case 'figma_file_added':
    case 'figma_file_removed':
    case 'figma_synced':
      return '/';
    default:
      return null;
  }
}

function NotificationItem({
  notification,
  onDelete,
  onClick,
}: {
  notification: AppNotification;
  onDelete: (id: string) => void;
  onClick: (notification: AppNotification) => void;
}) {
  const Icon = notificationIcons[notification.type] || Notification03Icon;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors cursor-pointer hover:bg-accent/50 ${
        !notification.read ? 'bg-accent/30' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      <div className={`mt-0.5 flex-shrink-0 rounded-full p-1.5 ${
        !notification.read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        <HugeiconsIcon icon={Icon} size={14} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug ${!notification.read ? 'font-medium' : 'text-muted-foreground'}`}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {notification.message}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {notification.workspace_name && (
            <span className="text-[10px] text-muted-foreground">
              {notification.workspace_icon} {notification.workspace_name}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {getTimeAgo(notification.created_at)}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="flex-shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ opacity: undefined }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
      >
        <HugeiconsIcon icon={Cancel01Icon} size={12} />
      </button>
    </div>
  );
}

export function NotificationPanel() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    isOpen,
    setOpen,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read) markAsRead(notification.id);
    const route = getNotificationRoute(notification.type);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch full list when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications({ limit: 30 });
    }
  }, [isOpen, fetchNotifications]);

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg relative">
          <HugeiconsIcon icon={Notification03Icon} size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsRead()}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[400px]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <HugeiconsIcon icon={Notification03Icon} size={24} className="text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
