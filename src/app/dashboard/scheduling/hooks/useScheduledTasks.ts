import { useState, useCallback, useEffect } from 'react';
import { ScheduledTask, ScheduleTaskRequest, UpdateTaskPayload, TaskFilters } from '../types/ScheduledTask';
import { schedulingApi } from '../services/SchedulingApiService';

interface UseScheduledTasksReturn {
  scheduledTasks: ScheduledTask[];
  loading: boolean;
  error: string | null;
  selectedTask: ScheduledTask | null;
  totalCount: number;
  fetchScheduledTasks: (filters?: TaskFilters) => Promise<void>;
  scheduleTask: (request: ScheduleTaskRequest) => Promise<ScheduledTask>;
  updateScheduledTask: (id: string, updates: UpdateTaskPayload) => Promise<ScheduledTask>;
  deleteScheduledTask: (id: string) => Promise<void>;
  selectTask: (task: ScheduledTask | null) => void;
  refreshTasks: () => Promise<void>;
  clearError: () => void;
}

export const useScheduledTasks = (initialFilters?: TaskFilters): UseScheduledTasksReturn => {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<TaskFilters | undefined>(initialFilters);

  const fetchScheduledTasks = useCallback(async (filters?: TaskFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchFilters = filters || currentFilters;
      setCurrentFilters(fetchFilters);
      
      const data = await schedulingApi.getScheduledTasks(fetchFilters);
      setScheduledTasks(data);
      setTotalCount(data.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch scheduled tasks';
      setError(errorMessage);
      console.error('Failed to fetch scheduled tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFilters]);

  const scheduleTask = useCallback(async (request: ScheduleTaskRequest): Promise<ScheduledTask> => {
    setLoading(true);
    setError(null);
    
    try {
      const newTask = await schedulingApi.scheduleTask(request);
      
      // Add to local state
      setScheduledTasks(prev => [newTask, ...prev]);
      setTotalCount(prev => prev + 1);
      
      return newTask;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to schedule task';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateScheduledTask = useCallback(async (id: string, updates: UpdateTaskPayload): Promise<ScheduledTask> => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedTask = await schedulingApi.updateScheduledTask(id, updates);
      
      // Update local state
      setScheduledTasks(prev => 
        prev.map(task => task.id === id ? updatedTask : task)
      );
      
      // Update selected task if it's the one being updated
      if (selectedTask?.id === id) {
        setSelectedTask(updatedTask);
      }
      
      return updatedTask;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update scheduled task';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedTask]);

  const deleteScheduledTask = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await schedulingApi.deleteScheduledTask(id);
      
      // Remove from local state
      setScheduledTasks(prev => prev.filter(task => task.id !== id));
      setTotalCount(prev => prev - 1);
      
      // Clear selection if deleted task was selected
      if (selectedTask?.id === id) {
        setSelectedTask(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete scheduled task';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedTask]);

  const selectTask = useCallback((task: ScheduledTask | null) => {
    setSelectedTask(task);
  }, []);

  const refreshTasks = useCallback(async () => {
    await fetchScheduledTasks(currentFilters);
  }, [fetchScheduledTasks, currentFilters]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load
  useEffect(() => {
    fetchScheduledTasks(initialFilters);
  }, []); // Only run on mount

  return {
    scheduledTasks,
    loading,
    error,
    selectedTask,
    totalCount,
    fetchScheduledTasks,
    scheduleTask,
    updateScheduledTask,
    deleteScheduledTask,
    selectTask,
    refreshTasks,
    clearError
  };
};

// Hook for real-time task updates via WebSocket
export const useRealTimeTaskUpdates = (onTaskUpdate: (task: ScheduledTask) => void) => {
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    const ws = schedulingApi.createWebSocketConnection(
      (data) => {
        if (data.type === 'task_updated' && data.task) {
          onTaskUpdate(data.task);
        }
      },
      (error) => {
        setWsError('WebSocket connection failed');
        setConnected(false);
        console.error('WebSocket error:', error);
      }
    );

    if (ws) {
      ws.onopen = () => {
        setConnected(true);
        setWsError(null);
      };

      ws.onclose = () => {
        setConnected(false);
      };

      return () => {
        ws.close();
      };
    }
  }, [onTaskUpdate]);

  return { connected, wsError };
};

// Hook for task conflicts
export const useTaskConflicts = () => {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectConflicts = useCallback(async (taskIds?: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await schedulingApi.detectConflicts(taskIds);
      setConflicts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to detect conflicts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveConflict = useCallback(async (conflictId: string, resolution: any) => {
    setLoading(true);
    setError(null);
    
    try {
      await schedulingApi.resolveConflict(conflictId, resolution);
      
      // Remove resolved conflict from local state
      setConflicts(prev => prev.filter(conflict => conflict.id !== conflictId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve conflict';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    conflicts,
    loading,
    error,
    detectConflicts,
    resolveConflict
  };
};

// Hook for bulk task operations
export const useBulkTaskOperations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkUpdateTasks = useCallback(async (updates: Array<{ taskId: string; updates: UpdateTaskPayload }>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await schedulingApi.bulkUpdateTasks(updates);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk update tasks';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkDeleteTasks = useCallback(async (taskIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await schedulingApi.bulkDeleteTasks(taskIds);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk delete tasks';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    bulkUpdateTasks,
    bulkDeleteTasks
  };
};

export default useScheduledTasks;
