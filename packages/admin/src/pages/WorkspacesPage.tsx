import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getWorkspaces, deleteWorkspace, transferWorkspace, AdminWorkspaceRow } from '@/lib/admin-api';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [transferModal, setTransferModal] = useState<{ id: string; name: string } | null>(null);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await getWorkspaces(p, 20, s);
      setWorkspaces(res.workspaces);
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

  const handleDelete = async (ws: AdminWorkspaceRow) => {
    if (!confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) return;
    setDeleting(ws.id);
    try {
      await deleteWorkspace(ws.id);
      toast.success(`"${ws.name}" deleted`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleTransfer = async () => {
    if (!transferModal || !newOwnerId.trim()) return;
    try {
      await transferWorkspace(transferModal.id, newOwnerId.trim());
      toast.success(`Ownership transferred`);
      setTransferModal(null);
      setNewOwnerId('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalPages = Math.ceil(total / 20);

  const formatLimit = (n: number) => (n === -1 ? '∞' : n.toLocaleString());

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total workspaces</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or owner..."
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
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Workspace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Components</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Variables</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
            ) : workspaces.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No workspaces found</td></tr>
            ) : workspaces.map(ws => (
              <tr key={ws.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                      style={{ backgroundColor: ws.color || '#6366f1' }}
                    >
                      {ws.icon || ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{ws.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{ws.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{ws.owner_name}</p>
                  <p className="text-gray-400 text-xs">{ws.owner_email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{ws.member_count}</td>
                <td className="px-4 py-3 text-gray-600">{formatLimit(ws.component_count)}</td>
                <td className="px-4 py-3 text-gray-600">{formatLimit(ws.variable_count)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    ws.health_score >= 80 ? 'bg-green-100 text-green-700'
                    : ws.health_score >= 50 ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                    {ws.health_score}%
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(ws.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setTransferModal({ id: ws.id, name: ws.name }); setNewOwnerId(''); }}
                      className="text-xs font-medium px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() => handleDelete(ws)}
                      disabled={deleting === ws.id}
                      className="text-xs font-medium px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deleting === ws.id ? '...' : 'Delete'}
                    </button>
                  </div>
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

      {transferModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Transfer Ownership</h2>
            <p className="text-sm text-gray-500 mb-4">
              Transfer <span className="font-medium text-gray-700">"{transferModal.name}"</span> to a new owner.
            </p>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Owner User ID</label>
            <input
              value={newOwnerId}
              onChange={e => setNewOwnerId(e.target.value)}
              placeholder="UUID of new owner"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4 font-mono"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setTransferModal(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!newOwnerId.trim()}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
