import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getUsers, suspendUser, unsuspendUser, setUserPlan, AdminUserRow } from '@/lib/admin-api';

const PLAN_OPTIONS = ['free', 'pro', 'enterprise'];

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await getUsers(p, 20, s);
      setUsers(res.users);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleSuspend = async (user: AdminUserRow) => {
    try {
      if (user.suspended_at) {
        await unsuspendUser(user.id);
        toast.success(`${user.name} unsuspended`);
      } else {
        await suspendUser(user.id);
        toast.success(`${user.name} suspended`);
      }
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSetPlan = async (userId: string, plan: string) => {
    try {
      await setUserPlan(userId, plan);
      toast.success(`Plan updated to ${plan}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total users</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button type="submit" className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">
            Search
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Workspaces</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No users found</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-gray-400 text-xs">{user.email}</p>
                    {user.is_superadmin && <span className="text-xs text-purple-600 font-medium">superadmin</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={user.plan_name}
                    onChange={e => handleSetPlan(user.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
                  >
                    {PLAN_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-600">{user.owned_workspaces}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.suspended_at ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {user.suspended_at ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSuspend(user)}
                    disabled={user.is_superadmin}
                    className={`text-xs font-medium px-3 py-1 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      user.suspended_at
                        ? 'border-green-300 text-green-700 hover:bg-green-50'
                        : 'border-red-300 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {user.suspended_at ? 'Unsuspend' : 'Suspend'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
