import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Conflicts } from './pages/Conflicts';
import { Variables } from './pages/Variables';
import { Components } from './pages/Components';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { PluginAuth } from './pages/PluginAuth';
import { useWorkspaceStore } from './store/workspace-store';
import { useAuthStore } from './store/auth-store';
import { useNotificationStore } from './store/notification-store';
import { wsClient } from './lib/websocket';
import { LayoutProvider } from './contexts/LayoutContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Auth guard component
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="Tokenhaus" className="h-10 w-10 dark:invert animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Redirect if already logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();

  if (!initialized) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { fetchWorkspaces, setCurrentWorkspace, workspaces } = useWorkspaceStore();
  const { user, checkAuth } = useAuthStore();
  const { theme } = useTheme();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch pending invitations when user is authenticated
  useEffect(() => {
    if (!user) return;

    const checkInvitations = async () => {
      await useWorkspaceStore.getState().fetchMyInvitations();
      const invitations = useWorkspaceStore.getState().myInvitations;
      if (invitations.length > 0) {
        toast.info(`You have ${invitations.length} pending workspace invitation${invitations.length > 1 ? 's' : ''}`, {
          description: 'Go to Settings to accept or decline',
          duration: 8000,
          action: {
            label: 'View',
            onClick: () => window.location.href = '/settings',
          },
        });
      }
    };

    checkInvitations();
  }, [user]);

  // Initialize app data when user is authenticated
  useEffect(() => {
    if (!user) return;

    wsClient.connect();
    fetchWorkspaces();

    // Named handlers for proper cleanup
    const onWorkspaceJoined = (data: any) => {
      console.log('Joined workspace:', data.workspace_id);
    };

    const onConflictDetected = (data: any) => {
      const severity = data.severity || 'medium';
      const message = `${data.entity_type} conflict detected: ${data.entity_name || 'Unnamed'}`;

      if (severity === 'high') {
        toast.error(message, { description: 'Please review and resolve this conflict', duration: 10000 });
      } else if (severity === 'medium') {
        toast.warning(message, { description: 'Auto-resolved, but please verify', duration: 5000 });
      } else {
        toast.info(message, { description: 'Auto-resolved successfully', duration: 3000 });
      }

      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(useWorkspaceStore.getState().currentWorkspace!.id, 'active');
      }
    };

    const onFigmaChanges = (data: any) => {
      toast.success('Design system updated', {
        description: `${data.changes?.length || 0} changes synced from Figma`,
        duration: 3000,
      });
      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(useWorkspaceStore.getState().currentWorkspace!.id, 'active');
      }
    };

    const onFigmaSynced = (data: any) => {
      toast.success(`Synced: ${data.fileName}`, {
        description: `${data.stats?.variables || 0} variables, ${data.stats?.components || 0} components`,
        duration: 5000,
      });
      const store = useWorkspaceStore.getState();
      store.fetchWorkspaces();
      store.bumpLastSyncAt();
      if (store.currentWorkspace) {
        store.fetchFigmaFiles(store.currentWorkspace.id);
        store.fetchConflicts(store.currentWorkspace.id, 'active');
      }
    };

    const onAnalysisStarted = () => {
      toast.info('AI Analysis in progress', {
        description: 'Analyzing design system for issues and conflicts...',
        duration: 5000,
      });
    };

    const onAnalysisComplete = (data: any) => {
      const { summary, score } = data.report;
      toast.success('AI Analysis complete', {
        description: `Found ${summary.totalIssues} issues. Health score: ${score}/100`,
        duration: 10000,
      });
      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(useWorkspaceStore.getState().currentWorkspace!.id, 'active');
      }
    };

    const onAnalysisFailed = (data: any) => {
      toast.error('AI Analysis failed', { description: data.error || 'Unknown error', duration: 5000 });
    };

    const onFixSuccess = (data: any) => {
      toast.success('Fix applied!', {
        description: data.message || 'The fix has been applied to your Figma file',
        duration: 5000,
      });
      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(useWorkspaceStore.getState().currentWorkspace!.id, 'active');
      }
    };

    const onFixError = (data: any) => {
      toast.error('Fix failed', { description: data.error || 'Could not apply the fix', duration: 5000 });
    };

    const onNotification = (data: any) => {
      useNotificationStore.getState().addNotification(data.notification);
    };

    // Register all listeners
    wsClient.on('workspace_joined', onWorkspaceJoined);
    wsClient.on('conflict_detected', onConflictDetected);
    wsClient.on('figma_changes', onFigmaChanges);
    wsClient.on('figma_synced', onFigmaSynced);
    wsClient.on('analysis_started', onAnalysisStarted);
    wsClient.on('analysis_complete', onAnalysisComplete);
    wsClient.on('analysis_failed', onAnalysisFailed);
    wsClient.on('fix-success', onFixSuccess);
    wsClient.on('fix-error', onFixError);
    wsClient.on('notification', onNotification);

    return () => {
      // Remove all listeners to prevent accumulation on reconnect
      wsClient.off('workspace_joined', onWorkspaceJoined);
      wsClient.off('conflict_detected', onConflictDetected);
      wsClient.off('figma_changes', onFigmaChanges);
      wsClient.off('figma_synced', onFigmaSynced);
      wsClient.off('analysis_started', onAnalysisStarted);
      wsClient.off('analysis_complete', onAnalysisComplete);
      wsClient.off('analysis_failed', onAnalysisFailed);
      wsClient.off('fix-success', onFixSuccess);
      wsClient.off('fix-error', onFixError);
      wsClient.off('notification', onNotification);
      wsClient.disconnect();
    };
  }, [user, fetchWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0 && !useWorkspaceStore.getState().currentWorkspace) {
      setCurrentWorkspace(workspaces[0]);
      wsClient.joinWorkspace(workspaces[0].id);
    }
  }, [workspaces, setCurrentWorkspace]);

  return (
    <>
      <Toaster
        position="bottom-right"
        theme={theme}
        toastOptions={{
          classNames: {
            toast: 'dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100',
            title: 'dark:text-zinc-100',
            description: 'dark:text-zinc-400',
            actionButton: 'dark:bg-zinc-700 dark:text-zinc-100',
            cancelButton: 'dark:bg-zinc-800 dark:text-zinc-400',
            closeButton: 'dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400',
          },
        }}
      />
      <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/plugin-auth" element={<PluginAuth />} />

      {/* Protected routes */}
      <Route path="/*" element={
        <RequireAuth>
          <LayoutProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/variables" element={<Variables />} />
                <Route path="/components" element={<Components />} />
                <Route path="/conflicts" element={<Conflicts />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </LayoutProvider>
        </RequireAuth>
      } />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
