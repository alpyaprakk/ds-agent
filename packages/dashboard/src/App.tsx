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
import { useWorkspaceStore } from './store/workspace-store';
import { useAuthStore } from './store/auth-store';
import { useNotificationStore } from './store/notification-store';
import { wsClient } from './lib/websocket';
import { LayoutProvider } from './contexts/LayoutContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Auth guard component
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="DS Agent" className="h-10 w-10 dark:invert animate-pulse" />
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

    // Setup WebSocket listeners
    wsClient.on('workspace_joined', (data) => {
      console.log('Joined workspace:', data.workspace_id);
    });

    wsClient.on('conflict_detected', (data) => {
      console.log('Conflict detected:', data);
      const severity = data.severity || 'medium';
      const message = `${data.entity_type} conflict detected: ${data.entity_name || 'Unnamed'}`;

      if (severity === 'high') {
        toast.error(message, {
          description: 'Please review and resolve this conflict',
          duration: 10000,
        });
      } else if (severity === 'medium') {
        toast.warning(message, {
          description: 'Auto-resolved, but please verify',
          duration: 5000,
        });
      } else {
        toast.info(message, {
          description: 'Auto-resolved successfully',
          duration: 3000,
        });
      }

      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(
          useWorkspaceStore.getState().currentWorkspace!.id,
          'active'
        );
      }
    });

    wsClient.on('figma_changes', (data) => {
      console.log('Figma changes:', data);
      toast.success('Design system updated', {
        description: `${data.changes?.length || 0} changes synced from Figma`,
        duration: 3000,
      });

      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(
          useWorkspaceStore.getState().currentWorkspace!.id,
          'active'
        );
      }
    });

    wsClient.on('figma_synced', (data) => {
      console.log('Figma synced:', data);
      toast.success(`Synced: ${data.fileName}`, {
        description: `${data.stats?.variables || 0} variables, ${data.stats?.components || 0} components`,
        duration: 5000,
      });

      const store = useWorkspaceStore.getState();
      store.fetchWorkspaces();
      if (store.currentWorkspace) {
        store.fetchFigmaFiles(store.currentWorkspace.id);
        store.fetchConflicts(store.currentWorkspace.id, 'active');
      }
    });

    wsClient.on('analysis_started', (data) => {
      console.log('AI analysis started:', data);
      toast.info('AI Analysis in progress', {
        description: 'Analyzing design system for issues and conflicts...',
        duration: 5000,
      });
    });

    wsClient.on('analysis_complete', (data) => {
      console.log('AI analysis complete:', data);
      const { summary, score } = data.report;

      toast.success('AI Analysis complete', {
        description: `Found ${summary.totalIssues} issues. Health score: ${score}/100`,
        duration: 10000,
      });

      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(
          useWorkspaceStore.getState().currentWorkspace!.id,
          'active'
        );
      }
    });

    wsClient.on('analysis_failed', (data) => {
      console.error('AI analysis failed:', data);
      toast.error('AI Analysis failed', {
        description: data.error || 'Unknown error',
        duration: 5000,
      });
    });

    wsClient.on('fix-success', (data) => {
      console.log('Fix applied successfully:', data);
      toast.success('Fix applied!', {
        description: data.message || 'The fix has been applied to your Figma file',
        duration: 5000,
      });

      if (useWorkspaceStore.getState().currentWorkspace) {
        useWorkspaceStore.getState().fetchConflicts(
          useWorkspaceStore.getState().currentWorkspace!.id,
          'active'
        );
      }
    });

    wsClient.on('fix-error', (data) => {
      console.error('Fix failed:', data);
      toast.error('Fix failed', {
        description: data.error || 'Could not apply the fix',
        duration: 5000,
      });
    });

    // Real-time notification listener
    wsClient.on('notification', (data) => {
      if (data.userId === user.id) {
        useNotificationStore.getState().addNotification(data.notification);
      }
    });

    return () => {
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
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

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
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
