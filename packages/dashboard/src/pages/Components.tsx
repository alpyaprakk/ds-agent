import { useEffect, useState, useMemo, useCallback } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { apiClient, DesignComponent } from '../lib/api-client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  ArrowDown01Icon,
  Search01Icon,
  PackageIcon,
  Layers01Icon,
  TextIcon,
} from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Group components by their parent (from properties.parent)
function groupByParent(components: DesignComponent[]): Map<string, DesignComponent[]> {
  const groups = new Map<string, DesignComponent[]>();

  for (const c of components) {
    const parent = c.properties?.parent || '';
    if (!groups.has(parent)) {
      groups.set(parent, []);
    }
    groups.get(parent)!.push(c);
  }

  return groups;
}

// Build sidebar tree from parent names
interface ParentNode {
  name: string;
  count: number;
  children: Map<string, ParentNode>;
}

function buildParentTree(components: DesignComponent[]): ParentNode {
  const root: ParentNode = { name: '', count: components.length, children: new Map() };

  // Group by parent
  const parentCounts = new Map<string, number>();
  for (const c of components) {
    const parent = c.properties?.parent || '';
    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
  }

  // Sort parents alphabetically and add as flat children
  const sortedParents = Array.from(parentCounts.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [parent, count] of sortedParents) {
    if (parent) {
      root.children.set(parent, { name: parent, count, children: new Map() });
    }
  }

  return root;
}

