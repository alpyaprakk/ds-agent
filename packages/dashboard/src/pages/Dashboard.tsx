import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { AddFigmaFileModal } from '../components/AddFigmaFileModal';
import { Plus } from 'lucide-react';

export function Dashboard() {
  const {
    currentWorkspace,
    figmaFiles,
    conflicts,
    loading,
  } = useWorkspaceStore();
  const [showAddFileModal, setShowAddFileModal] = useState(false);

  useEffect(() => {
    // Auto-refresh data
    const interval = setInterval(() => {
      if (currentWorkspace) {
        // Refresh would happen here
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Workspace Selected
          </h2>
          <p className="text-gray-600 mb-6">
            Create or select a workspace to get started with your design system.
          </p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Create Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {currentWorkspace.icon} {currentWorkspace.name}
        </h1>
        {currentWorkspace.description && (
          <p className="text-gray-600 mt-2">{currentWorkspace.description}</p>
        )}
      </div>

      {/* Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">
            Health Score
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {currentWorkspace.health_score || 0}%
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${currentWorkspace.health_score || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">
            Components
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {currentWorkspace.total_components || 0}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Total components
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">
            Variables
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {currentWorkspace.total_variables || 0}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Total variables
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">
            Conflicts
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {conflicts.length}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Active conflicts
          </div>
        </div>
      </div>

      {/* Figma Files */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Figma Files</h2>
          <button
            onClick={() => setShowAddFileModal(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-2"
          >
            <Plus size={16} />
            Add Figma File
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : figmaFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No Figma files connected yet
            </div>
          ) : (
            <div className="space-y-4">
              {figmaFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">{file.name}</div>
                    <div className="text-sm text-gray-500">
                      Role: {file.role} • Status: {file.sync_status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                        px-2 py-1 text-xs font-medium rounded
                        ${
                          file.sync_status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : file.sync_status === 'syncing'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }
                      `}
                    >
                      {file.sync_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            No recent activity
          </div>
        </div>
      </div>

      {/* Add Figma File Modal */}
      <AddFigmaFileModal
        isOpen={showAddFileModal}
        onClose={() => setShowAddFileModal(false)}
      />
    </div>
  );
}
