import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  Notification03Icon,
  Settings02Icon,
  Logout03Icon,
  User02Icon,
  Moon02Icon,
  Sun03Icon
} from '@hugeicons/core-free-icons';
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
import { useWorkspaceStore } from '../store/workspace-store';
import { useTheme } from '../contexts/ThemeContext';

export function Header() {
  const { currentWorkspace } = useWorkspaceStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-6">

        {/* Workspace Name */}
        <div className="flex items-center gap-3">
          <span className="text-xl">{currentWorkspace?.icon || '📦'}</span>
          <div>
            <h2 className="text-xs font-semibold">{currentWorkspace?.name || 'Select Workspace'}</h2>
            <p className="text-[10px] text-muted-foreground">Design System Manager</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-64">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-10 pr-4 h-10"
          />
        </div>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg" onClick={toggleTheme}>
          {theme === 'dark' ? (
            <HugeiconsIcon icon={Sun03Icon} size={20} />
          ) : (
            <HugeiconsIcon icon={Moon02Icon} size={20} />
          )}
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
          <HugeiconsIcon icon={Notification03Icon} size={20} />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src="" alt="User" />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  U
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold">User Account</p>
                <p className="text-xs text-muted-foreground font-normal">user@example.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <HugeiconsIcon icon={User02Icon} size={16} className="mr-2" />
              <span className="font-medium">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HugeiconsIcon icon={Settings02Icon} size={16} className="mr-2" />
              <span className="font-medium">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <HugeiconsIcon icon={Logout03Icon} size={16} className="mr-2" />
              <span className="font-medium">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
