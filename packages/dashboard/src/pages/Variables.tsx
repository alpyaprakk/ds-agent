import { useEffect, useState, useMemo } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { apiClient, VariableCollection, DesignVariable } from '../lib/api-client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  ArrowDown01Icon,
  Search01Icon,
  PackageIcon,
  PaintBoardIcon,
  TextFontIcon,
  GridIcon,
} from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Build a tree structure from variable names (grouped by "/" path segments)
interface GroupNode {
  name: string;
  path: string;
  children: Map<string, GroupNode>;
  variables: DesignVariable[];
  count: number;
}

function buildGroupTree(variables: DesignVariable[]): GroupNode {
  const root: GroupNode = { name: '', path: '', children: new Map(), variables: [], count: 0 };

  for (const v of variables) {
    const parts = v.name.split('/');
    if (parts.length <= 1) {
      root.variables.push(v);
      continue;
    }

    let current = root;
    // All parts except the last are group segments
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i].trim();
      if (!current.children.has(segment)) {
        const childPath = current.path ? `${current.path}/${segment}` : segment;
        current.children.set(segment, {
          name: segment,
          path: childPath,
          children: new Map(),
          variables: [],
          count: 0,
        });
      }
      current = current.children.get(segment)!;
    }
    current.variables.push(v);
  }

  // Compute counts bottom-up
  function computeCount(node: GroupNode): number {
    let count = node.variables.length;
    for (const child of node.children.values()) {
      count += computeCount(child);
    }
    node.count = count;
    return count;
  }
  computeCount(root);

  return root;
}

function getVariableLeafName(name: string): string {
  const parts = name.split('/');
  return parts[parts.length - 1].trim();
}

