import { create } from 'zustand';
import { apiClient, Workspace, FigmaFile, Conflict, WorkspaceMember, WorkspaceInvitation } from '../lib/api-client';

interface WorkspaceStore {
  // State
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  figmaFiles: FigmaFile[];
  conflicts: Conflict[];
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  myInvitations: WorkspaceInvitation[];
  loading: boolean;
  error: string | null;
  lastSyncAt: number | null; // epoch ms — bumped after every figma_synced event

  // Actions
  fetchWorkspaces: () => Promise<void>;
  bumpLastSyncAt: () => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (data: Partial<Workspace>) => Promise<Workspace>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  fetchFigmaFiles: (workspaceId: string) => Promise<void>;
  addFigmaFile: (workspaceId: string, data: Partial<FigmaFile>) => Promise<void>;
  deleteFigmaFile: (workspaceId: string, fileId: string) => Promise<void>;

  fetchConflicts: (workspaceId: string, status?: string) => Promise<void>;
  resolveConflict: (conflictId: string, data: any) => Promise<void>;
  dismissConflict: (conflictId: string, actor: string) => Promise<void>;

  // Members & Invitations
  fetchMembers: (workspaceId: string) => Promise<void>;
  inviteMember: (workspaceId: string, email: string, role?: string) => Promise<void>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
  updateMemberRole: (workspaceId: string, userId: string, role: string) => Promise<void>;
  fetchInvitations: (workspaceId: string) => Promise<void>;
  cancelInvitation: (workspaceId: string, invitationId: string) => Promise<void>;
  fetchMyInvitations: () => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
  rejectInvitation: (token: string) => Promise<void>;
  leaveWorkspace: (workspaceId: string, userId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // Initial state
  workspaces: [],
  currentWorkspace: null,
  figmaFiles: [],
  conflicts: [],
  members: [],
  invitations: [],
  myInvitations: [],
  loading: false,
  error: null,
  lastSyncAt: null,

  bumpLastSyncAt: () => set({ lastSyncAt: Date.now() }),

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const { workspaces } = await apiClient.getWorkspaces();
      const currentId = get().currentWorkspace?.id;
      const updatedCurrent = currentId
        ? workspaces.find((w) => w.id === currentId) || null
        : null;
      set({
        workspaces,
        currentWorkspace: updatedCurrent ?? get().currentWorkspace,
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch workspaces',
        loading: false,
      });
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace, members: [], invitations: [] });
    if (workspace) {
      get().fetchFigmaFiles(workspace.id);
      get().fetchConflicts(workspace.id, 'active');
    }
  },

  createWorkspace: async (data) => {
    set({ loading: true, error: null });
    try {
      const { workspace } = await apiClient.createWorkspace(data);
      // Re-fetch workspaces so the returned workspace includes member_role and other server-populated fields
      const { workspaces } = await apiClient.getWorkspaces();
      const enrichedWorkspace = workspaces.find((w) => w.id === workspace.id) ?? workspace;
      set({ workspaces, loading: false });
      return enrichedWorkspace;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create workspace',
        loading: false,
      });
      throw error;
    }
  },

  updateWorkspace: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const { workspace } = await apiClient.updateWorkspace(id, data);
      set((state) => ({
        workspaces: state.workspaces.map((w) => (w.id === id ? workspace : w)),
        currentWorkspace: state.currentWorkspace?.id === id ? workspace : state.currentWorkspace,
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

  deleteWorkspace: async (id) => {
    set({ loading: true, error: null });
    try {
      await apiClient.deleteWorkspace(id);
      set((state) => ({
        workspaces: state.workspaces.filter((w) => w.id !== id),
        currentWorkspace: state.currentWorkspace?.id === id ? null : state.currentWorkspace,
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

  fetchFigmaFiles: async (workspaceId) => {
    try {
      const { files } = await apiClient.getFigmaFiles(workspaceId);
      set({ figmaFiles: files });
    } catch (error) {
      console.error('Failed to fetch Figma files:', error);
    }
  },

  addFigmaFile: async (workspaceId, data) => {
    try {
      const { file } = await apiClient.addFigmaFile(workspaceId, data);
      set((state) => {
        const exists = state.figmaFiles.some((f) => f.id === file.id);
        return {
          figmaFiles: exists
            ? state.figmaFiles.map((f) => (f.id === file.id ? file : f))
            : [...state.figmaFiles, file],
        };
      });
    } catch (error) {
      console.error('Failed to add Figma file:', error);
      throw error;
    }
  },

  deleteFigmaFile: async (workspaceId, fileId) => {
    try {
      await apiClient.deleteFigmaFile(workspaceId, fileId);
      set((state) => ({
        figmaFiles: state.figmaFiles.filter((f) => f.id !== fileId),
      }));
      // Refresh conflicts — server dismisses orphaned conflicts on delete
      await get().fetchConflicts(workspaceId, 'active');
    } catch (error) {
      console.error('Failed to delete Figma file:', error);
      throw error;
    }
  },

  fetchConflicts: async (workspaceId, status) => {
    try {
      const { conflicts } = await apiClient.getConflicts(workspaceId, status);
      set({ conflicts });
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
    }
  },

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

  // ==========================================
  // Members & Invitations
  // ==========================================

  fetchMembers: async (workspaceId) => {
    try {
      const { members } = await apiClient.getWorkspaceMembers(workspaceId);
      set({ members });
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  },

  inviteMember: async (workspaceId, email, role = 'member') => {
    await apiClient.inviteMember(workspaceId, email, role);
    get().fetchInvitations(workspaceId);
  },

  removeMember: async (workspaceId, userId) => {
    await apiClient.removeMember(workspaceId, userId);
    get().fetchMembers(workspaceId);
  },

  updateMemberRole: async (workspaceId, userId, role) => {
    await apiClient.updateMemberRole(workspaceId, userId, role);
    get().fetchMembers(workspaceId);
  },

  fetchInvitations: async (workspaceId) => {
    try {
      const { invitations } = await apiClient.getWorkspaceInvitations(workspaceId);
      set({ invitations });
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  },

  cancelInvitation: async (workspaceId, invitationId) => {
    await apiClient.cancelInvitation(workspaceId, invitationId);
    get().fetchInvitations(workspaceId);
  },

  fetchMyInvitations: async () => {
    try {
      const { invitations } = await apiClient.getMyInvitations();
      set({ myInvitations: invitations });
    } catch (error) {
      console.error('Failed to fetch my invitations:', error);
    }
  },

  acceptInvitation: async (token) => {
    await apiClient.acceptInvitation(token);
    set((state) => ({
      myInvitations: state.myInvitations.filter((i) => i.token !== token),
    }));
    get().fetchWorkspaces();
  },

  rejectInvitation: async (token) => {
    await apiClient.rejectInvitation(token);
    set((state) => ({
      myInvitations: state.myInvitations.filter((i) => i.token !== token),
    }));
  },

  leaveWorkspace: async (workspaceId, userId) => {
    await apiClient.removeMember(workspaceId, userId);
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
      currentWorkspace: state.currentWorkspace?.id === workspaceId ? null : state.currentWorkspace,
    }));
  },
}));
