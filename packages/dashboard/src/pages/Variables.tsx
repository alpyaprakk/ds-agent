import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  ArrowDown01Icon,
  Edit02Icon,
  Add01Icon,
  Alert02Icon
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
        <div className="text-center py-12 text-muted-foreground">
          No workspace selected
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Variables</h1>
          <p className="text-muted-foreground mt-2">
            Manage design tokens and variables across your design system
          </p>
        </div>
        <Button>
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Variables</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {collections.reduce((sum, col) => sum + col.variables.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Collections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{collections.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Aliases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {collections.reduce((sum, col) => sum + col.variables.filter((v) => v.is_alias).length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {collections.reduce((sum, col) => sum + col.variables.reduce((s, v) => s + (v.usage_count || 0), 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Collections Tree */}
        <Card>
          <CardHeader>
            <CardTitle>Collections</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2">
                {collections.map((collection) => (
                  <div key={collection.id}>
                    <button
                      onClick={() => toggleCollection(collection.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition text-left"
                    >
                      {expandedCollections.has(collection.id) ? (
                        <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{collection.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {collection.variables.length}
                      </Badge>
                    </button>

                    {expandedCollections.has(collection.id) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {collection.variables.map((variable) => (
                          <button
                            key={variable.id}
                            onClick={() => setSelectedVariable(variable)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2 rounded-md transition text-left',
                              selectedVariable?.id === variable.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-accent'
                            )}
                          >
                            {variable.type === 'COLOR' && (
                              <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: variable.value }}
                              />
                            )}
                            <span className="text-sm flex-1">{variable.name}</span>
                            {variable.is_alias && (
                              <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variable Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Variable Details</CardTitle>
              {selectedVariable && (
                <Button variant="ghost" size="sm">
                  <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedVariable ? (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <div className="mt-1 text-lg font-semibold">
                    {selectedVariable.name}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Value</label>
                  <div className="mt-1 flex items-center gap-3">
                    {selectedVariable.type === 'COLOR' && (
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: selectedVariable.value }}
                      />
                    )}
                    <span className="text-lg font-mono">
                      {selectedVariable.value}
                      {selectedVariable.type === 'FLOAT' && 'px'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <div className="mt-1">
                    <Badge variant="secondary">{selectedVariable.type}</Badge>
                  </div>
                </div>

                {selectedVariable.is_alias && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Alias Target</label>
                    <div className="mt-1">
                      {selectedVariable.alias_target || 'N/A'}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Usage Count</label>
                  <div className="mt-1 text-2xl font-bold">
                    {selectedVariable.usage_count || 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Used in {selectedVariable.usage_count || 0} component
                    {selectedVariable.usage_count !== 1 ? 's' : ''}
                  </p>
                </div>

                {selectedVariable.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <div className="mt-1">{selectedVariable.description}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                Select a variable to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