export function Components() {
  const { currentWorkspace, lastSyncAt } = useWorkspaceStore();
  const [components, setComponents] = useState<DesignComponent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<DesignComponent | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadComponents = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await apiClient.getComponents(currentWorkspace.id);
      setComponents(res.components);
    } catch (error) {
      console.error('Failed to load components:', error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (currentWorkspace) {
      loadComponents();
    }
  }, [currentWorkspace, lastSyncAt, loadComponents]);

  // Filter by search
  const filteredComponents = useMemo(() => {
    if (!searchQuery) return components;
    const q = searchQuery.toLowerCase();
    return components.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.properties?.parent?.toLowerCase().includes(q)
    );
  }, [components, searchQuery]);

  // Build parent tree for sidebar
  const parentTree = useMemo(() => buildParentTree(filteredComponents), [filteredComponents]);

  // Visible components (filtered by selected parent)
  const visibleComponents = useMemo(() => {
    if (!selectedParent) return filteredComponents;
    return filteredComponents.filter(c => (c.properties?.parent || '') === selectedParent);
  }, [filteredComponents, selectedParent]);

  // Group visible components by parent for main display
  const groupedComponents = useMemo(() => groupByParent(visibleComponents), [visibleComponents]);

  // Stats
  const totalCount = components.length;
  const withDescription = components.filter(c => c.description && c.description.trim()).length;
  const withoutDescription = totalCount - withDescription;

  // Unique parent count
  const uniqueParents = useMemo(() => {
    const parents = new Set<string>();
    for (const c of components) {
      const p = c.properties?.parent;
      if (p) parents.add(p);
    }
    return parents.size;
  }, [components]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
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
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left Sidebar */}
      <div className="w-56 border-r flex flex-col flex-shrink-0 bg-card">
        {/* Search */}
        <div className="h-[48px] px-2.5 flex items-center border-b flex-shrink-0">
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

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Parent Groups */}
          <div className="p-1.5">
            <div className="px-2 py-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Groups</span>
            </div>
            <button
              onClick={() => {
                setSelectedParent(null);
                setSelectedComponent(null);
              }}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] rounded-md transition-colors text-left',
                selectedParent === null
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-foreground hover:bg-muted/50'
              )}
            >
              <span className="flex-1">All Components</span>
              <span className={cn(
                'text-[11px] tabular-nums',
                selectedParent === null ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}>
                {filteredComponents.length}
              </span>
            </button>
            {Array.from(parentTree.children.entries()).map(([name, node]) => (
              <button
                key={name}
                onClick={() => {
                  setSelectedParent(selectedParent === name ? null : name);
                  setSelectedComponent(null);
                }}
                className={cn(
                  'w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] rounded-md transition-colors text-left',
                  selectedParent === name
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-foreground hover:bg-muted/50'
                )}
              >
                <span className="flex-1 truncate">{name}</span>
                <span className={cn(
                  'text-[11px] tabular-nums',
                  selectedParent === name ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {node.count}
                </span>
              </button>
            ))}
            {components.length === 0 && !loading && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No components yet. Sync a Figma file to get started.
              </p>
            )}
          </div>

          {/* Summary */}
          {totalCount > 0 && (
            <>
              <Separator className="mx-2" />
              <div className="p-1.5 pb-4">
                <div className="px-2 py-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Summary</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                  <HugeiconsIcon icon={PackageIcon} size={12} className="flex-shrink-0 opacity-60" />
                  <span className="flex-1">Components</span>
                  <span className="text-[11px] tabular-nums">{totalCount}</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                  <HugeiconsIcon icon={Layers01Icon} size={12} className="flex-shrink-0 opacity-60" />
                  <span className="flex-1">Groups</span>
                  <span className="text-[11px] tabular-nums">{uniqueParents}</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                  <HugeiconsIcon icon={TextIcon} size={12} className="flex-shrink-0 opacity-60" />
                  <span className="flex-1">With description</span>
                  <span className="text-[11px] tabular-nums">{withDescription}</span>
                </div>
                {withoutDescription > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-yellow-600 dark:text-yellow-400">
                    <span className="w-3 h-3 flex items-center justify-center text-[9px] font-bold flex-shrink-0">!</span>
                    <span className="flex-1">Missing description</span>
                    <span className="text-[11px] tabular-nums">{withoutDescription}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-w-0">
        {/* Component List */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Table Header */}
          <div className="h-[48px] flex items-center border-b bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex-shrink-0">
            <div className="flex-1 px-4">Name</div>
            <div className="w-[300px] px-4 border-l flex-shrink-0 h-full flex items-center">Description</div>
          </div>

          {/* Table Body */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                Loading components...
              </div>
            ) : visibleComponents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted mb-3">
                  <HugeiconsIcon icon={PackageIcon} size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm">
                  {searchQuery ? 'No components match your search' : 'No components found'}
                </p>
                {!searchQuery && (
                  <p className="text-xs mt-1">Sync a Figma file to populate components</p>
                )}
              </div>
            ) : (
              <div>
                {Array.from(groupedComponents.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([parentName, comps]) => {
                    const groupKey = parentName || '__ungrouped__';
                    const isExpanded = !parentName || expandedGroups.has(groupKey) || selectedParent !== null;

                    return (
                      <div key={groupKey}>
                        {/* Group Header */}
                        {parentName && !selectedParent && (
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="w-full flex items-center gap-2 px-4 py-2 bg-muted/20 border-b border-border/40 hover:bg-muted/30 transition-colors"
                          >
                            <HugeiconsIcon
                              icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
                              size={12}
                              className="text-muted-foreground flex-shrink-0"
                            />
                            <span className="text-[12px] font-medium text-muted-foreground">
                              {parentName}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {comps.length}
                            </Badge>
                          </button>
                        )}

                        {/* Components in this group */}
                        {isExpanded && comps.map((component) => (
                          <button
                            key={component.id}
                            onClick={() => setSelectedComponent(
                              selectedComponent?.id === component.id ? null : component
                            )}
                            className={cn(
                              'w-full flex items-center border-b border-border/30 hover:bg-muted/30 transition-colors text-left',
                              selectedComponent?.id === component.id && 'bg-primary/5'
                            )}
                          >
                            {/* Name column */}
                            <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 min-w-0">
                              <HugeiconsIcon icon={PackageIcon} size={14} className="text-muted-foreground flex-shrink-0 opacity-60" />
                              <span className="text-[13px] truncate">{component.name}</span>
                            </div>

                            {/* Description column */}
                            <div className="w-[300px] flex items-center px-4 py-2.5 border-l border-border/30 flex-shrink-0">
                              {component.description ? (
                                <span className="text-[13px] text-muted-foreground truncate">
                                  {component.description}
                                </span>
                              ) : (
                                <span className="text-[12px] text-muted-foreground/50 italic">
                                  No description
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
              </div>
            )}
          </ScrollArea>

          {/* Footer status bar */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t bg-muted/20 text-[11px] text-muted-foreground flex-shrink-0">
            <span>
              {visibleComponents.length} component{visibleComponents.length !== 1 ? 's' : ''}
              {selectedParent && ` in ${selectedParent}`}
            </span>
            <span>{uniqueParents} group{uniqueParents !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedComponent && (
          <div className="w-80 border-l bg-card flex flex-col flex-shrink-0">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={PackageIcon} size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{selectedComponent.name}</h3>
                  {selectedComponent.properties?.parent && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {selectedComponent.properties.parent}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Description */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </label>
                  <p className="mt-1 text-[13px] text-foreground">
                    {selectedComponent.description || (
                      <span className="text-muted-foreground/50 italic">No description</span>
                    )}
                  </p>
                </div>

                <Separator />

                {/* Type */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Type
                  </label>
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-[11px]">
                      {selectedComponent.type}
                    </Badge>
                  </div>
                </div>

                {/* Figma Key */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Figma Key
                  </label>
                  <p className="mt-1 text-[12px] text-muted-foreground font-mono break-all">
                    {selectedComponent.figma_key}
                  </p>
                </div>

                {/* Source File */}
                {selectedComponent.file_name && (
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Source File
                    </label>
                    <p className="mt-1 text-[13px] text-foreground">
                      {selectedComponent.file_name}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Last Updated
                  </label>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {new Date(selectedComponent.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
