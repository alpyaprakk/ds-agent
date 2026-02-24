import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { Package, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface Component {
  id: string;
  name: string;
  type: string;
  description?: string;
  variable_coverage: number;
  missing_variables: string[];
  status: 'healthy' | 'warning' | 'error';
  last_synced?: string;
  total_variants?: number;
  total_properties?: number;
}

export function Components() {
  const { currentWorkspace } = useWorkspaceStore();
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'healthy' | 'warning' | 'error'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadComponents();
    }
  }, [currentWorkspace]);

  const loadComponents = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.getComponents(currentWorkspace.id);

      // Mock data for now
      const mockComponents: Component[] = [
        {
          id: '1',
          name: 'Button',
          type: 'Component',
          description: 'Primary button component with variants',
          variable_coverage: 100,
          missing_variables: [],
          status: 'healthy',
          last_synced: new Date().toISOString(),
          total_variants: 4,
          total_properties: 8,
        },
        {
          id: '2',
          name: 'Input',
          type: 'Component',
          description: 'Text input field with validation states',
          variable_coverage: 85,
          missing_variables: ['border-radius-lg', 'shadow-focus'],
          status: 'warning',
          last_synced: new Date(Date.now() - 300000).toISOString(),
          total_variants: 3,
          total_properties: 6,
        },
        {
          id: '3',
          name: 'Card',
          type: 'Component',
          description: 'Container card component',
          variable_coverage: 100,
          missing_variables: [],
          status: 'healthy',
          last_synced: new Date().toISOString(),
          total_variants: 2,
          total_properties: 5,
        },
        {
          id: '4',
          name: 'Badge',
          type: 'Component',
          description: 'Status badge with color variants',
          variable_coverage: 60,
          missing_variables: ['color-info', 'color-warning-dark', 'spacing-badge'],
          status: 'error',
          last_synced: new Date(Date.now() - 600000).toISOString(),
          total_variants: 5,
          total_properties: 4,
        },
        {
          id: '5',
          name: 'Avatar',
          type: 'Component',
          description: 'User avatar component with sizes',
          variable_coverage: 90,
          missing_variables: ['border-avatar'],
          status: 'warning',
          last_synced: new Date().toISOString(),
          total_variants: 3,
          total_properties: 4,
        },
      ];

      setComponents(mockComponents);
      setSelectedComponent(mockComponents[0]);
    } catch (error) {
      console.error('Failed to load components:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredComponents = components.filter((comp) => {
    if (filterStatus === 'all') return true;
    return comp.status === filterStatus;
  });

  const statusCounts = {
    healthy: components.filter((c) => c.status === 'healthy').length,
    warning: components.filter((c) => c.status === 'warning').length,
    error: components.filter((c) => c.status === 'error').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 size={16} className="text-green-600" />;
      case 'warning':
        return <AlertCircle size={16} className="text-yellow-600" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
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
        <h1 className="text-3xl font-bold text-gray-900">Components</h1>
        <p className="text-gray-600 mt-2">
          Explore and manage components in your design system
        </p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Total Components</div>
          <div className="text-3xl font-bold text-gray-900">{components.length}</div>
        </div>

        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <div className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} />
            Healthy
          </div>
          <div className="text-3xl font-bold text-green-900">{statusCounts.healthy}</div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
          <div className="text-sm font-medium text-yellow-600 mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            Warning
          </div>
          <div className="text-3xl font-bold text-yellow-900">{statusCounts.warning}</div>
        </div>

        <div className="bg-red-50 rounded-lg p-6 border border-red-200">
          <div className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            Error
          </div>
          <div className="text-3xl font-bold text-red-900">{statusCounts.error}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(['all', 'healthy', 'warning', 'error'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`
              px-4 py-2 font-medium transition border-b-2
              ${
                filterStatus === status
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }
            `}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-2 text-sm">
              ({status === 'all' ? components.length : statusCounts[status as keyof typeof statusCounts] || 0})
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Components List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Components ({filteredComponents.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : filteredComponents.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No components found with selected filter
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredComponents.map((component) => (
                <button
                  key={component.id}
                  onClick={() => setSelectedComponent(component)}
                  className={`
                    w-full px-6 py-4 text-left transition
                    ${
                      selectedComponent?.id === component.id
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Package size={20} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{component.name}</span>
                    </div>
                    {getStatusIcon(component.status)}
                  </div>

                  {component.description && (
                    <p className="text-sm text-gray-600 mb-3">{component.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{component.total_variants} variants</span>
                    <span>•</span>
                    <span>{component.variable_coverage}% coverage</span>
                  </div>

                  {/* Coverage Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          component.variable_coverage >= 90
                            ? 'bg-green-600'
                            : component.variable_coverage >= 70
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        }`}
                        style={{ width: `${component.variable_coverage}%` }}
                      ></div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Component Details */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Component Details</h2>
          </div>

          {selectedComponent ? (
            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Package size={24} className="text-gray-400" />
                  <h3 className="text-2xl font-bold text-gray-900">
                    {selectedComponent.name}
                  </h3>
                </div>
                {selectedComponent.description && (
                  <p className="text-gray-600">{selectedComponent.description}</p>
                )}
              </div>

              {/* Status Badge */}
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <span
                    className={`
                      inline-flex items-center gap-2 px-3 py-1 rounded-lg border font-medium
                      ${getStatusColor(selectedComponent.status)}
                    `}
                  >
                    {getStatusIcon(selectedComponent.status)}
                    {selectedComponent.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Variable Coverage */}
              <div>
                <label className="text-sm font-medium text-gray-500">Variable Coverage</label>
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {selectedComponent.variable_coverage}%
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedComponent.missing_variables.length} missing
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        selectedComponent.variable_coverage >= 90
                          ? 'bg-green-600'
                          : selectedComponent.variable_coverage >= 70
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${selectedComponent.variable_coverage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Missing Variables */}
              {selectedComponent.missing_variables.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">
                    Missing Variables
                  </label>
                  <div className="space-y-2">
                    {selectedComponent.missing_variables.map((variable, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <span className="text-sm font-mono text-red-700">{variable}</span>
                        <button className="text-xs text-red-600 hover:text-red-700 font-medium">
                          Create
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Variants</label>
                  <div className="text-2xl font-bold text-gray-900">
                    {selectedComponent.total_variants}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Properties</label>
                  <div className="text-2xl font-bold text-gray-900">
                    {selectedComponent.total_properties}
                  </div>
                </div>
              </div>

              {/* Last Synced */}
              {selectedComponent.last_synced && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Synced</label>
                  <div className="mt-1 flex items-center gap-2 text-gray-700">
                    <Clock size={16} />
                    <span className="text-sm">
                      {new Date(selectedComponent.last_synced).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              Select a component to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
