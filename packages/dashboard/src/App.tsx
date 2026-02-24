import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Conflicts } from './pages/Conflicts';
import { Variables } from './pages/Variables';
import { Components } from './pages/Components';
import { useWorkspaceStore } from './store/workspace-store';
import { wsClient } from './lib/websocket';

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
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/variables" element={<Variables />} />
          <Route path="/components" element={<Components />} />
          <Route path="/conflicts" element={<Conflicts />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
