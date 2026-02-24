import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Conflicts() {
  const {
    currentWorkspace,
    conflicts,
    resolveConflict,
    dismissConflict,
    loading,
  } = useWorkspaceStore();

  useEffect(() => {
    if (currentWorkspace) {
      // Conflicts are already fetched when workspace is set
    }
  }, [currentWorkspace]);

  const handleResolve = async (conflictId: string, chosen: string) => {
    try {
      await resolveConflict(conflictId, {
        method: 'manual',
        chosen,
        resolvedBy: 'user', // TODO: Get actual user
      });
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  };

  const handleDismiss = async (conflictId: string) => {
    try {
      await dismissConflict(conflictId, 'user'); // TODO: Get actual user
    } catch (error) {
      console.error('Failed to dismiss conflict:', error);
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
        <h1 className="text-lg font-bold tracking-tight">Conflicts</h1>
        <p className="text-muted-foreground text-xs mt-2">
          Manage and resolve conflicts in your design system
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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
      </div>

      {/* Conflicts List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Conflicts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : conflicts.length === 0 ? (
            <div className="p-12 text-center">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-16 w-16 mx-auto mb-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-lg font-semibold mb-2">
                No Active Conflicts
              </h3>
              <p className="text-muted-foreground text-xs">
                Your design system is in sync. Great work!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            conflict.severity === 'high' && 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20',
                            conflict.severity === 'medium' && 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20',
                            conflict.severity === 'low' && 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20'
                          )}
                        >
                          {conflict.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {conflict.entity_type}
                        </Badge>
                      </div>

                      <h3 className="text-sm font-semibold mb-1">
                        {conflict.entity_name || 'Unnamed Entity'}
                      </h3>

                      {conflict.description && (
                        <p className="text-muted-foreground text-xs">{conflict.description}</p>
                      )}

                      <div className="text-sm text-muted-foreground mt-2">
                        Created: {new Date(conflict.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={() => handleResolve(conflict.id, 'source2')}>
                      Keep Designer's Version
                    </Button>
                    <Button onClick={() => handleResolve(conflict.id, 'source1')} variant="secondary">
                      Keep Agent's Version
                    </Button>
                    <Button onClick={() => handleDismiss(conflict.id)} variant="outline">
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
