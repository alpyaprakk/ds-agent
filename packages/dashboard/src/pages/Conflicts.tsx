import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';

export function Conflicts() {
  const {
    currentWorkspace,
    conflicts,
    resolveConflict,
    dismissConflict,
    loading,
  } = useWorkspaceStore();

  useEffect(() => {
    if (currentWorkspace) {
      // Conflicts are already fetched when workspace is set
    }
  }, [currentWorkspace]);

  const handleResolve = async (conflictId: string, chosen: string) => {
    try {
      await resolveConflict(conflictId, {
        method: 'manual',
        chosen,
        resolvedBy: 'user', // TODO: Get actual user
      });
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  };

  const handleDismiss = async (conflictId: string) => {
    try {
      await dismissConflict(conflictId, 'user'); // TODO: Get actual user
    } catch (error) {
      console.error('Failed to dismiss conflict:', error);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-gray-500">
          No workspace selected
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Conflicts</h1>
        <p className="text-gray-600 mt-2">
          Manage and resolve conflicts in your design system
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-red-50 rounded-lg p-6 border border-red-200">
          <div className="text-sm font-medium text-red-600 mb-2">High Priority</div>
          <div className="text-3xl font-bold text-red-900">
            {conflicts.filter((c) => c.severity === 'high').length}
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
          <div className="text-sm font-medium text-yellow-600 mb-2">
            Medium Priority
          </div>
          <div className="text-3xl font-bold text-yellow-900">
            {conflicts.filter((c) => c.severity === 'medium').length}
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="text-sm font-medium text-blue-600 mb-2">Low Priority</div>
          <div className="text-3xl font-bold text-blue-900">
            {conflicts.filter((c) => c.severity === 'low').length}
          </div>
        </div>
      </div>

      {/* Conflicts List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Conflicts</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : conflicts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Active Conflicts
            </h3>
            <p className="text-gray-600">
              Your design system is in sync. Great work!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`
                          px-2 py-1 text-xs font-medium rounded
                          ${
                            conflict.severity === 'high'
                              ? 'bg-red-100 text-red-700'
                              : conflict.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }
                        `}
                      >
                        {conflict.severity.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {conflict.entity_type}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {conflict.entity_name || 'Unnamed Entity'}
                    </h3>

                    {conflict.description && (
                      <p className="text-gray-600">{conflict.description}</p>
                    )}

                    <div className="text-sm text-gray-500 mt-2">
                      Created: {new Date(conflict.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleResolve(conflict.id, 'source2')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
                    Keep Designer's Version
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'source1')}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                  >
                    Keep Agent's Version
                  </button>
                  <button
                    onClick={() => handleDismiss(conflict.id)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
