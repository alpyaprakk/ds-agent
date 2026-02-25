import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  ArrowDown01Icon,
  Edit02Icon,
  Add01Icon,
  Alert02Icon,
  Search01Icon,
  PackageIcon,
  GridIcon,
  TextFontIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

const collectionIcons: Record<string, typeof PackageIcon> = {
  colors: PackageIcon,
  spacing: GridIcon,
  typography: TextFontIcon,
};

export function Variables() {
  const { currentWorkspace } = useWorkspaceStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [selectedVariable, setSelectedVariable] = useState<Variable | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredCollections = collections.map((col) => ({
    ...col,
    variables: searchQuery
      ? col.variables.filter((v) =>
          v.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : col.variables,
  })).filter((col) => !searchQuery || col.variables.length > 0);

  const totalVariables = collections.reduce((sum, col) => sum + col.variables.length, 0);
  const totalAliases = collections.reduce((sum, col) => sum + col.variables.filter((v) => v.is_alias).length, 0);
  const totalUsage = collections.reduce((sum, col) => sum + col.variables.reduce((s, v) => s + (v.usage_count || 0), 0), 0);

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
          <h1 className="text-lg font-bold tracking-tight">Variables</h1>
          <p className="text-muted-foreground mt-2 text-xs">
            Manage design tokens and variables across your design system
          </p>
        </div>
        <Button>
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Total Variables</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <HugeiconsIcon icon={PackageIcon} className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVariables}</div>
            <p className="text-xs text-muted-foreground mt-2">Across {collections.length} collections</p>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Collections</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <HugeiconsIcon icon={GridIcon} className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{collections.length}</div>
            <p className="text-xs text-muted-foreground mt-2">Variable groups</p>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Aliases</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAliases}</div>
            <p className="text-xs text-muted-foreground mt-2">Linked references</p>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Total Usage</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <HugeiconsIcon icon={TextFontIcon} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage}</div>
            <p className="text-xs text-muted-foreground mt-2">Component references</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections Tree */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Collections</CardTitle>
              <Badge variant="secondary">{filteredCollections.length}</Badge>
            </div>
            <div className="relative mt-3">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search variables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
            ) : filteredCollections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {searchQuery ? 'No variables match your search' : 'No variables found'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCollections.map((collection) => {
                  const IconComp = collectionIcons[collection.id] || PackageIcon;
                  return (
                    <div key={collection.id}>
                      <button
                        onClick={() => toggleCollection(collection.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                      >
                        <HugeiconsIcon
                          icon={expandedCollections.has(collection.id) ? ArrowDown01Icon : ArrowRight01Icon}
                          className="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                          <HugeiconsIcon icon={IconComp} className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-sm flex-1">{collection.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {collection.variables.length}
                        </Badge>
                      </button>

                      {expandedCollections.has(collection.id) && (
                        <div className="ml-6 mt-0.5 mb-1 space-y-0.5 border-l border-border/50 pl-3">
                          {collection.variables.map((variable) => (
                            <button
                              key={variable.id}
                              onClick={() => setSelectedVariable(variable)}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                                selectedVariable?.id === variable.id
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'hover:bg-muted/50'
                              )}
                            >
                              {variable.type === 'COLOR' ? (
                                <div
                                  className="w-4 h-4 rounded-sm border border-border/50 flex-shrink-0"
                                  style={{ backgroundColor: variable.value }}
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-sm bg-muted border border-border/50 flex-shrink-0 flex items-center justify-center">
                                  <span className="text-[8px] font-mono text-muted-foreground">
                                    {variable.type === 'FLOAT' ? '#' : 'T'}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm flex-1 truncate">{variable.name}</span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {variable.type === 'COLOR' ? variable.value : `${variable.value}px`}
                              </span>
                              {variable.is_alias && (
                                <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                {/* Name & Type Header */}
                <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                  {selectedVariable.type === 'COLOR' ? (
                    <div
                      className="w-12 h-12 rounded-lg border border-border/50 flex-shrink-0"
                      style={{ backgroundColor: selectedVariable.value }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted border border-border/50 flex-shrink-0 flex items-center justify-center">
                      <span className="text-lg font-mono text-muted-foreground">
                        {selectedVariable.value}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{selectedVariable.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px]">{selectedVariable.type}</Badge>
                      {selectedVariable.is_alias && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                          Alias
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Value */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</label>
                  <div className="mt-2 flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                    {selectedVariable.type === 'COLOR' && (
                      <div
                        className="w-8 h-8 rounded-md border border-border/50"
                        style={{ backgroundColor: selectedVariable.value }}
                      />
                    )}
                    <code className="text-sm font-mono text-foreground">
                      {selectedVariable.value}
                      {selectedVariable.type === 'FLOAT' && 'px'}
                    </code>
                  </div>
                </div>

                {selectedVariable.is_alias && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alias Target</label>
                    <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                      <code className="text-sm font-mono">{selectedVariable.alias_target || 'N/A'}</code>
                    </div>
                  </div>
                )}

                {/* Usage */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Usage</label>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="text-xl font-bold">
                      {selectedVariable.usage_count || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Used in {selectedVariable.usage_count || 0} component
                      {selectedVariable.usage_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {selectedVariable.description && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                    <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                      <p className="text-sm">{selectedVariable.description}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted mx-auto mb-3">
                  <HugeiconsIcon icon={PackageIcon} className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Select a variable to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
