// API Service for Advanced Scheduling module
import { WorkOrder, CreateWorkOrderPayload, UpdateWorkOrderPayload, WorkOrderFilters } from '../types/WorkOrder';
import { ScheduledTask, ScheduleTaskRequest, UpdateTaskPayload, TaskFilters } from '../types/ScheduledTask';
import { OptimizationResult, OptimizationParameters, OptimizationStatus } from '../types/OptimizationResult';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class SchedulingApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Helper method for making API requests
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      // Add authentication header if available
      ...(typeof window !== 'undefined' && localStorage.getItem('auth_token') && {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      })
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return {} as T;
      }
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Work Order API methods
  async getWorkOrders(filters?: WorkOrderFilters): Promise<WorkOrder[]> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      if (filters.status) queryParams.append('status', filters.status.join(','));
      if (filters.priority) queryParams.append('priority', filters.priority.join(','));
      if (filters.skills) queryParams.append('skills', filters.skills.join(','));
      if (filters.tags) queryParams.append('tags', filters.tags.join(','));
      if (filters.dateRange) {
        queryParams.append('startDate', filters.dateRange.start);
        queryParams.append('endDate', filters.dateRange.end);
      }
      if (filters.customer) queryParams.append('customer', filters.customer);
      if (filters.assignedResource) queryParams.append('assignedResource', filters.assignedResource);
    }

    const queryString = queryParams.toString();
    const endpoint = `/api/work-orders${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<WorkOrder[]>(endpoint);
  }

  async getWorkOrder(id: string): Promise<WorkOrder> {
    return this.makeRequest<WorkOrder>(`/api/work-orders/${id}`);
  }

  async createWorkOrder(workOrder: CreateWorkOrderPayload): Promise<WorkOrder> {
    return this.makeRequest<WorkOrder>('/api/work-orders', {
      method: 'POST',
      body: JSON.stringify(workOrder),
    });
  }

  async updateWorkOrder(id: string, updates: UpdateWorkOrderPayload): Promise<WorkOrder> {
    return this.makeRequest<WorkOrder>(`/api/work-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteWorkOrder(id: string): Promise<void> {
    return this.makeRequest<void>(`/api/work-orders/${id}`, {
      method: 'DELETE',
    });
  }

  // Scheduled Task API methods
  async getScheduledTasks(filters?: TaskFilters): Promise<ScheduledTask[]> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      if (filters.status) queryParams.append('status', filters.status.join(','));
      if (filters.resourceType) queryParams.append('resourceType', filters.resourceType.join(','));
      if (filters.resourceId) queryParams.append('resourceId', filters.resourceId.join(','));
      if (filters.dateRange) {
        queryParams.append('startDate', filters.dateRange.start);
        queryParams.append('endDate', filters.dateRange.end);
      }
      if (filters.workOrderId) queryParams.append('workOrderId', filters.workOrderId);
      if (filters.hasConflicts !== undefined) queryParams.append('hasConflicts', filters.hasConflicts.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/api/scheduled-tasks${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ScheduledTask[]>(endpoint);
  }

  async getScheduledTask(id: string): Promise<ScheduledTask> {
    return this.makeRequest<ScheduledTask>(`/api/scheduled-tasks/${id}`);
  }

  async scheduleTask(request: ScheduleTaskRequest): Promise<ScheduledTask> {
    return this.makeRequest<ScheduledTask>('/api/scheduled-tasks', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateScheduledTask(id: string, updates: UpdateTaskPayload): Promise<ScheduledTask> {
    return this.makeRequest<ScheduledTask>(`/api/scheduled-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteScheduledTask(id: string): Promise<void> {
    return this.makeRequest<void>(`/api/scheduled-tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Schedule Optimization API methods
  async optimizeSchedule(parameters: OptimizationParameters): Promise<{ optimizationId: string }> {
    return this.makeRequest<{ optimizationId: string }>('/api/scheduler/optimize', {
      method: 'POST',
      body: JSON.stringify(parameters),
    });
  }

  async getOptimizationStatus(optimizationId: string): Promise<OptimizationStatus> {
    return this.makeRequest<OptimizationStatus>(`/api/scheduler/optimization/${optimizationId}/status`);
  }

  async getOptimizationResult(optimizationId: string): Promise<OptimizationResult> {
    return this.makeRequest<OptimizationResult>(`/api/scheduler/optimization/${optimizationId}/result`);
  }

  async applyOptimization(optimizationId: string): Promise<{ applied: boolean; tasksUpdated: number }> {
    return this.makeRequest<{ applied: boolean; tasksUpdated: number }>(`/api/scheduler/optimization/${optimizationId}/apply`, {
      method: 'POST',
    });
  }

  async cancelOptimization(optimizationId: string): Promise<void> {
    return this.makeRequest<void>(`/api/scheduler/optimization/${optimizationId}/cancel`, {
      method: 'POST',
    });
  }

  async getOptimizationHistory(limit?: number): Promise<OptimizationResult[]> {
    const queryString = limit ? `?limit=${limit}` : '';
    return this.makeRequest<OptimizationResult[]>(`/api/scheduler/optimization/history${queryString}`);
  }

  // Analytics API methods
  async getResourceUtilization(startDate: string, endDate: string): Promise<any> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate
    });
    return this.makeRequest<any>(`/api/analytics/utilization?${queryParams}`);
  }

  async getPerformanceMetrics(startDate: string, endDate: string): Promise<any> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate
    });
    return this.makeRequest<any>(`/api/analytics/performance?${queryParams}`);
  }

  async getDashboardSummary(): Promise<any> {
    return this.makeRequest<any>('/api/scheduler/dashboard');
  }

  // Calendar export methods
  async exportCalendar(format: 'ics' | 'json' | 'csv', filters?: TaskFilters): Promise<Blob> {
    const queryParams = new URLSearchParams({ format });
    
    if (filters) {
      if (filters.dateRange) {
        queryParams.append('startDate', filters.dateRange.start);
        queryParams.append('endDate', filters.dateRange.end);
      }
      if (filters.resourceId) queryParams.append('resourceId', filters.resourceId.join(','));
    }

    const response = await fetch(`${this.baseUrl}/api/scheduler/export?${queryParams}`, {
      headers: {
        ...(typeof window !== 'undefined' && localStorage.getItem('auth_token') && {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        })
      }
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Resource management methods
  async getAvailableResources(startDate: string, endDate: string): Promise<any[]> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate
    });
    return this.makeRequest<any[]>(`/api/resources/availability?${queryParams}`);
  }

  async getResourceSchedule(resourceId: string, startDate: string, endDate: string): Promise<ScheduledTask[]> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate
    });
    return this.makeRequest<ScheduledTask[]>(`/api/resources/${resourceId}/schedule?${queryParams}`);
  }

  // Conflict detection and resolution
  async detectConflicts(taskIds?: string[]): Promise<any[]> {
    const body = taskIds ? { taskIds } : {};
    return this.makeRequest<any[]>('/api/scheduler/conflicts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async resolveConflict(conflictId: string, resolution: any): Promise<any> {
    return this.makeRequest<any>(`/api/scheduler/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution),
    });
  }

  // Batch operations
  async bulkUpdateTasks(updates: Array<{ taskId: string; updates: UpdateTaskPayload }>): Promise<{ updated: number; errors: any[] }> {
    return this.makeRequest<{ updated: number; errors: any[] }>('/api/scheduled-tasks/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  }

  async bulkDeleteTasks(taskIds: string[]): Promise<{ deleted: number; errors: any[] }> {
    return this.makeRequest<{ deleted: number; errors: any[] }>('/api/scheduled-tasks/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
  }

  // Real-time updates (WebSocket support)
  createWebSocketConnection(onMessage: (data: any) => void, onError: (error: Event) => void): WebSocket | null {
    if (typeof window === 'undefined') return null;

    try {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/api/scheduler/ws';
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = onError;

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest<{ status: string; timestamp: string }>('/api/health');
  }
}

// Create a singleton instance
export const schedulingApi = new SchedulingApiService();
export default SchedulingApiService;
