import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Palette, Package, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLayout } from '@/contexts/LayoutContext';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Variables', path: '/variables', icon: Palette },
  { name: 'Components', path: '/components', icon: Package },
  { name: 'Conflicts', path: '/conflicts', icon: AlertTriangle },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { sidebarCollapsed } = useLayout();

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
            {/* Logo */}
            <div className={cn('flex items-center border-b h-16 px-4 transition-all', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
                DS
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">DS Agent</span>
                  <span className="text-xs text-muted-foreground">Design System</span>
                </div>
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
                        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-primary text-primary-foreground shadow-sm',
                        sidebarCollapsed && 'justify-center'
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!sidebarCollapsed && <span>{item.name}</span>}
                    </Link>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right">
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
