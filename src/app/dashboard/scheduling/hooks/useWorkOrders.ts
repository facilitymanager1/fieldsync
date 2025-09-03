import { useState, useCallback, useEffect } from 'react';
import { WorkOrder, CreateWorkOrderPayload, UpdateWorkOrderPayload, WorkOrderFilters } from '../types/WorkOrder';
import { schedulingApi } from '../services/SchedulingApiService';

interface UseWorkOrdersReturn {
  workOrders: WorkOrder[];
  loading: boolean;
  error: string | null;
  selectedWorkOrder: WorkOrder | null;
  totalCount: number;
  fetchWorkOrders: (filters?: WorkOrderFilters) => Promise<void>;
  createWorkOrder: (workOrder: CreateWorkOrderPayload) => Promise<WorkOrder>;
  updateWorkOrder: (id: string, updates: UpdateWorkOrderPayload) => Promise<WorkOrder>;
  deleteWorkOrder: (id: string) => Promise<void>;
  selectWorkOrder: (workOrder: WorkOrder | null) => void;
  refreshWorkOrders: () => Promise<void>;
  clearError: () => void;
}

export const useWorkOrders = (initialFilters?: WorkOrderFilters): UseWorkOrdersReturn => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<WorkOrderFilters | undefined>(initialFilters);

  const fetchWorkOrders = useCallback(async (filters?: WorkOrderFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchFilters = filters || currentFilters;
      setCurrentFilters(fetchFilters);
      
      const data = await schedulingApi.getWorkOrders(fetchFilters);
      setWorkOrders(data);
      setTotalCount(data.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch work orders';
      setError(errorMessage);
      console.error('Failed to fetch work orders:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFilters]);

  const createWorkOrder = useCallback(async (workOrder: CreateWorkOrderPayload): Promise<WorkOrder> => {
    setLoading(true);
    setError(null);
    
    try {
      const newWorkOrder = await schedulingApi.createWorkOrder(workOrder);
      
      // Add to local state
      setWorkOrders(prev => [newWorkOrder, ...prev]);
      setTotalCount(prev => prev + 1);
      
      return newWorkOrder;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create work order';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWorkOrder = useCallback(async (id: string, updates: UpdateWorkOrderPayload): Promise<WorkOrder> => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedWorkOrder = await schedulingApi.updateWorkOrder(id, updates);
      
      // Update local state
      setWorkOrders(prev => 
        prev.map(wo => wo.id === id ? updatedWorkOrder : wo)
      );
      
      // Update selected work order if it's the one being updated
      if (selectedWorkOrder?.id === id) {
        setSelectedWorkOrder(updatedWorkOrder);
      }
      
      return updatedWorkOrder;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update work order';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedWorkOrder]);

  const deleteWorkOrder = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await schedulingApi.deleteWorkOrder(id);
      
      // Remove from local state
      setWorkOrders(prev => prev.filter(wo => wo.id !== id));
      setTotalCount(prev => prev - 1);
      
      // Clear selection if deleted work order was selected
      if (selectedWorkOrder?.id === id) {
        setSelectedWorkOrder(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete work order';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedWorkOrder]);

  const selectWorkOrder = useCallback((workOrder: WorkOrder | null) => {
    setSelectedWorkOrder(workOrder);
  }, []);

  const refreshWorkOrders = useCallback(async () => {
    await fetchWorkOrders(currentFilters);
  }, [fetchWorkOrders, currentFilters]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load
  useEffect(() => {
    fetchWorkOrders(initialFilters);
  }, []); // Only run on mount

  return {
    workOrders,
    loading,
    error,
    selectedWorkOrder,
    totalCount,
    fetchWorkOrders,
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    selectWorkOrder,
    refreshWorkOrders,
    clearError
  };
};

// Additional hook for work order statistics
export const useWorkOrderStats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // This would call a dedicated stats endpoint
      const data = await schedulingApi.getDashboardSummary();
      setStats(data.workOrderStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch work order statistics';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
};

export default useWorkOrders;
