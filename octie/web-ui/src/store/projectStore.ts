/**
 * Project Store - Zustand store for multi-project management
 */

import { create } from 'zustand';

/**
 * Project entry from the registry
 */
export interface RegistryProject {
  path: string;
  name: string;
  registeredAt: string;
  lastAccessed: string;
  taskCount: number;
  exists: boolean;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
}

/**
 * Registry response from API
 */
interface ProjectsResponse {
  projects: RegistryProject[];
  count: number;
}

interface ProjectState {
  // State
  projects: RegistryProject[];
  currentProjectPath: string | null;
  loading: boolean;
  error: string | null;
  sidebarOpen: boolean;

  // Actions
  setCurrentProject: (path: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  clearError: () => void;

  // API actions
  fetchProjects: () => Promise<void>;
  removeProject: (path: string) => Promise<void>;

  // URL helpers
  getProjectFromUrl: () => string | null;
  setProjectInUrl: (path: string | null) => void;
}

const API_BASE = '/api';

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projects: [],
  currentProjectPath: null,
  loading: false,
  error: null,
  sidebarOpen: true,

  // Actions
  setCurrentProject: (path) => {
    set({ currentProjectPath: path });
    get().setProjectInUrl(path);
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  clearError: () => set({ error: null }),

  // API actions
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/projects`);
      const data: ApiResponse<ProjectsResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || 'Failed to fetch projects');
      }

      set({ projects: data.data.projects, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch projects',
        loading: false,
      });
    }
  },

  removeProject: async (path) => {
    try {
      const encodedPath = encodeURIComponent(path);
      const response = await fetch(`${API_BASE}/projects/${encodedPath}`, {
        method: 'DELETE',
      });
      const data: ApiResponse<{ removed: boolean }> = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to remove project');
      }

      // Refresh project list
      get().fetchProjects();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to remove project',
      });
    }
  },

  // URL helpers
  getProjectFromUrl: () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('project');
  },

  setProjectInUrl: (path) => {
    const url = new URL(window.location.href);
    if (path) {
      url.searchParams.set('project', path);
    } else {
      url.searchParams.delete('project');
    }
    window.history.replaceState({}, '', url.toString());
  },
}));

/**
 * Generic API response type
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
