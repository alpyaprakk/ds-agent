import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { AddFigmaFileModal } from '../components/AddFigmaFileModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  PackageIcon,
  ChartUpIcon,
  ChartDownIcon,
  Activity01Icon
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
          <Button>Create Workspace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-lg font-bold tracking-tight">
          {currentWorkspace.icon} {currentWorkspace.name}
        </h1>
        {currentWorkspace.description && (
          <p className="text-muted-foreground text-xs mt-2">{currentWorkspace.description}</p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-t-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Health Score</CardDescription>
              <HugeiconsIcon icon={Activity01Icon} className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-xl font-bold">
                {currentWorkspace.health_score || 0}%
              </div>
              <div className="flex items-center text-sm text-green-600">
                <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 mr-1" />
                <span>+5%</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-primary h-2 rounded-full transition-all"
                  style={{ width: `${currentWorkspace.health_score || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-t-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Components</CardDescription>
              <HugeiconsIcon icon={PackageIcon} className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-xl font-bold">
                {currentWorkspace.total_components || 0}
              </div>
              <div className="flex items-center text-sm text-green-600">
                <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 mr-1" />
                <span>+3</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total components
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-t-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Variables</CardDescription>
              <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-xl font-bold">
                {currentWorkspace.total_variables || 0}
              </div>
              <div className="flex items-center text-sm text-green-600">
                <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 mr-1" />
                <span>+12</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total variables
            </p>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-lg transition-shadow cursor-pointer border-t-4 ${conflicts.length > 0 ? 'border-t-red-500' : 'border-t-green-500'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Conflicts</CardDescription>
              {conflicts.length > 0 ? (
                <HugeiconsIcon icon={ChartDownIcon} className="h-4 w-4 text-red-600" />
              ) : (
                <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 text-green-600" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-xl font-bold">
                {conflicts.length}
              </div>
              {conflicts.length > 0 ? (
                <div className="flex items-center text-sm text-red-600">
                  <HugeiconsIcon icon={ChartUpIcon} className="h-4 w-4 mr-1" />
                  <span>+{conflicts.length}</span>
                </div>
              ) : (
                <div className="flex items-center text-sm text-green-600">
                  <span>All clear</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
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
                  className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-accent transition-colors cursor-pointer border border-transparent hover:border-border"
                >
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Role: {file.role} • Status: {file.sync_status}
                    </div>
                  </div>
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
