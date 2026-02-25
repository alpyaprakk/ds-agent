import { useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  AiCloudIcon,
  SparklesIcon,
  Message01Icon,
  AlertDiamondIcon,
  Alert02Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AIChatPanel } from '@/components/AIChatPanel';
import { wsClient } from '@/lib/websocket';
import { toast } from 'sonner';
import type { Conflict } from '@/lib/api-client';

interface ParsedIssue {
  title: string;
  description: string;
  suggestion: string;
}

function parseIssueDescription(description: string): ParsedIssue {
  const parts = description.split('\n\n');

  return {
    title: parts[0] || '',
    description: parts[1] || description,
    suggestion: parts[2]?.replace('Suggestion: ', '') || 'N/A'
  };
}

const categoryIcons: Record<string, string> = {
  naming: '🏷️',
  structure: '🏗️',
  token: '🎨',
  component: '📦',
  consistency: '⚖️'
};

const categoryLabels: Record<string, string> = {
  naming: 'Naming Convention',
  structure: 'Structure',
  token: 'Token/Variable',
  component: 'Component',
  consistency: 'Consistency'
};

export function Conflicts() {
  const {
    currentWorkspace,
    conflicts,
    dismissConflict,
    loading,
  } = useWorkspaceStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<any>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [autoFixingId, setAutoFixingId] = useState<string | null>(null);
  const [autoFixingAll, setAutoFixingAll] = useState(false);

  const handleDismiss = async (conflictId: string) => {
    setDismissingId(conflictId);
    try {
      await dismissConflict(conflictId, 'user');
      toast.success('Issue dismissed');
    } catch (error) {
      toast.error('Failed to dismiss issue');
    } finally {
      setDismissingId(null);
    }
  };

  const handleFixWithAI = (conflict: Conflict) => {
    const parsed = parseIssueDescription(conflict.description || '');

    setChatContext({
      conflictId: conflict.id,
      title: parsed.title || conflict.entity_name,
      description: parsed.description,
      suggestion: parsed.suggestion !== 'N/A' ? parsed.suggestion : undefined,
      entityType: conflict.entity_type,
      entityName: conflict.entity_name
    });
    setChatOpen(true);
  };

  const handleAutoFix = async (conflict: Conflict) => {
    setAutoFixingId(conflict.id);
    try {
      wsClient.emit('apply-fix', {
        conflictId: conflict.id,
        entityId: conflict.entity_id,
        action: 'auto-fix',
        suggestion: parseIssueDescription(conflict.description || '').suggestion
      });

      toast.info('Fix request sent to plugin', {
        description: 'Please make sure the Figma plugin is running',
      });
    } catch (error) {
      toast.error('Failed to send fix request');
    } finally {
      setAutoFixingId(null);
    }
  };

  const handleAutoFixAll = async () => {
    const autoFixable = conflicts.filter(c => c.resolution_method === 'auto');
    if (autoFixable.length === 0) return;

    setAutoFixingAll(true);
    try {
      for (const conflict of autoFixable) {
        wsClient.emit('apply-fix', {
          conflictId: conflict.id,
          entityId: conflict.entity_id,
          action: 'auto-fix',
          suggestion: parseIssueDescription(conflict.description || '').suggestion
        });
      }

      toast.info(`${autoFixable.length} fix requests sent to plugin`, {
        description: 'Please make sure the Figma plugin is running',
      });
    } catch (error) {
      toast.error('Failed to send fix requests');
    } finally {
      setAutoFixingAll(false);
    }
  };

  const handleApplyFix = (fix: any) => {
    wsClient.emit('apply-fix', {
      conflictId: fix.conflictId,
      entityId: fix.entityId,
      action: fix.action,
      suggestion: fix.suggestion
    });

    toast.info('Fix request sent to plugin', {
      description: 'Please make sure the Figma plugin is running',
    });

    setChatOpen(false);
  };

  if (!currentWorkspace) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-center py-12 text-muted-foreground">
          No workspace selected
        </div>
      </div>
    );
  }

  const categories = Array.from(new Set(conflicts.map(c => c.conflict_type)));
  const filteredConflicts = selectedCategory
    ? conflicts.filter(c => c.conflict_type === selectedCategory)
    : conflicts;

  const highCount = conflicts.filter(c => c.severity === 'high').length;
  const mediumCount = conflicts.filter(c => c.severity === 'medium').length;
  const lowCount = conflicts.filter(c => c.severity === 'low').length;
  const autoFixableCount = conflicts.filter(c => c.resolution_method === 'auto').length;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Issues & Conflicts</h1>
            <p className="text-xs text-muted-foreground mt-1">
              AI-detected issues and design system conflicts
            </p>
          </div>
          {autoFixableCount > 0 && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleAutoFixAll}
              disabled={autoFixingAll}
            >
              <HugeiconsIcon icon={SparklesIcon} size={14} />
              {autoFixingAll ? 'Sending...' : `Auto-Fix ${autoFixableCount} Issues`}
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <HugeiconsIcon icon={AlertDiamondIcon} size={14} className="text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">High</p>
                  <p className="text-lg font-bold">{highCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
                  <HugeiconsIcon icon={Alert02Icon} size={14} className="text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Medium</p>
                  <p className="text-lg font-bold">{mediumCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <HugeiconsIcon icon={InformationCircleIcon} size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Low</p>
                  <p className="text-lg font-bold">{lowCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <HugeiconsIcon icon={SparklesIcon} size={14} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Auto-Fixable</p>
                  <p className="text-lg font-bold">{autoFixableCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="text-xs"
            >
              All ({conflicts.length})
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="gap-1.5 text-xs"
              >
                <span className="text-sm">{categoryIcons[category] || '📋'}</span>
                {categoryLabels[category] || category}
                <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 py-0 h-4">
                  {conflicts.filter(c => c.conflict_type === category).length}
                </Badge>
              </Button>
            ))}
          </div>
        )}

        {/* Issues List */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={AiCloudIcon} size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle>
                  {selectedCategory
                    ? `${categoryLabels[selectedCategory] || selectedCategory} Issues`
                    : 'All Issues'
                  }
                </CardTitle>
                <CardDescription>
                  {filteredConflicts.length} issue{filteredConflicts.length !== 1 ? 's' : ''} detected
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <HugeiconsIcon icon={AiCloudIcon} size={32} className="mx-auto mb-3 animate-pulse" />
                <p className="text-sm">Analyzing design system...</p>
              </div>
            ) : filteredConflicts.length === 0 ? (
              <div className="p-10 text-center">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="h-12 w-12 mx-auto mb-3 text-emerald-600 dark:text-emerald-400"
                />
                <h3 className="text-sm font-semibold mb-1">
                  {selectedCategory ? 'No Issues in This Category' : 'No Active Issues'}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {selectedCategory
                    ? 'Try selecting a different category or view all issues.'
                    : 'Your design system is in great shape!'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConflicts.map((conflict) => {
                  const parsed = parseIssueDescription(conflict.description || '');
                  const isAutoFixable = conflict.resolution_method === 'auto';

                  return (
                    <div key={conflict.id} className="p-5 hover:bg-muted/30 transition-colors">
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <Badge
                            variant={
                              conflict.severity === 'high' ? 'destructive'
                              : conflict.severity === 'medium' ? 'warning'
                              : 'info'
                            }
                            className="text-[10px] font-semibold"
                          >
                            {conflict.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <span className="text-xs">{categoryIcons[conflict.conflict_type] || '📋'}</span>
                            {categoryLabels[conflict.conflict_type] || conflict.conflict_type}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {conflict.entity_type}
                          </Badge>
                          {isAutoFixable && (
                            <Badge variant="success" className="gap-1 text-[10px]">
                              <HugeiconsIcon icon={SparklesIcon} size={10} />
                              Auto-fixable
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold mb-1">
                          {parsed.title || conflict.entity_name || 'Unnamed Issue'}
                        </h3>

                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                          {parsed.description}
                        </p>

                        {parsed.suggestion !== 'N/A' && (
                          <div className="bg-muted/50 rounded-lg p-2.5 mb-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                              Suggested Fix
                            </p>
                            <p className="text-xs">{parsed.suggestion}</p>
                          </div>
                        )}

                        <div className="text-[10px] text-muted-foreground">
                          <span className="font-medium">Entity:</span> {conflict.entity_name} &middot;{' '}
                          <span className="font-medium">Detected:</span>{' '}
                          {new Date(conflict.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleFixWithAI(conflict)}
                          className="gap-1.5 text-xs"
                        >
                          <HugeiconsIcon icon={Message01Icon} size={12} />
                          Fix with AI
                        </Button>
                        {isAutoFixable && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1.5 text-xs"
                            onClick={() => handleAutoFix(conflict)}
                            disabled={autoFixingId === conflict.id}
                          >
                            <HugeiconsIcon icon={SparklesIcon} size={12} />
                            {autoFixingId === conflict.id ? 'Sending...' : 'Auto-Fix'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleDismiss(conflict.id)}
                          variant="ghost"
                          className="text-xs text-muted-foreground"
                          disabled={dismissingId === conflict.id}
                        >
                          {dismissingId === conflict.id ? 'Dismissing...' : 'Dismiss'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom spacing */}
        <div className="h-4" />
      </div>

      {/* AI Chat Panel */}
      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        initialContext={chatContext}
        onApplyFix={handleApplyFix}
      />
    </div>
  );
}
