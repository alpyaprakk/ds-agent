import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Palette, Package, AlertTriangle } from 'lucide-react';
import { WorkspaceSelector } from './WorkspaceSelector';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="p-6">
            <h1 className="text-2xl font-bold tracking-tight">DS Agent</h1>
            <p className="text-sm text-muted-foreground mt-1">Design System Manager</p>
          </div>

          <Separator />

          {/* Workspace Selector */}
          <div className="px-3 py-4">
            <WorkspaceSelector />
          </div>

          <Separator />

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          <Separator />

          {/* Footer */}
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Connected</span>
            </div>
            <div className="text-xs text-muted-foreground">Version 1.0.0</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
