import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  Settings02Icon,
  Logout03Icon,
  User02Icon,
  Moon02Icon,
  Sun03Icon,
  AiCloudIcon
} from '@hugeicons/core-free-icons';
import { AIChatPanel } from '@/components/AIChatPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationPanel } from '@/components/NotificationPanel';
import { useWorkspaceStore } from '@/store/workspace-store';
import { useAuthStore } from '@/store/auth-store';
import { getAvatarUrl } from '@/lib/api-client';
import { useTheme } from '@/contexts/ThemeContext';

export function Header() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-4 px-6">

        {/* Page context */}
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xs font-semibold">{currentWorkspace?.name || 'Select Workspace'}</h2>
            <p className="text-[10px] text-muted-foreground">Design System Manager</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* AI Chat */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-3"
          onClick={() => setIsChatOpen(true)}
        >
          <HugeiconsIcon icon={AiCloudIcon} size={16} />
          <span className="text-xs font-medium">AI Chat</span>
        </Button>

        {/* Search */}
        <div className="relative w-64">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-10 pr-4 h-9"
          />
        </div>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={toggleTheme}>
          {theme === 'dark' ? (
            <HugeiconsIcon icon={Sun03Icon} size={18} />
          ) : (
            <HugeiconsIcon icon={Moon02Icon} size={18} />
          )}
        </Button>

        {/* Notifications */}
        <NotificationPanel />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={getAvatarUrl(user?.avatar)} alt={user?.name || 'User'} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email || ''}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <HugeiconsIcon icon={User02Icon} size={16} className="mr-2" />
              <span className="font-medium">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <HugeiconsIcon icon={Settings02Icon} size={16} className="mr-2" />
              <span className="font-medium">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <HugeiconsIcon icon={Logout03Icon} size={16} className="mr-2" />
              <span className="font-medium">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <AIChatPanel
      isOpen={isChatOpen}
      onClose={() => setIsChatOpen(false)}
      workspaceId={currentWorkspace?.id}
    />
  );
}
