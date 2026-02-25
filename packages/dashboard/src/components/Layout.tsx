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
  Settings02Icon
} from '@hugeicons/core-free-icons';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLayout } from '@/contexts/LayoutContext';
import { Header } from './Header';

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
  const [pluginConnected, setPluginConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    const socket = io(WS_URL);

    socket.on('connect', () => {
      console.log('✅ Connected to server');
    });

    socket.on('plugin-status', (data: { connected: boolean; plugin: string; count: number }) => {
      console.log('Plugin status update:', data);
      setPluginConnected(data.connected && data.count > 0);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setPluginConnected(false);
    });

    return () => {
      socket.close();
    };
  }, []);

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
            <div className="flex items-center border-b h-16 transition-all duration-300 px-3">
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
      </div>
    </TooltipProvider>
  );
}
