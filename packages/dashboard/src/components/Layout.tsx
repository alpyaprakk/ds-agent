import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { io } from 'socket.io-client';
import {
  DashboardSquare01Icon,
  PaintBoardIcon,
  PackageIcon,
  Alert02Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  Settings02Icon,
  Add01Icon,
  Tick02Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLayout } from '@/contexts/LayoutContext';
import { useWorkspaceStore } from '@/store/workspace-store';
import { wsClient } from '@/lib/websocket';
import { Header } from './Header';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', path: '/', icon: DashboardSquare01Icon },
  { name: 'Variables', path: '/variables', icon: PaintBoardIcon },
  { name: 'Components', path: '/components', icon: PackageIcon },
  { name: 'Conflicts', path: '/conflicts', icon: Alert02Icon },
  { name: 'Settings', path: '/settings', icon: Settings02Icon },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useLayout();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const [pluginConnected, setPluginConnected] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    const socket = io(WS_URL, {
      path: '/api/socket.io'
    });

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('plugin-status', (data: { connected: boolean; plugin: string; count: number }) => {
      const newStatus = data.connected && data.count > 0;
      setPluginConnected(newStatus);
    });

    socket.on('disconnect', () => {
      setPluginConnected(false);
    });

    return () => {
      socket.close();
    };
  }, []);

  const handleSelectWorkspace = (workspace: typeof currentWorkspace) => {
    if (workspace && workspace.id !== currentWorkspace?.id) {
      setCurrentWorkspace(workspace);
      wsClient.joinWorkspace(workspace.id);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 h-full border-r bg-card transition-all duration-300',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo with Collapse Button */}
            <div className="flex items-center border-b h-14 transition-all duration-300 px-3">
              <div className="flex items-center w-full">
                <div className="flex items-center flex-1 overflow-hidden">
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={toggleSidebar}
                          className="group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-muted/50 flex-shrink-0"
                        >
                          <img
                            src="/logo.svg"
                            alt="Logo"
                            className="absolute h-8 w-8 dark:invert transition-opacity duration-200 group-hover:opacity-0"
                          />
                          <HugeiconsIcon
                            icon={SidebarRight01Icon}
                            size={20}
                            className="absolute opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Expand sidebar
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center flex-shrink-0">
                      <img src="/logo.svg" alt="Logo" className="h-8 w-8 dark:invert" />
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-8 w-8 flex-shrink-0 transition-all duration-300"
                  >
                    <HugeiconsIcon icon={SidebarLeft01Icon} size={18} />
                  </Button>
                )}
              </div>
            </div>

            {/* Workspace Switcher */}
            <div className="px-3 py-3 border-b">
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted/50 transition-all text-lg">
                          {currentWorkspace?.icon || '📦'}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-64">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Workspaces
                        </DropdownMenuLabel>
                        {workspaces.map((ws) => (
                          <DropdownMenuItem
                            key={ws.id}
                            onClick={() => handleSelectWorkspace(ws)}
                            className="gap-2 p-2"
                          >
                            <span className="text-base">{ws.icon || '📦'}</span>
                            <div className="flex-1 min-w-0">
                              <span className="truncate text-sm font-medium">{ws.name}</span>
                            </div>
                            {currentWorkspace?.id === ws.id && (
                              <HugeiconsIcon icon={Tick02Icon} size={16} className="text-primary flex-shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowCreateModal(true)} className="gap-2 p-2">
                          <HugeiconsIcon icon={Add01Icon} size={16} />
                          <span className="text-sm font-medium">New Workspace</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {currentWorkspace?.name || 'Select Workspace'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-all">
                      <span className="text-lg flex-shrink-0">{currentWorkspace?.icon || '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-semibold">{currentWorkspace?.name || 'Select Workspace'}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {currentWorkspace?.description || 'Design System'}
                        </div>
                      </div>
                      <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="text-muted-foreground flex-shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[232px]">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Workspaces
                    </DropdownMenuLabel>
                    {workspaces.map((ws) => (
                      <DropdownMenuItem
                        key={ws.id}
                        onClick={() => handleSelectWorkspace(ws)}
                        className="gap-2 p-2"
                      >
                        <span className="text-base">{ws.icon || '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium">{ws.name}</div>
                          {ws.description && (
                            <div className="truncate text-[11px] text-muted-foreground">{ws.description}</div>
                          )}
                        </div>
                        {currentWorkspace?.id === ws.id && (
                          <HugeiconsIcon icon={Tick02Icon} size={16} className="text-primary flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowCreateModal(true)} className="gap-2 p-2">
                      <HugeiconsIcon icon={Add01Icon} size={16} />
                      <span className="text-sm font-medium">New Workspace</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 py-4">
              <nav className="space-y-1 px-3">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  const linkContent = (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center justify-start rounded-lg text-xs transition-all duration-300 overflow-hidden h-10',
                        sidebarCollapsed ? 'pl-[10px] pr-[10px]' : 'pl-3 pr-3',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90'
                          : 'text-muted-foreground font-medium hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <HugeiconsIcon
                        icon={Icon}
                        size={20}
                        className={cn(
                          'flex-shrink-0',
                          isActive ? 'opacity-100' : 'opacity-70'
                        )}
                      />
                      <span className={cn(
                        'truncate transition-all duration-300 whitespace-nowrap',
                        sidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-3'
                      )}>
                        {item.name}
                      </span>
                    </Link>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return linkContent;
                })}
              </nav>
            </ScrollArea>

            <Separator />

            {/* Footer */}
            <div className="p-4">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground transition-all duration-300">
                <div className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  pluginConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                )} />
                <span className={cn(
                  'transition-all duration-300',
                  sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                )}>
                  {pluginConnected ? 'Plugin Connected' : 'Plugin Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className={cn('transition-all duration-300', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
        </div>

        {/* Create Workspace Modal */}
        <CreateWorkspaceModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      </div>
    </TooltipProvider>
  );
}
