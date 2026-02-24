import { useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

export function WorkspaceSelector() {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSelectWorkspace = (workspace: any) => {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition flex items-center justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">
              {currentWorkspace?.icon || '📦'}
            </span>
            <span className="font-medium text-gray-900 truncate">
              {currentWorkspace?.name || 'Select Workspace'}
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-500 flex-shrink-0 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 max-h-80 overflow-y-auto">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleSelectWorkspace(workspace)}
                  className="w-full px-4 py-2 hover:bg-gray-50 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">{workspace.icon}</span>
                    <div className="text-left min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {workspace.name}
                      </div>
                      {workspace.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {workspace.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <Check size={16} className="text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))}

              <div className="border-t border-gray-200 mt-2 pt-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full px-4 py-2 hover:bg-blue-50 transition flex items-center gap-3 text-blue-600 font-medium"
                >
                  <Plus size={16} />
                  Create New Workspace
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}
