import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  AiCloudIcon,
  SparklesIcon,
  Message01Icon
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    if (currentWorkspace) {
      // Conflicts are already fetched when workspace is set
    }
  }, [currentWorkspace]);

  const handleDismiss = async (conflictId: string) => {
    try {
      await dismissConflict(conflictId, 'user');
    } catch (error) {
      console.error('Failed to dismiss conflict:', error);
    }
  };

  const handleFixWithAI = (conflict: any) => {
    // TODO: Open AI chat with this conflict context
    console.log('Fix with AI:', conflict);
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

  // Group conflicts by category
  const categories = Array.from(new Set(conflicts.map(c => c.conflict_type)));
  const filteredConflicts = selectedCategory
    ? conflicts.filter(c => c.conflict_type === selectedCategory)
    : conflicts;

  const autoFixableCount = conflicts.filter(c => c.resolution_method === 'auto').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Issues & Conflicts</h1>
            <p className="text-muted-foreground mt-2">
              AI-detected issues and design system conflicts
            </p>
          </div>
          {autoFixableCount > 0 && (
            <Button className="gap-2">
              <HugeiconsIcon icon={SparklesIcon} size={18} />
              Auto-Fix {autoFixableCount} Issues
            </Button>
          )}
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-xs font-medium">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                <span className="text-lg">🔴</span>
              </div>
              High Priority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conflicts.filter((c) => c.severity === 'high').length}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-xs font-medium">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
                <span className="text-lg">🟡</span>
              </div>
              Medium Priority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conflicts.filter((c) => c.severity === 'medium').length}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-xs font-medium">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <span className="text-lg">🔵</span>
              </div>
              Low Priority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conflicts.filter((c) => c.severity === 'low').length}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-xs font-medium">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <HugeiconsIcon icon={SparklesIcon} size={16} className="text-emerald-600" />
              </div>
              Auto-Fixable
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoFixableCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All Issues ({conflicts.length})
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="gap-2"
            >
              <span>{categoryIcons[category] || '📋'}</span>
              {categoryLabels[category] || category}
              <Badge variant="secondary" className="ml-1">
                {conflicts.filter(c => c.conflict_type === category).length}
              </Badge>
            </Button>
          ))}
        </div>
      )}

      {/* Issues List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedCategory
                  ? `${categoryLabels[selectedCategory] || selectedCategory} Issues`
                  : 'All Issues'
                }
              </CardTitle>
              <CardDescription className="mt-1">
                {filteredConflicts.length} issue{filteredConflicts.length !== 1 ? 's' : ''} detected
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              <HugeiconsIcon icon={AiCloudIcon} size={40} className="mx-auto mb-4 animate-pulse" />
              Analyzing design system...
            </div>
          ) : filteredConflicts.length === 0 ? (
            <div className="p-12 text-center">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                className="h-16 w-16 mx-auto mb-4 text-emerald-600 dark:text-emerald-400"
              />
              <h3 className="text-lg font-semibold mb-2">
                {selectedCategory ? 'No Issues in This Category' : 'No Active Issues'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {selectedCategory
                  ? 'Try selecting a different category or view all issues.'
                  : 'Your design system is in great shape. Keep up the good work!'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConflicts.map((conflict) => {
                const parsed = parseIssueDescription(conflict.description || '');
                const isAutoFixable = conflict.resolution_method === 'auto';

                return (
                  <div key={conflict.id} className="p-6 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'font-semibold',
                              conflict.severity === 'high' &&
                                'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20',
                              conflict.severity === 'medium' &&
                                'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20',
                              conflict.severity === 'low' &&
                                'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20'
                            )}
                          >
                            {conflict.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="gap-1.5">
                            <span>{categoryIcons[conflict.conflict_type] || '📋'}</span>
                            {categoryLabels[conflict.conflict_type] || conflict.conflict_type}
                          </Badge>
                          <Badge variant="outline">
                            {conflict.entity_type}
                          </Badge>
                          {isAutoFixable && (
                            <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20">
                              <HugeiconsIcon icon={SparklesIcon} size={12} />
                              Auto-fixable
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-base font-semibold mb-2">
                          {parsed.title || conflict.entity_name || 'Unnamed Issue'}
                        </h3>

                        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                          {parsed.description}
                        </p>

                        {parsed.suggestion !== 'N/A' && (
                          <div className="bg-muted/50 rounded-lg p-3 mb-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              💡 Suggested Fix:
                            </p>
                            <p className="text-sm">{parsed.suggestion}</p>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Entity:</span> {conflict.entity_name} •{' '}
                          <span className="font-medium">Detected:</span>{' '}
                          {new Date(conflict.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleFixWithAI(conflict)}
                        className="gap-2"
                      >
                        <HugeiconsIcon icon={Message01Icon} size={16} />
                        Fix with AI
                      </Button>
                      {isAutoFixable && (
                        <Button variant="secondary" className="gap-2">
                          <HugeiconsIcon icon={SparklesIcon} size={16} />
                          Apply Auto-Fix
                        </Button>
                      )}
                      <Button onClick={() => handleDismiss(conflict.id)} variant="outline">
                        Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