function extractColor(val: any): string | null {
  if (val && typeof val === 'object' && 'r' in val) {
    const r = Math.round((val.r ?? 0) * 255);
    const g = Math.round((val.g ?? 0) * 255);
    const b = Math.round((val.b ?? 0) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return null;
}

function renderValue(
  variable: DesignVariable,
  aliasMap: Map<string, string>,
  variablesByFigmaId: Map<string, DesignVariable>
): { color: string | null; label: string; isAlias: boolean } {
  const value = variable.value;
  if (!value) return { color: null, label: '—', isAlias: false };

  const modeValues = typeof value === 'object' && !Array.isArray(value) ? Object.values(value) : [value];
  const firstVal = modeValues[0] as any;

  if (firstVal === undefined || firstVal === null) return { color: null, label: '—', isAlias: false };

  // Alias reference
  if (typeof firstVal === 'object' && firstVal.type === 'VARIABLE_ALIAS') {
    const aliasId = firstVal.id as string;
    // firstVal.name is set by server during sync, aliasMap is a frontend fallback
    const resolvedName = firstVal.name || aliasMap.get(aliasId);
    const displayName = resolvedName && resolvedName !== aliasId ? resolvedName : aliasId;

    // If this is a COLOR variable, resolve the target's color for the swatch
    let resolvedColor: string | null = null;
    if (variable.type === 'COLOR') {
      const target = variablesByFigmaId.get(aliasId);
      if (target) {
        resolvedColor = resolveColor(target, variablesByFigmaId);
      }
    }

    return { color: resolvedColor, label: displayName, isAlias: true };
  }

  if (variable.type === 'COLOR') {
    const hex = extractColor(firstVal);
    if (hex) {
      return { color: hex, label: hex.toUpperCase(), isAlias: false };
    }

    // String alias like "Colors/Base/white"
    if (typeof firstVal === 'string') {
      return { color: null, label: firstVal, isAlias: false };
    }
  }

  // FLOAT
  if (typeof firstVal === 'number') {
    return { color: null, label: String(firstVal), isAlias: false };
  }

  // STRING
  if (typeof firstVal === 'string') {
    return { color: null, label: firstVal, isAlias: false };
  }

  // BOOLEAN
  if (typeof firstVal === 'boolean') {
    return { color: null, label: firstVal ? 'true' : 'false', isAlias: false };
  }

  return { color: null, label: JSON.stringify(firstVal), isAlias: false };
}

// Recursively resolve the actual color value, following alias chains (max 10 depth)
function resolveColor(variable: DesignVariable, variablesByFigmaId: Map<string, DesignVariable>, depth = 0): string | null {
  if (depth > 10) return null;
  const val = variable.value;
  if (!val) return null;

  const modeValues = typeof val === 'object' && !Array.isArray(val) ? Object.values(val) : [val];
  const firstVal = modeValues[0] as any;
  if (!firstVal) return null;

  // If it's a direct color value
  const hex = extractColor(firstVal);
  if (hex) return hex;

  // If it's another alias, follow the chain
  if (typeof firstVal === 'object' && firstVal.type === 'VARIABLE_ALIAS' && firstVal.id) {
    const next = variablesByFigmaId.get(firstVal.id);
    if (next) return resolveColor(next, variablesByFigmaId, depth + 1);
  }

  return null;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'COLOR': return PaintBoardIcon;
    case 'FLOAT': return GridIcon;
    case 'STRING': return TextFontIcon;
    default: return PackageIcon;
  }
}

export function Variables() {
  const { currentWorkspace } = useWorkspaceStore();
  const [collections, setCollections] = useState<VariableCollection[]>([]);
  const [allVariables, setAllVariables] = useState<DesignVariable[]>([]);
  const [variables, setVariables] = useState<DesignVariable[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      loadData();
    }
  }, [currentWorkspace]);

  const loadData = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const [colRes, varRes] = await Promise.all([
        apiClient.getCollections(currentWorkspace.id),
        apiClient.getVariables(currentWorkspace.id),
      ]);
      setCollections(colRes.collections);
      setAllVariables(varRes.variables);
      setVariables(varRes.variables);
    } catch (error) {
      console.error('Failed to load variables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionSelect = async (figmaId: string | null) => {
    setSelectedCollectionId(figmaId);
    setSelectedGroup(null);
    setExpandedGroups(new Set());

    if (!currentWorkspace) return;
    try {
      const res = await apiClient.getVariables(currentWorkspace.id, figmaId || undefined);
      setVariables(res.variables);
    } catch (error) {
      console.error('Failed to load variables:', error);
    }
  };

  // Filter variables by search
  const filteredVariables = useMemo(() => {
    if (!searchQuery) return variables;
    const q = searchQuery.toLowerCase();
    return variables.filter(v => v.name.toLowerCase().includes(q));
  }, [variables, searchQuery]);

  // Build group tree
  const groupTree = useMemo(() => buildGroupTree(filteredVariables), [filteredVariables]);

  // Get visible variables based on selected group
  const visibleVariables = useMemo(() => {
    if (!selectedGroup) return filteredVariables;
    return filteredVariables.filter(v => {
      const parts = v.name.split('/');
      const varGroupPath = parts.slice(0, -1).map(p => p.trim()).join('/');
      return varGroupPath === selectedGroup || varGroupPath.startsWith(selectedGroup + '/');
    });
  }, [filteredVariables, selectedGroup]);

  // Group visible variables by their parent path for display
  const groupedVariables = useMemo(() => {
    const groups = new Map<string, DesignVariable[]>();

    for (const v of visibleVariables) {
      const parts = v.name.split('/');
      const groupPath = parts.length > 1 ? parts.slice(0, -1).map(p => p.trim()).join(' / ') : '';
      if (!groups.has(groupPath)) {
        groups.set(groupPath, []);
      }
      groups.get(groupPath)!.push(v);
    }

    return groups;
  }, [visibleVariables]);

  // Build alias lookup: figma_id → variable name (for resolving VARIABLE_ALIAS references)
  // Uses allVariables so aliases across collections can still be resolved
  const aliasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of allVariables) {
      if (v.figma_id) {
        map.set(v.figma_id, v.name);
      }
      if (v.figma_key) {
        map.set(v.figma_key, v.name);
      }
    }
    return map;
  }, [allVariables]);

  // Build figma_id → variable lookup for resolving alias color values
  const variablesByFigmaId = useMemo(() => {
    const map = new Map<string, DesignVariable>();
    for (const v of allVariables) {
      if (v.figma_id) {
        map.set(v.figma_id, v);
      }
      if (v.figma_key) {
        map.set(v.figma_key, v);
      }
    }
    return map;
  }, [allVariables]);

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const totalVariables = variables.length;
  const colorCount = variables.filter(v => v.type === 'COLOR').length;
  const floatCount = variables.filter(v => v.type === 'FLOAT').length;
  const stringCount = variables.filter(v => v.type === 'STRING').length;
  const booleanCount = variables.filter(v => v.type === 'BOOLEAN').length;

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-muted-foreground">
          No workspace selected
        </div>
      </div>
    );
  }

  // Render the sidebar group tree recursively
  const renderGroupTree = (node: GroupNode, depth: number = 0): React.ReactNode => {
    const entries = Array.from(node.children.entries());
    if (entries.length === 0) return null;

    return entries.map(([, child]) => {
      const hasChildren = child.children.size > 0;
      const isExpanded = expandedGroups.has(child.path);
      const isSelected = selectedGroup === child.path;

      return (
        <div key={child.path}>
          <button
            onClick={() => {
              if (hasChildren) toggleGroup(child.path);
              setSelectedGroup(child.path);
            }}
            className={cn(
              'w-full flex items-center gap-1.5 py-1.5 pr-2 text-left text-[13px] rounded-md transition-colors hover:bg-muted/50',
              isSelected && 'bg-primary/10 text-primary font-medium',
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {hasChildren ? (
              <HugeiconsIcon
                icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
                size={12}
                className="text-muted-foreground flex-shrink-0"
              />
            ) : (
              <span className="w-3 flex-shrink-0" />
            )}
            <span className="flex-1 truncate">{child.name}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{child.count}</span>
          </button>
          {hasChildren && isExpanded && renderGroupTree(child, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left Sidebar */}
      <div className="w-56 border-r flex flex-col flex-shrink-0 bg-card">
        {/* Search */}
        <div className="p-2.5 border-b">
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Collections */}
          <div className="p-1.5">
            <div className="px-2 py-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Collections</span>
            </div>
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => handleCollectionSelect(
                  selectedCollectionId === col.figma_id ? null : col.figma_id
                )}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-[13px] rounded-md transition-colors text-left',
                  selectedCollectionId === col.figma_id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-foreground hover:bg-muted/50'
                )}
              >
                <span className="flex-1 truncate">{col.name}</span>
                <span className={cn(
                  'text-[11px] tabular-nums',
                  selectedCollectionId === col.figma_id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {col.variable_count}
                </span>
              </button>
            ))}
            {collections.length === 0 && !loading && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No collections yet. Sync a Figma file to get started.
              </p>
            )}
          </div>

          <Separator className="mx-2" />

          {/* Groups */}
          <div className="p-1.5">
            <div className="px-2 py-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Groups</span>
            </div>
            <button
              onClick={() => setSelectedGroup(null)}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] rounded-md transition-colors text-left',
                selectedGroup === null
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-muted/50'
              )}
            >
              <span className="flex-1">All</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{filteredVariables.length}</span>
            </button>
            {renderGroupTree(groupTree)}
          </div>

          {/* Type summary */}
          {totalVariables > 0 && (
            <>
              <Separator className="mx-2" />
              <div className="p-1.5 pb-4">
                <div className="px-2 py-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Types</span>
                </div>
                {colorCount > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-blue-500 to-purple-500" />
                    <span className="flex-1">Color</span>
                    <span className="text-[11px] tabular-nums">{colorCount}</span>
                  </div>
                )}
                {floatCount > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                    <span className="w-3 h-3 flex items-center justify-center text-[8px] font-bold">#</span>
                    <span className="flex-1">Number</span>
                    <span className="text-[11px] tabular-nums">{floatCount}</span>
                  </div>
                )}
                {stringCount > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                    <span className="w-3 h-3 flex items-center justify-center text-[8px] font-bold">T</span>
                    <span className="flex-1">String</span>
                    <span className="text-[11px] tabular-nums">{stringCount}</span>
                  </div>
                )}
                {booleanCount > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                    <span className="w-3 h-3 flex items-center justify-center text-[8px] font-bold">B</span>
                    <span className="flex-1">Boolean</span>
                    <span className="text-[11px] tabular-nums">{booleanCount}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </ScrollArea>
      </div>

      {/* Main Content - Variable Table */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Table Header */}
        <div className="flex items-center border-b bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex-shrink-0">
          <div className="flex-1 px-4 py-2.5">Name</div>
          <div className="w-[320px] px-4 py-2.5 border-l flex-shrink-0">Value</div>
        </div>

        {/* Table Body */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Loading variables...
            </div>
          ) : visibleVariables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted mb-3">
                <HugeiconsIcon icon={PackageIcon} size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm">
                {searchQuery ? 'No variables match your search' : 'No variables found'}
              </p>
              {!searchQuery && (
                <p className="text-xs mt-1">Sync a Figma file to populate variables</p>
              )}
            </div>
          ) : (
            <div>
              {Array.from(groupedVariables.entries()).map(([groupPath, vars]) => (
                <div key={groupPath || '__root__'}>
                  {/* Group Header */}
                  {groupPath && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 border-b border-border/40">
                      <span className="text-[12px] font-medium text-muted-foreground">
                        {groupPath}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {vars.length}
                      </Badge>
                    </div>
                  )}

                  {/* Variables in this group */}
                  {vars.map((variable) => {
                    const { color, label, isAlias } = renderValue(variable, aliasMap, variablesByFigmaId);
                    const Icon = getTypeIcon(variable.type);
                    const leafName = getVariableLeafName(variable.name);

                    return (
                      <div
                        key={variable.id}
                        className="flex items-center border-b border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        {/* Name column */}
                        <div className="flex-1 flex items-center gap-2.5 px-4 py-2 min-w-0">
                          <HugeiconsIcon icon={Icon} size={14} className="text-muted-foreground flex-shrink-0 opacity-60" />
                          <span className="text-[13px] truncate">{leafName}</span>
                        </div>

                        {/* Value column */}
                        <div className="w-[320px] flex items-center gap-2.5 px-4 py-2 border-l border-border/30 flex-shrink-0">
                          {isAlias ? (
                            <div className="inline-flex items-center gap-2.5 rounded-md outline outline-1 outline-border/40 -outline-offset-1 bg-muted/25 px-2.5 py-1 -mx-2.5 -my-1 max-w-full">
                              {color ? (
                                <div
                                  className="w-4 h-4 rounded-[3px] border border-border/50 flex-shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                              ) : (
                                <HugeiconsIcon icon={Icon} size={14} className="text-muted-foreground flex-shrink-0 opacity-60" />
                              )}
                              <span className="text-[13px] text-primary/80 truncate">
                                {label}
                              </span>
                            </div>
                          ) : (
                            <>
                              {color && (
                                <div
                                  className="w-4 h-4 rounded-[3px] border border-border/50 flex-shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                              )}
                              {variable.type === 'COLOR' && !color && (
                                <div className="w-4 h-4 rounded-[3px] border border-border/50 bg-muted flex-shrink-0" />
                              )}
                              <span className="text-[13px] text-muted-foreground truncate">
                                {label}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t bg-muted/20 text-[11px] text-muted-foreground flex-shrink-0">
          <span>
            {visibleVariables.length} variable{visibleVariables.length !== 1 ? 's' : ''}
            {selectedGroup && ` in ${selectedGroup}`}
          </span>
          <span>{collections.length} collection{collections.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
