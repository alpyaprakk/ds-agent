import { useEffect, useState, useCallback } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { AddFigmaFileModal } from '../components/AddFigmaFileModal';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';
import { apiClient } from '../lib/api-client';
import { wsClient } from '../lib/websocket';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  PackageIcon,
  ChartUpIcon,
  Activity01Icon,
  ReloadIcon,
  AlertDiamondIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteFileState {
  isOpen: boolean;
  file: { id: string; name: string } | null;
  confirmText: string;
  isDeleting: boolean;
}

export function Dashboard() {
  const {
    currentWorkspace,
    figmaFiles,
    conflicts,
    loading,
    fetchWorkspaces,
    deleteFigmaFile,
  } = useWorkspaceStore();
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [syncingFileId, setSyncingFileId] = useState<string | null>(null);

  const myRole = currentWorkspace?.member_role;
  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';
  const [deleteState, setDeleteState] = useState<DeleteFileState>({
    isOpen: false,
    file: null,
    confirmText: '',
    isDeleting: false,
  });

  const refreshFiles = useCallback(() => {
    if (currentWorkspace) {
      useWorkspaceStore.getState().fetchFigmaFiles(currentWorkspace.id);
    }
  }, [currentWorkspace]);

  // Listen for figma_synced event to refresh file list when sync completes
  useEffect(() => {
    const onFigmaSynced = () => {
      refreshFiles();
    };

    wsClient.on('figma_synced', onFigmaSynced);
    return () => {
      wsClient.off('figma_synced', onFigmaSynced);
    };
  }, [refreshFiles]);

  const handleSyncFile = async (fileId: string, fileName: string) => {
    setSyncingFileId(fileId);
    try {
      const result = await apiClient.syncFile(fileId);
      toast.success(result.message || `"${fileName}" synced successfully`);
      // Poll for status updates since plugin sync is async
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        refreshFiles();
        // Check if file status changed from 'syncing'
        const files = useWorkspaceStore.getState().figmaFiles;
        const file = files.find(f => f.id === fileId);
        if (file && file.sync_status !== 'syncing') {
          clearInterval(pollInterval);
        }
        if (attempts >= 20) { // ~60s max
          clearInterval(pollInterval);
        }
      }, 3000);
    } catch (error) {
      toast.error(`Failed to sync "${fileName}"`);
      console.error('Sync error:', error);
    } finally {
      setSyncingFileId(null);
    }
  };

  const openDeleteDialog = (file: { id: string; name: string }) => {
    setDeleteState({
      isOpen: true,
      file,
      confirmText: '',
      isDeleting: false,
    });
  };

  const closeDeleteDialog = () => {
    setDeleteState({
      isOpen: false,
      file: null,
      confirmText: '',
      isDeleting: false,
    });
  };

  const handleDeleteFile = async () => {
    if (!deleteState.file || !currentWorkspace) return;
    if (deleteState.confirmText !== deleteState.file.name) return;

    setDeleteState((prev) => ({ ...prev, isDeleting: true }));
    try {
      await deleteFigmaFile(currentWorkspace.id, deleteState.file.id);
      toast.success(`"${deleteState.file.name}" deleted successfully`);
      closeDeleteDialog();
      // Refresh workspace data to update stats
      fetchWorkspaces();
    } catch (error) {
      toast.error(`Failed to delete "${deleteState.file.name}"`);
      console.error('Delete error:', error);
      setDeleteState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  useEffect(() => {
    // Auto-refresh workspace data periodically
    const interval = setInterval(() => {
      if (currentWorkspace) {
        fetchWorkspaces();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentWorkspace, fetchWorkspaces]);

  if (!currentWorkspace) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <HugeiconsIcon icon={PackageIcon} className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold mb-2">No Workspace Selected</h2>
            <p className="text-muted-foreground text-xs mb-6">
              Create or select a workspace to get started with your design system.
            </p>
            <Button size="sm" onClick={() => setShowCreateWorkspaceModal(true)}>
              Create Workspace
            </Button>
          </div>
        </div>

        <CreateWorkspaceModal
          isOpen={showCreateWorkspaceModal}
          onClose={() => setShowCreateWorkspaceModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Overview of your design system health and files
            </p>
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={() => setShowAddFileModal(true)} size="sm" className="gap-1.5">
              <HugeiconsIcon icon={Add01Icon} size={14} />
              Add Figma File
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <HugeiconsIcon icon={Activity01Icon} size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Health Score</p>
                  <p className="text-lg font-bold">{currentWorkspace.health_score || 0}%</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-muted rounded-full h-1">
                  <div
                    className="bg-primary h-1 rounded-full transition-all"
                    style={{ width: `${currentWorkspace.health_score || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <HugeiconsIcon icon={PackageIcon} size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Components</p>
                  <p className="text-lg font-bold">{currentWorkspace.total_components || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                  <HugeiconsIcon icon={ChartUpIcon} size={14} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Variables</p>
                  <p className="text-lg font-bold">{currentWorkspace.total_variables || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${conflicts.length > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                  <HugeiconsIcon
                    icon={conflicts.length > 0 ? AlertDiamondIcon : ChartUpIcon}
                    size={14}
                    className={conflicts.length > 0 ? 'text-red-500' : 'text-emerald-500'}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Conflicts</p>
                  <p className="text-lg font-bold">{conflicts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Figma Files */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={PackageIcon} size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle>Figma Files</CardTitle>
                <CardDescription>
                  {figmaFiles.length} file{figmaFiles.length !== 1 ? 's' : ''} connected
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
            ) : figmaFiles.length === 0 ? (
              <div className="p-10 text-center">
                <HugeiconsIcon icon={PackageIcon} className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-sm font-semibold mb-1">No Figma Files Connected</h3>
                <p className="text-muted-foreground text-xs">
                  Add a Figma file to start syncing your design system.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {figmaFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{file.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {file.role}{file.last_synced && ` · Last synced ${new Date(file.last_synced).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge
                        variant={
                          file.sync_status === 'success'
                            ? 'default'
                            : file.sync_status === 'syncing'
                            ? 'secondary'
                            : file.sync_status === 'failed'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {file.sync_status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSyncFile(file.id, file.name)}
                        disabled={syncingFileId === file.id}
                        className="h-8 w-8 p-0"
                        title="Sync file"
                      >
                        <HugeiconsIcon
                          icon={ReloadIcon}
                          size={14}
                          className={syncingFileId === file.id ? 'animate-spin' : ''}
                        />
                      </Button>
                      {isOwnerOrAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog({ id: file.id, name: file.name })}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                          title="Delete file"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom spacing */}
        <div className="h-4" />
      </div>

      {/* Add Figma File Modal */}
      <AddFigmaFileModal
        isOpen={showAddFileModal}
        onClose={() => setShowAddFileModal(false)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteState.isOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">
              Delete Figma File
            </DialogTitle>
            <DialogDescription>
              This action is <strong>irreversible</strong>. All synced variables, components,
              and related data for this file will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm mb-3">
              To confirm, type the file name: <strong className="font-mono text-foreground">{deleteState.file?.name}</strong>
            </p>
            <Input
              value={deleteState.confirmText}
              onChange={(e) =>
                setDeleteState((prev) => ({ ...prev, confirmText: e.target.value }))
              }
              placeholder="Type file name to confirm..."
              disabled={deleteState.isDeleting}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deleteState.isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFile}
              disabled={
                deleteState.confirmText !== deleteState.file?.name ||
                deleteState.isDeleting
              }
            >
              {deleteState.isDeleting ? 'Deleting...' : 'Delete File'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
