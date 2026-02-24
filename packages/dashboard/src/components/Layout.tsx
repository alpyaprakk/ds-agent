import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WorkspaceSelector } from './WorkspaceSelector';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', path: '/', icon: '📊' },
  { name: 'Variables', path: '/variables', icon: '🎨' },
  { name: 'Components', path: '/components', icon: '📦' },
  { name: 'Conflicts', path: '/conflicts', icon: '⚠️' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">DS Agent</h1>
          <p className="text-sm text-gray-500 mt-1">Design System Manager</p>
        </div>

        {/* Workspace Selector */}
        <div className="px-3 mb-4">
          <WorkspaceSelector />
        </div>

        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
                  ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Connected</span>
            </div>
            <div>Version 1.0.0</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64">
        {children}
      </main>
    </div>
  );
}
