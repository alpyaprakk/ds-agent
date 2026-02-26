import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getUsers, suspendUser, unsuspendUser, setUserPlan, getUserWorkspaces,
  AdminUserRow, UserWorkspaceRow
} from '@/lib/admin-api';

const PLAN_OPTIONS = ['free', 'pro', 'enterprise'];

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700',
  admin: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-500',
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workspacesMap, setWorkspacesMap] = useState<Record<string, UserWorkspaceRow[]>>({});
  const [loadingWs, setLoadingWs] = useState<string | null>(null);

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

  const toggleExpand = async (user: AdminUserRow) => {
    if (expandedId === user.id) { setExpandedId(null); return; }
    setExpandedId(user.id);
    if (!workspacesMap[user.id]) {
      setLoadingWs(user.id);
      try {
        const res = await getUserWorkspaces(user.id);
        setWorkspacesMap(m => ({ ...m, [user.id]: res.workspaces }));
      } catch {
        setWorkspacesMap(m => ({ ...m, [user.id]: [] }));
      } finally {
        setLoadingWs(null);
      }
    }
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
              <th className="w-10 px-4 py-3"></th>
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
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No users found</td></tr>
            ) : users.flatMap(user => [
              <tr
                key={user.id}
                onClick={() => toggleExpand(user)}
                className={`cursor-pointer transition-colors hover:bg-gray-50 ${expandedId === user.id ? 'bg-gray-50' : ''}`}
              >
                {/* Chevron */}
                <td className="px-4 py-3 text-gray-400">
                  <svg className={`w-4 h-4 transition-transform duration-150 ${expandedId === user.id ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </td>

                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0 overflow-hidden">
                      {user.avatar
                        ? <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                        : user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-900 leading-tight">{user.name}</p>
                        {user.is_superadmin && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">superadmin</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">{user.email}</p>
                    </div>
                  </div>
                </td>

                {/* Plan */}
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <select
                    value={user.plan_name}
                    onChange={e => handleSetPlan(user.id, e.target.value)}
                    className={`text-xs rounded-full px-2.5 py-1 font-medium border-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-900 cursor-pointer ${PLAN_COLORS[user.plan_name] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {PLAN_OPTIONS.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </td>

                {/* Workspace count */}
                <td className="px-4 py-3 text-gray-700 font-medium">{user.owned_workspaces}</td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.suspended_at ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${user.suspended_at ? 'bg-red-500' : 'bg-green-500'}`} />
                    {user.suspended_at ? 'Suspended' : 'Active'}
                  </span>
                </td>

                {/* Joined */}
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>

                {/* Action */}
                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleSuspend(user)}
                    disabled={user.is_superadmin}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      user.suspended_at
                        ? 'border-green-300 text-green-700 hover:bg-green-50'
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {user.suspended_at ? 'Unsuspend' : 'Suspend'}
                  </button>
                </td>
              </tr>,

              // Expanded workspace panel
              expandedId === user.id && (
                <tr key={`${user.id}-ws`}>
                  <td colSpan={7} className="bg-gray-50 border-b border-gray-100 px-0 py-0">
                    <div className="pl-16 pr-6 py-3">
                      {loadingWs === user.id ? (
                        <p className="text-xs text-gray-400 py-1">Loading workspaces...</p>
                      ) : (workspacesMap[user.id] || []).length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">No workspaces</p>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Workspaces</p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {(workspacesMap[user.id] || []).map(ws => (
                              <div key={ws.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2 hover:border-gray-300 transition-colors">
                                <div
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                  style={{ backgroundColor: ws.color || '#6366f1' }}
                                >
                                  {ws.icon || ws.name.charAt(0).toUpperCase()}
                                </div>
                                <p className="font-medium text-gray-800 text-sm flex-1 min-w-0 truncate">{ws.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[ws.role] || 'bg-gray-100 text-gray-500'}`}>
                                  {ws.role}
                                </span>
                                <span className="text-xs text-gray-400 flex-shrink-0">{ws.member_count} members</span>
                                <span className="text-xs text-gray-400 flex-shrink-0">{ws.component_count} components</span>
                                <span className="text-xs text-gray-400 flex-shrink-0">{ws.variable_count} variables</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                  ws.health_score >= 80 ? 'bg-green-100 text-green-700'
                                  : ws.health_score >= 50 ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>{ws.health_score}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            ].filter(Boolean))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
