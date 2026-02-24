import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { AddFigmaFileModal } from '../components/AddFigmaFileModal';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';
import { apiClient } from '../lib/api-client';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  PackageIcon,
  ChartUpIcon,
  ChartDownIcon,
  Activity01Icon,
  ReloadIcon
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function Dashboard() {
  const {
    currentWorkspace,
    figmaFiles,
    conflicts,
    loading,
  } = useWorkspaceStore();
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [syncingFileId, setSyncingFileId] = useState<string | null>(null);

  const handleSyncFile = async (fileId: string, fileName: string) => {
    setSyncingFileId(fileId);
    try {
      const result = await apiClient.syncFile(fileId);
      toast.success(result.message || `"${fileName}" synced successfully`);

      // Refresh data after sync
      if (currentWorkspace) {
        // This will be handled by the store in a real implementation
      }
    } catch (error) {
      toast.error(`Failed to sync "${fileName}"`);
      console.error('Sync error:', error);
    } finally {
      setSyncingFileId(null);
    }
  };

  useEffect(() => {
    // Auto-refresh data
    const interval = setInterval(() => {
      if (currentWorkspace) {
        // Refresh would happen here
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <HugeiconsIcon icon={PackageIcon} className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-bold mb-2">
            No Workspace Selected
          </h2>
          <p className="text-muted-foreground text-xs mb-6">
            Create or select a workspace to get started with your design system.
          </p>
          <Button onClick={() => setShowCreateWorkspaceModal(true)}>
            Create Workspace
          </Button>
        </div>

        {/* Create Workspace Modal */}
        <CreateWorkspaceModal
          isOpen={showCreateWorkspaceModal}
          onClose={() => setShowCreateWorkspaceModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Health Score</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={Activity01Icon} className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {currentWorkspace.health_score || 0}%
              </div>
              <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                <HugeiconsIcon icon={ChartUpIcon} className="h-3 w-3 mr-0.5" />
                <span>+5%</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${currentWorkspace.health_score || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Components</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <HugeiconsIcon icon={PackageIcon} className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {currentWorkspace.total_components || 0}
              </div>
              <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                <HugeiconsIcon icon={ChartUpIcon} className="h-3 w-3 mr-0.5" />
                <span>+3</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total components
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Variables</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {currentWorkspace.total_variables || 0}
              </div>
              <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                <HugeiconsIcon icon={ChartUpIcon} className="h-3 w-3 mr-0.5" />
                <span>+12</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total variables
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-border/60 transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Conflicts</CardDescription>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${conflicts.length > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                {conflicts.length > 0 ? (
                  <HugeiconsIcon icon={ChartDownIcon} className="h-4 w-4 text-red-600 dark:text-red-400" />
                ) : (
                  <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {conflicts.length}
              </div>
              {conflicts.length > 0 ? (
                <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                  <HugeiconsIcon icon={ChartUpIcon} className="h-3 w-3 mr-0.5" />
                  <span>+{conflicts.length}</span>
                </div>
              ) : (
                <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                  <span>All clear</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Active conflicts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Figma Files */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Figma Files</CardTitle>
            <Button onClick={() => setShowAddFileModal(true)} size="sm">
              <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
              Add Figma File
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : figmaFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No Figma files connected yet
            </div>
          ) : (
            <div className="space-y-3">
              {figmaFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-card rounded-lg hover:bg-muted/50 transition-colors border border-border/50 hover:border-border"
                >
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Role: {file.role} • Status: {file.sync_status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSyncFile(file.id, file.name)}
                      disabled={syncingFileId === file.id}
                      className="h-8 w-8 p-0"
                    >
                      <HugeiconsIcon
                        icon={ReloadIcon}
                        className={`h-4 w-4 ${syncingFileId === file.id ? 'animate-spin' : ''}`}
                      />
                    </Button>
                    <Badge
                      variant={
                        file.sync_status === 'success'
                          ? 'default'
                          : file.sync_status === 'syncing'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {file.sync_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No recent activity
          </div>
        </CardContent>
      </Card>

      {/* Add Figma File Modal */}
      <AddFigmaFileModal
        isOpen={showAddFileModal}
        onClose={() => setShowAddFileModal(false)}
      />
    </div>
  );
}
