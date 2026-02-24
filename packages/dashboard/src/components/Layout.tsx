import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  PaintBoardIcon,
  PackageIcon,
  Alert02Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon
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
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useLayout();

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
            <div className={cn(
              'flex items-center justify-between border-b h-16 px-4 transition-all',
              sidebarCollapsed && 'justify-center px-2'
            )}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center flex-shrink-0">
                  <img src="/logo.svg" alt="Logo" className="h-8 w-8 dark:invert" />
                </div>
              </div>
              {!sidebarCollapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <HugeiconsIcon icon={SidebarLeft01Icon} size={18} />
                </Button>
              )}
              {sidebarCollapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleSidebar}
                      className="h-8 w-8 absolute right-2"
                    >
                      <HugeiconsIcon icon={SidebarRight01Icon} size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Expand sidebar
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 py-4">
              <nav className={cn('space-y-1', sidebarCollapsed ? 'px-2' : 'px-3')}>
                {navigation.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  const linkContent = (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition-all',
                        'hover:bg-accent/50',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90'
                          : 'text-muted-foreground font-medium hover:text-foreground hover:bg-muted/50',
                        sidebarCollapsed && 'justify-center px-2'
                      )}
                    >
                      <HugeiconsIcon
                        icon={Icon}
                        size={20}
                        className={cn(
                          'flex-shrink-0 transition-all',
                          isActive ? 'opacity-100' : 'opacity-70'
                        )}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.name}</span>
                      )}
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
            <div className={cn('p-4', sidebarCollapsed && 'px-2')}>
              <div className={cn(
                'flex items-center gap-2 text-xs text-muted-foreground',
                sidebarCollapsed && 'justify-center'
              )}>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                {!sidebarCollapsed && <span>Connected</span>}
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
