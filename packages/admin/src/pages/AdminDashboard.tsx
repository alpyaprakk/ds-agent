import { useEffect, useState } from 'react';
import { getStats } from '@/lib/admin-api';

interface Stats {
  totalUsers: number;
  totalWorkspaces: number;
  activeProUsers: number;
  aiMessagesThisMonth: number;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getStats().then(setStats).catch(e => setError(e.message));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform overview</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Total Workspaces" value={stats.totalWorkspaces} />
          <StatCard label="Active Pro Users" value={stats.activeProUsers} />
          <StatCard label="AI Messages (this month)" value={stats.aiMessagesThisMonth} />
        </div>
      ) : (
        !error && <p className="text-sm text-gray-400">Loading...</p>
      )}
    </div>
  );
}
