import { create } from 'zustand';
import { apiClient, Workspace, FigmaFile, Conflict } from '../lib/api-client';

interface WorkspaceStore {
  // State
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  figmaFiles: FigmaFile[];
  conflicts: Conflict[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (data: Partial<Workspace>) => Promise<Workspace>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  fetchFigmaFiles: (workspaceId: string) => Promise<void>;
  addFigmaFile: (workspaceId: string, data: Partial<FigmaFile>) => Promise<void>;

  fetchConflicts: (workspaceId: string, status?: string) => Promise<void>;
  resolveConflict: (conflictId: string, data: any) => Promise<void>;
  dismissConflict: (conflictId: string, actor: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // Initial state
  workspaces: [],
  currentWorkspace: null,
  figmaFiles: [],
  conflicts: [],
  loading: false,
  error: null,

  // Fetch all workspaces
  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const { workspaces } = await apiClient.getWorkspaces();
      set({ workspaces, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch workspaces',
        loading: false,
      });
    }
  },

  // Set current workspace
  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });

    // Auto-fetch related data
    if (workspace) {
      get().fetchFigmaFiles(workspace.id);
      get().fetchConflicts(workspace.id, 'active');
    }
  },

  // Create workspace
  createWorkspace: async (data) => {
    set({ loading: true, error: null });
    try {
      const { workspace } = await apiClient.createWorkspace(data);
      set((state) => ({
        workspaces: [...state.workspaces, workspace],
        loading: false,
      }));
      return workspace;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create workspace',
        loading: false,
      });
      throw error;
    }
  },

  // Update workspace
  updateWorkspace: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const { workspace } = await apiClient.updateWorkspace(id, data);
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id ? workspace : w
        ),
        currentWorkspace:
          state.currentWorkspace?.id === id ? workspace : state.currentWorkspace,
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update workspace',
        loading: false,
      });
      throw error;
    }
  },

  // Delete workspace
  deleteWorkspace: async (id) => {
    set({ loading: true, error: null });
    try {
      await apiClient.deleteWorkspace(id);
      set((state) => ({
        workspaces: state.workspaces.filter((w) => w.id !== id),
        currentWorkspace:
          state.currentWorkspace?.id === id ? null : state.currentWorkspace,
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete workspace',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch Figma files
  fetchFigmaFiles: async (workspaceId) => {
    try {
      const { files } = await apiClient.getFigmaFiles(workspaceId);
      set({ figmaFiles: files });
    } catch (error) {
      console.error('Failed to fetch Figma files:', error);
    }
  },

  // Add Figma file
  addFigmaFile: async (workspaceId, data) => {
    try {
      const { file } = await apiClient.addFigmaFile(workspaceId, data);
      set((state) => ({
        figmaFiles: [...state.figmaFiles, file],
      }));
    } catch (error) {
      console.error('Failed to add Figma file:', error);
      throw error;
    }
  },

  // Fetch conflicts
  fetchConflicts: async (workspaceId, status) => {
    try {
      const { conflicts } = await apiClient.getConflicts(workspaceId, status);
      set({ conflicts });
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
    }
  },

  // Resolve conflict
  resolveConflict: async (conflictId, data) => {
    try {
      await apiClient.resolveConflict(conflictId, data);
      set((state) => ({
        conflicts: state.conflicts.filter((c) => c.id !== conflictId),
      }));
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  },

  // Dismiss conflict
  dismissConflict: async (conflictId, actor) => {
    try {
      await apiClient.dismissConflict(conflictId, actor);
      set((state) => ({
        conflicts: state.conflicts.filter((c) => c.id !== conflictId),
      }));
    } catch (error) {
      console.error('Failed to dismiss conflict:', error);
      throw error;
    }
  },
}));
