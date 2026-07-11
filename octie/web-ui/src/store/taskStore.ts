import { create } from 'zustand';
import type {
  Task,
  GraphData,
  ProjectStats,
  TaskQueryOptions,
  ApiResponse,
} from '../types';

interface TaskState {
  // State
  tasks: Task[];
  selectedTaskId: string | null;
  loading: boolean;
  error: string | null;
  queryOptions: TaskQueryOptions;
  currentProjectPath: string | null;

  // Graph state
  graphData: GraphData | null;
  projectStats: ProjectStats | null;

  // Actions
  setQueryOptions: (options: TaskQueryOptions | ((prev: TaskQueryOptions) => TaskQueryOptions)) => void;
  setSelectedTask: (taskId: string | null) => void;
  setCurrentProjectPath: (path: string | null) => void;
  clearError: () => void;

  // API actions
  fetchTasks: () => Promise<void>;
  fetchTask: (id: string) => Promise<Task>;
  // Graph actions
  fetchGraph: () => Promise<void>;
  fetchStats: () => Promise<void>;
}

const API_BASE = '/api';

/**
 * Build URL with project path query parameter
 */
function buildUrl(endpoint: string, projectPath: string | null, additionalParams?: URLSearchParams): string {
  const params = additionalParams || new URLSearchParams();
  if (projectPath) {
    params.set('project', projectPath);
  }
  const queryString = params.toString();
  return `${API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;
}

export const useTaskStore = create<TaskState>()((set, get) => {
  return {
  // Initial state
  tasks: [],
  selectedTaskId: null,
  loading: false,
  error: null,
  queryOptions: {},
  currentProjectPath: null,
  graphData: null,
  projectStats: null,

  // Actions
  setQueryOptions: (options) => {
    set((state) => ({
      queryOptions: typeof options === 'function'
        ? options(state.queryOptions)
        : options
    }));
    get().fetchTasks();
  },

  setSelectedTask: (taskId) => {
    set({ selectedTaskId: taskId });
  },

  setCurrentProjectPath: (path) => {
    set({ currentProjectPath: path });
  },

  clearError: () => {
    set({ error: null });
  },

  // API actions
  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const { queryOptions, currentProjectPath } = get();
      const params = new URLSearchParams();
      if (queryOptions.status) params.append('status', queryOptions.status);
      if (queryOptions.priority) params.append('priority', queryOptions.priority);
      if (queryOptions.search) params.append('search', queryOptions.search);
      if (queryOptions.limit) params.append('limit', queryOptions.limit.toString());
      if (queryOptions.offset) params.append('offset', queryOptions.offset.toString());

      const url = buildUrl('/tasks', currentProjectPath, params);
      const response = await fetch(url);
      const result: ApiResponse<{ tasks: Task[]; total: number }> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to fetch tasks');
      }

      set({ tasks: result.data?.tasks || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  fetchTask: async (id) => {
    const { currentProjectPath } = get();
    const response = await fetch(buildUrl(`/tasks/${id}`, currentProjectPath));
    const result: ApiResponse<Task> = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error?.message || 'Failed to fetch task');
    }

    return result.data!;
  },

  // Graph actions
  fetchGraph: async () => {
    set({ loading: true, error: null });
    try {
      const { currentProjectPath } = get();
      const response = await fetch(buildUrl('/graph', currentProjectPath));
      const result: ApiResponse<GraphData> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to fetch graph');
      }

      set({ graphData: result.data || null, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const { currentProjectPath } = get();
      const response = await fetch(buildUrl('/stats', currentProjectPath));
      const result: ApiResponse<ProjectStats> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to fetch stats');
      }

      set({ projectStats: result.data || null, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  };
});
