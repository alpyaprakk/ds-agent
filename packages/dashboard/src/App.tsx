import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Conflicts } from './pages/Conflicts';
import { Variables } from './pages/Variables';
import { Components } from './pages/Components';
import { Settings } from './pages/Settings';
import { useWorkspaceStore } from './store/workspace-store';
import { wsClient } from './lib/websocket';
import { LayoutProvider } from './contexts/LayoutContext';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  const { fetchWorkspaces, setCurrentWorkspace, workspaces } = useWorkspaceStore();

  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    // Fetch initial data
    fetchWorkspaces();

    // Setup WebSocket listeners
    wsClient.on('workspace_joined', (data) => {
      console.log('Joined workspace:', data.workspace_id);
      toast.success('Connected to workspace');
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

      // Refresh conflicts
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

      // Refresh workspace data
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

      // Refresh file list and workspace data
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (currentWorkspace) {
        useWorkspaceStore.getState().fetchFigmaFiles(currentWorkspace.id);
        useWorkspaceStore.getState().fetchConflicts(currentWorkspace.id, 'active');
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

      // Refresh conflicts
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

      // Refresh conflicts
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

    return () => {
      wsClient.disconnect();
    };
  }, [fetchWorkspaces]);

  useEffect(() => {
    // Auto-select first workspace if available
    if (workspaces.length > 0 && !useWorkspaceStore.getState().currentWorkspace) {
      setCurrentWorkspace(workspaces[0]);
      wsClient.joinWorkspace(workspaces[0].id);
    }
  }, [workspaces, setCurrentWorkspace]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <LayoutProvider>
          <Toaster position="top-right" richColors />
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
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
