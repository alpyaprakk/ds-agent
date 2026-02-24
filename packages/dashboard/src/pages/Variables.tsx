import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { ChevronRight, ChevronDown, Edit2, Plus, AlertCircle } from 'lucide-react';

interface Variable {
  id: string;
  collection_id: string;
  name: string;
  value: string;
  type: string;
  description?: string;
  is_alias: boolean;
  alias_target?: string;
  usage_count?: number;
}

interface Collection {
  id: string;
  name: string;
  variables: Variable[];
}

export function Variables() {
  const { currentWorkspace } = useWorkspaceStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [selectedVariable, setSelectedVariable] = useState<Variable | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadVariables();
    }
  }, [currentWorkspace]);

  const loadVariables = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.getVariables(currentWorkspace.id);

      // Mock data for now
      const mockCollections: Collection[] = [
        {
          id: 'colors',
          name: 'Colors',
          variables: [
            { id: '1', collection_id: 'colors', name: 'Primary', value: '#3B82F6', type: 'COLOR', is_alias: false, usage_count: 15 },
            { id: '2', collection_id: 'colors', name: 'Secondary', value: '#6B7280', type: 'COLOR', is_alias: false, usage_count: 8 },
            { id: '3', collection_id: 'colors', name: 'Success', value: '#10B981', type: 'COLOR', is_alias: false, usage_count: 5 },
            { id: '4', collection_id: 'colors', name: 'Error', value: '#EF4444', type: 'COLOR', is_alias: false, usage_count: 3 },
          ],
        },
        {
          id: 'spacing',
          name: 'Spacing',
          variables: [
            { id: '5', collection_id: 'spacing', name: 'XS', value: '4', type: 'FLOAT', is_alias: false, usage_count: 12 },
            { id: '6', collection_id: 'spacing', name: 'SM', value: '8', type: 'FLOAT', is_alias: false, usage_count: 18 },
            { id: '7', collection_id: 'spacing', name: 'MD', value: '16', type: 'FLOAT', is_alias: false, usage_count: 22 },
            { id: '8', collection_id: 'spacing', name: 'LG', value: '24', type: 'FLOAT', is_alias: false, usage_count: 14 },
          ],
        },
        {
          id: 'typography',
          name: 'Typography',
          variables: [
            { id: '9', collection_id: 'typography', name: 'Font Size SM', value: '14', type: 'FLOAT', is_alias: false, usage_count: 10 },
            { id: '10', collection_id: 'typography', name: 'Font Size MD', value: '16', type: 'FLOAT', is_alias: false, usage_count: 15 },
            { id: '11', collection_id: 'typography', name: 'Font Size LG', value: '18', type: 'FLOAT', is_alias: false, usage_count: 8 },
          ],
        },
      ];

      setCollections(mockCollections);
      // Auto-expand first collection
      setExpandedCollections(new Set(['colors']));
    } catch (error) {
      console.error('Failed to load variables:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollection = (collectionId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Variables</h1>
          <p className="text-gray-600 mt-2">
            Manage design tokens and variables across your design system
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2">
          <Plus size={16} />
          Add Variable
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Total Variables</div>
          <div className="text-3xl font-bold text-gray-900">
            {collections.reduce((sum, col) => sum + col.variables.length, 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Collections</div>
          <div className="text-3xl font-bold text-gray-900">{collections.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Aliases</div>
          <div className="text-3xl font-bold text-gray-900">
            {collections.reduce((sum, col) => sum + col.variables.filter((v) => v.is_alias).length, 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Total Usage</div>
          <div className="text-3xl font-bold text-gray-900">
            {collections.reduce((sum, col) => sum + col.variables.reduce((s, v) => s + (v.usage_count || 0), 0), 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Collections Tree */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="p-4">
              {collections.map((collection) => (
                <div key={collection.id} className="mb-2">
                  <button
                    onClick={() => toggleCollection(collection.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition text-left"
                  >
                    {expandedCollections.has(collection.id) ? (
                      <ChevronDown size={16} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-500" />
                    )}
                    <span className="font-medium text-gray-900">{collection.name}</span>
                    <span className="ml-auto text-sm text-gray-500">
                      {collection.variables.length}
                    </span>
                  </button>

                  {expandedCollections.has(collection.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {collection.variables.map((variable) => (
                        <button
                          key={variable.id}
                          onClick={() => setSelectedVariable(variable)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left
                            ${
                              selectedVariable?.id === variable.id
                                ? 'bg-blue-50 text-blue-700'
                                : 'hover:bg-gray-50 text-gray-700'
                            }
                          `}
                        >
                          {variable.type === 'COLOR' && (
                            <div
                              className="w-4 h-4 rounded border border-gray-300"
                              style={{ backgroundColor: variable.value }}
                            />
                          )}
                          <span className="text-sm flex-1">{variable.name}</span>
                          {variable.is_alias && (
                            <AlertCircle size={14} className="text-blue-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variable Details */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Variable Details</h2>
            {selectedVariable && (
              <button className="text-blue-600 hover:text-blue-700 transition flex items-center gap-2">
                <Edit2 size={16} />
                Edit
              </button>
            )}
          </div>

          {selectedVariable ? (
            <div className="p-6 space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {selectedVariable.name}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Value</label>
                <div className="mt-1 flex items-center gap-3">
                  {selectedVariable.type === 'COLOR' && (
                    <div
                      className="w-8 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: selectedVariable.value }}
                    />
                  )}
                  <span className="text-lg font-mono text-gray-900">
                    {selectedVariable.value}
                    {selectedVariable.type === 'FLOAT' && 'px'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <div className="mt-1 text-gray-900">{selectedVariable.type}</div>
              </div>

              {selectedVariable.is_alias && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Alias Target</label>
                  <div className="mt-1 text-gray-900">
                    {selectedVariable.alias_target || 'N/A'}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500">Usage Count</label>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {selectedVariable.usage_count || 0}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Used in {selectedVariable.usage_count || 0} component
                  {selectedVariable.usage_count !== 1 ? 's' : ''}
                </p>
              </div>

              {selectedVariable.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <div className="mt-1 text-gray-900">{selectedVariable.description}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              Select a variable to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
