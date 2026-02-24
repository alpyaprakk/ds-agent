import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { CheckCircle2 } from 'lucide-react';
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
        <h1 className="text-3xl font-bold tracking-tight">Conflicts</h1>
        <p className="text-muted-foreground mt-2">
          Manage and resolve conflicts in your design system
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardDescription className="text-red-600">High Priority</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">
              {conflicts.filter((c) => c.severity === 'high').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardDescription className="text-yellow-600">Medium Priority</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">
              {conflicts.filter((c) => c.severity === 'medium').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardDescription className="text-blue-600">Low Priority</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
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
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-semibold mb-2">
                No Active Conflicts
              </h3>
              <p className="text-muted-foreground">
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
                          variant={conflict.severity === 'high' ? 'destructive' : 'secondary'}
                          className={cn(
                            conflict.severity === 'medium' && 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
                            conflict.severity === 'low' && 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                          )}
                        >
                          {conflict.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {conflict.entity_type}
                        </Badge>
                      </div>

                      <h3 className="text-lg font-semibold mb-1">
                        {conflict.entity_name || 'Unnamed Entity'}
                      </h3>

                      {conflict.description && (
                        <p className="text-muted-foreground">{conflict.description}</p>
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
