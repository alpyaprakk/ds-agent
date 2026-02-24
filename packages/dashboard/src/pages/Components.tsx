import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PackageIcon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
        return <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-green-600" />;
      case 'warning':
        return <HugeiconsIcon icon={Alert02Icon} size={16} className="text-yellow-600" />;
      case 'error':
        return <HugeiconsIcon icon={Alert02Icon} size={16} className="text-red-600" />;
      default:
        return null;
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-muted-foreground">
          No workspace selected
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Components</h1>
        <p className="text-muted-foreground mt-2">
          Explore and manage components in your design system
        </p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Components</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{components.length}</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-green-600">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4" />
              Healthy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{statusCounts.healthy}</div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-yellow-600">
              <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4" />
              Warning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">{statusCounts.warning}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-red-600">
              <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4" />
              Error
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">{statusCounts.error}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b">
        {(['all', 'healthy', 'warning', 'error'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              'px-4 py-2 font-medium transition border-b-2 -mb-px',
              filterStatus === status
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <Badge variant="secondary" className="ml-2">
              {status === 'all' ? components.length : statusCounts[status as keyof typeof statusCounts] || 0}
            </Badge>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Components List */}
        <Card>
          <CardHeader>
            <CardTitle>Components ({filteredComponents.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : filteredComponents.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                No components found with selected filter
              </div>
            ) : (
              <div className="divide-y">
                {filteredComponents.map((component) => (
                  <button
                    key={component.id}
                    onClick={() => setSelectedComponent(component)}
                    className={cn(
                      'w-full px-6 py-4 text-left transition',
                      selectedComponent?.id === component.id
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <HugeiconsIcon icon={PackageIcon} className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{component.name}</span>
                      </div>
                      {getStatusIcon(component.status)}
                    </div>

                    {component.description && (
                      <p className="text-sm text-muted-foreground mb-3">{component.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{component.total_variants} variants</span>
                      <span>•</span>
                      <span>{component.variable_coverage}% coverage</span>
                    </div>

                    {/* Coverage Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            component.variable_coverage >= 90
                              ? 'bg-green-600'
                              : component.variable_coverage >= 70
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          )}
                          style={{ width: `${component.variable_coverage}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Component Details */}
        <Card>
          <CardHeader>
            <CardTitle>Component Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedComponent ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <HugeiconsIcon icon={PackageIcon} className="h-6 w-6 text-muted-foreground" />
                    <h3 className="text-2xl font-bold">
                      {selectedComponent.name}
                    </h3>
                  </div>
                  {selectedComponent.description && (
                    <p className="text-muted-foreground">{selectedComponent.description}</p>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge
                      variant={selectedComponent.status === 'healthy' ? 'default' : 'secondary'}
                      className={cn(
                        'gap-2',
                        selectedComponent.status === 'healthy' && 'bg-green-100 text-green-700 hover:bg-green-100',
                        selectedComponent.status === 'warning' && 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
                        selectedComponent.status === 'error' && 'bg-red-100 text-red-700 hover:bg-red-100'
                      )}
                    >
                      {getStatusIcon(selectedComponent.status)}
                      {selectedComponent.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Variable Coverage */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Variable Coverage</label>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-3xl font-bold">
                        {selectedComponent.variable_coverage}%
                      </span>
                      <Badge variant="outline">
                        {selectedComponent.missing_variables.length} missing
                      </Badge>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3">
                      <div
                        className={cn(
                          'h-3 rounded-full transition-all',
                          selectedComponent.variable_coverage >= 90
                            ? 'bg-green-600'
                            : selectedComponent.variable_coverage >= 70
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        )}
                        style={{ width: `${selectedComponent.variable_coverage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Missing Variables */}
                {selectedComponent.missing_variables.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Missing Variables
                    </label>
                    <div className="space-y-2">
                      {selectedComponent.missing_variables.map((variable, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-md"
                        >
                          <span className="text-sm font-mono text-red-700">{variable}</span>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 h-auto py-1">
                            Create
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Variants</label>
                    <div className="text-2xl font-bold">
                      {selectedComponent.total_variants}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Properties</label>
                    <div className="text-2xl font-bold">
                      {selectedComponent.total_properties}
                    </div>
                  </div>
                </div>

                {/* Last Synced */}
                {selectedComponent.last_synced && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Synced</label>
                    <div className="mt-1 flex items-center gap-2">
                      <HugeiconsIcon icon={Clock01Icon} className="h-4 w-4" />
                      <span className="text-sm">
                        {new Date(selectedComponent.last_synced).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                Select a component to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
