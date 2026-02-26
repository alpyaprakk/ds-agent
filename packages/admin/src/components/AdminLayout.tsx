import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminStore } from '@/store/admin-store';

const navItems = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/users', label: 'Users' },
  { to: '/workspaces', label: 'Workspaces' },
  { to: '/plans', label: 'Plans' },
  { to: '/agents', label: 'Agent Configs' },
];

export function AdminLayout() {
  const { user, logout } = useAdminStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tokenhaus</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">Admin</p>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 truncate mb-2">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-red-600 hover:text-red-700 font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
