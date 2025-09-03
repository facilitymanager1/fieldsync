import { useState, useCallback } from 'react';
import { OptimizationResult, OptimizationParameters, OptimizationStatus } from '../types/OptimizationResult';
import { WorkOrder } from '../types/WorkOrder';
import { ScheduledTask } from '../types/ScheduledTask';
import { schedulingApi } from '../services/SchedulingApiService';

interface UseOptimizationReturn {
  optimizationResults: OptimizationResult | null;
  optimizationStatus: OptimizationStatus | null;
  loading: boolean;
  error: string | null;
  optimizeSchedule: (workOrders: WorkOrder[], parameters: OptimizationParameters) => Promise<void>;
  applyOptimization: (optimizationId: string) => Promise<void>;
  cancelOptimization: (optimizationId: string) => Promise<void>;
  getOptimizationHistory: () => Promise<OptimizationResult[]>;
  compareOptimizations: (baselineId: string, optimizedId: string) => Promise<any>;
  clearResults: () => void;
}

export const useOptimization = (): UseOptimizationReturn => {
  const [optimizationResults, setOptimizationResults] = useState<OptimizationResult | null>(null);
  const [optimizationStatus, setOptimizationStatus] = useState<OptimizationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimizeSchedule = useCallback(async (workOrders: WorkOrder[], parameters: OptimizationParameters) => {
    setLoading(true);
    setError(null);
    
    try {
      // Start optimization through API
      const { optimizationId } = await schedulingApi.optimizeSchedule(parameters);
      
      // Create initial status
      const initialStatus: OptimizationStatus = {
        id: optimizationId,
        status: 'queued',
        progress: {
          percentage: 0,
          currentPhase: 'Optimization queued',
          currentIteration: 0,
          totalIterations: parameters.algorithmSettings.maxIterations || 1000
        },
        startTime: new Date().toISOString(),
        resources: {
          cpuUsage: 0,
          memoryUsage: 0,
          priority: 'normal'
        },
        messages: [{
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Optimization request submitted'
        }]
      };
      
      setOptimizationStatus(initialStatus);

      // Poll for status updates
      const pollStatus = async () => {
        try {
          const status = await schedulingApi.getOptimizationStatus(optimizationId);
          setOptimizationStatus(status);

          if (status.status === 'completed') {
            // Get the final results
            const result = await schedulingApi.getOptimizationResult(optimizationId);
            setOptimizationResults(result);
            return true; // Stop polling
          } else if (status.status === 'failed' || status.status === 'cancelled') {
            setError(`Optimization ${status.status}`);
            return true; // Stop polling
          }
          
          return false; // Continue polling
        } catch (err) {
          console.error('Failed to poll optimization status:', err);
          setError('Failed to get optimization status');
          return true; // Stop polling on error
        }
      };

      // Start polling every 2 seconds
      const pollInterval = setInterval(async () => {
        const shouldStop = await pollStatus();
        if (shouldStop) {
          clearInterval(pollInterval);
        }
      }, 2000);

      // Initial status check
      setTimeout(() => pollStatus(), 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization failed');
      setOptimizationStatus(prev => prev ? {
        ...prev,
        status: 'failed',
        messages: [
          ...prev.messages,
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Optimization failed: ' + (err instanceof Error ? err.message : 'Unknown error')
          }
        ]
      } : null);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyOptimization = useCallback(async (optimizationId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Apply optimization through API
      const result = await schedulingApi.applyOptimization(optimizationId);
      
      // Update the optimization result status
      setOptimizationResults(prev => prev ? {
        ...prev,
        status: 'applied',
        appliedAt: new Date().toISOString(),
        appliedBy: 'current_user'
      } : null);
      
      console.log(`Applied optimization: ${result.tasksUpdated} tasks updated`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply optimization');
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelOptimization = useCallback(async (optimizationId: string) => {
    setLoading(true);
    
    try {
      // Cancel optimization through API
      await schedulingApi.cancelOptimization(optimizationId);
      
      setOptimizationStatus(prev => prev ? {
        ...prev,
        status: 'cancelled',
        actualEndTime: new Date().toISOString(),
        messages: [
          ...prev.messages,
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Optimization cancelled by user'
          }
        ]
      } : null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel optimization');
    } finally {
      setLoading(false);
    }
  }, []);

  const getOptimizationHistory = useCallback(async (): Promise<OptimizationResult[]> => {
    try {
      return await schedulingApi.getOptimizationHistory(10); // Get last 10 optimizations
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get optimization history');
      return [];
    }
  }, []);

  const compareOptimizations = useCallback(async (baselineId: string, optimizedId: string) => {
    try {
      // This would be implemented in the backend API
      // For now, return mock comparison data
      return {
        improvements: {
          totalImprovement: 23.5,
          objectiveImprovements: {
            travel_time: -15.2,
            resource_utilization: 18.7,
            cost: -12.3,
            customer_satisfaction: 8.9
          }
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare optimizations');
      return null;
    }
  }, []);

  const clearResults = useCallback(() => {
    setOptimizationResults(null);
    setOptimizationStatus(null);
    setError(null);
  }, []);

  return {
    optimizationResults,
    optimizationStatus,
    loading,
    error,
    optimizeSchedule,
    applyOptimization,
    cancelOptimization,
    getOptimizationHistory,
    compareOptimizations,
    clearResults
  };
};

// Helper functions to generate mock data
function generateMockScheduledTasks(workOrders: WorkOrder[]): ScheduledTask[] {
  return workOrders.slice(0, Math.floor(workOrders.length * 0.8)).map((wo, index) => ({
    id: `task_${wo.id}_${index}`,
    workOrderId: wo.id,
    assignedResources: [{
      resourceId: `tech_${(index % 5) + 1}`,
      resourceType: 'staff',
      name: `Technician ${(index % 5) + 1}`,
      role: 'primary'
    }],
    scheduledStart: new Date(Date.now() + (index * 2 + 1) * 60 * 60 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + (index * 2 + 1) * 60 * 60 * 1000 + wo.estimatedDuration * 60 * 1000).toISOString(),
    location: wo.location,
    travelTime: {
      toLocation: 10 + Math.random() * 20,
      fromLocation: 10 + Math.random() * 20
    },
    optimizationScore: 75 + Math.random() * 20,
    status: 'scheduled',
    priority: wo.priority === 'critical' ? 90 : wo.priority === 'high' ? 70 : 50,
    constraints: {
      skillRequirements: wo.requiredSkills,
      timeWindows: [],
      resourceConstraints: [],
      dependencies: []
    },
    createdAt: new Date().toISOString(),
    scheduledBy: 'optimization_engine'
  }));
}

function generateMockResourceUtilization() {
  return Array.from({ length: 5 }, (_, index) => ({
    resourceId: `tech_${index + 1}`,
    resourceName: `Technician ${index + 1}`,
    resourceType: 'staff' as const,
    totalAvailableTime: 480, // 8 hours
    scheduledTime: 300 + Math.random() * 120,
    utilizationPercentage: 65 + Math.random() * 25,
    efficiency: 80 + Math.random() * 15,
    taskCount: 3 + Math.floor(Math.random() * 4),
    travelTime: 30 + Math.random() * 30,
    idleTime: 60 + Math.random() * 60,
    overtimeHours: Math.random() * 2,
    tasks: [],
    performance: {
      averageTaskDuration: 90 + Math.random() * 30,
      longestGap: 15 + Math.random() * 45,
      numberOfGaps: 1 + Math.floor(Math.random() * 3),
      workloadBalance: 70 + Math.random() * 25
    }
  }));
}

function generateMockRecommendations() {
  return [
    {
      id: 'rec_1',
      type: 'performance_improvement' as const,
      priority: 'high' as const,
      title: 'Optimize morning schedule arrangement',
      description: 'Rearranging morning tasks could reduce travel time by 15% and improve resource utilization.',
      expectedBenefit: {
        scoreImprovement: 5.2,
        timeReduction: 45,
        utilizationImprovement: 8.5
      },
      implementation: {
        effort: 'low' as const,
        timeRequired: 'Immediate',
        requiredActions: ['Reschedule 3 morning tasks', 'Adjust technician routes']
      },
      category: 'immediate' as const
    },
    {
      id: 'rec_2',
      type: 'resource_optimization' as const,
      priority: 'medium' as const,
      title: 'Consider additional technician for peak hours',
      description: 'Adding one technician during peak hours (10-14) would significantly improve schedule efficiency.',
      expectedBenefit: {
        scoreImprovement: 12.8,
        utilizationImprovement: 15.2
      },
      implementation: {
        effort: 'high' as const,
        timeRequired: '1-2 weeks',
        requiredActions: ['Hire additional technician', 'Adjust schedule templates']
      },
      category: 'short_term' as const
    }
  ];
}

export default useOptimization;
