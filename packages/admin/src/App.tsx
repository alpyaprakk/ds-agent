import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useAdminStore } from '@/store/admin-store';
import { AdminLayout } from '@/components/AdminLayout';
import AdminLogin from '@/pages/AdminLogin';
import AdminDashboard from '@/pages/AdminDashboard';
import UsersPage from '@/pages/UsersPage';
import WorkspacesPage from '@/pages/WorkspacesPage';
import PlansPage from '@/pages/PlansPage';
import AgentConfigsPage from '@/pages/AgentConfigsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAdminStore();
  if (!initialized) return <div className="flex items-center justify-center h-screen text-sm text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { checkAuth } = useAdminStore();
  useEffect(() => { checkAuth(); }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="workspaces" element={<WorkspacesPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="agents" element={<AgentConfigsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
