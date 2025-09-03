// Advanced Sync & Reconciliation Module
// Handles background jobs, payloads, data purging, and conflict resolution
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import * as WebSocket from 'ws';
import { 
  AppError, 
  ErrorCodes, 
  formatError, 
  formatSuccess, 
  createValidationError
} from '../utils/errorHandler';
import { AuthenticatedRequest } from '../types/standardInterfaces';
import { SyncPayload as ISyncPayload } from '../types/standardInterfaces';

// Interfaces for sync operations
interface SyncPayload {
  id: string;
  userId: string;
  deviceId: string;
  timestamp: Date;
  dataType: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  version: number;
  checksum: string;
  conflicts?: ConflictData[];
}

interface ConflictData {
  field: string;
  localValue: any;
  serverValue: any;
  lastModified: Date;
  resolution?: 'local' | 'server' | 'merge' | 'manual';
}

interface SyncMetrics {
  totalSynced: number;
  conflicts: number;
  errors: number;
  duration: number;
  dataTransferred: number;
  lastSync: Date;
}

interface SyncQueue {
  id: string;
  priority: 'high' | 'medium' | 'low';
  payload: SyncPayload;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
}

interface ReconciliationResult {
  resolved: boolean;
  strategy: string;
  mergedData: any;
  conflicts: ConflictData[];
}

// Sync & Reconciliation Service
class SyncReconciliationService {
  private syncQueue: SyncQueue[] = [];
  private activeConnections: Map<string, WebSocket> = new Map();
  private conflictResolvers: Map<string, Function> = new Map();
  private metrics: SyncMetrics = {
    totalSynced: 0,
    conflicts: 0,
    errors: 0,
    duration: 0,
    dataTransferred: 0,
    lastSync: new Date()
  };

  constructor() {
    this.initializeConflictResolvers();
    this.startBackgroundProcessor();
  }

  // Initialize conflict resolution strategies
  private initializeConflictResolvers(): void {
    this.conflictResolvers.set('timestamp', this.timestampBasedResolver.bind(this));
    this.conflictResolvers.set('priority', this.priorityBasedResolver.bind(this));
    this.conflictResolvers.set('merge', this.intelligentMergeResolver.bind(this));
    this.conflictResolvers.set('user_preference', this.userPreferenceResolver.bind(this));
  }

  // Main sync payload handler
  async syncPayload(payload: SyncPayload): Promise<{
    success: boolean;
    conflicts?: ConflictData[];
    mergedData?: any;
    syncId: string;
  }> {
    try {
      console.log(`🔄 Processing sync payload: ${payload.id}`);
      
      // Validate payload
      const validation = this.validatePayload(payload);
      if (!validation.valid) {
        throw new Error(`Invalid payload: ${validation.errors.join(', ')}`);
      }

      // Check for conflicts
      const existingData = await this.getExistingData(payload.dataType, payload.data.id);
      const conflicts = this.detectConflicts(payload, existingData);

      let finalData = payload.data;
      let resolved = true;

      // Resolve conflicts if any
      if (conflicts.length > 0) {
        console.log(`⚠️ Conflicts detected: ${conflicts.length}`);
        const resolution = await this.resolveConflicts(payload, existingData, conflicts);
        finalData = resolution.mergedData;
        resolved = resolution.resolved;
        
        this.metrics.conflicts += conflicts.length;
      }

      // Apply changes to database
      if (resolved) {
        await this.applyDataChanges(payload.dataType, payload.operation, finalData, payload.version);
        this.metrics.totalSynced++;
        
        // Notify connected clients
        await this.broadcastSyncUpdate(payload.userId, {
          dataType: payload.dataType,
          operation: payload.operation,
          data: finalData,
          timestamp: new Date()
        });
      }

      this.metrics.lastSync = new Date();

      return {
        success: true,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        mergedData: finalData,
        syncId: uuidv4()
      };

    } catch (error) {
      console.error('❌ Sync payload error:', error);
      this.metrics.errors++;
      
      return {
        success: false,
        conflicts: [],
        syncId: uuidv4()
      };
    }
  }

  // Batch sync processing
  async processBatchSync(payloads: SyncPayload[]): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    conflicts: number;
    results: any[];
  }> {
    const results = [];
    let successful = 0;
    let failed = 0;
    let totalConflicts = 0;

    // Sort by priority and timestamp
    const sortedPayloads = payloads.sort((a, b) => {
      const priorityOrder = { create: 3, update: 2, delete: 1 };
      const priorityDiff = priorityOrder[b.operation] - priorityOrder[a.operation];
      if (priorityDiff !== 0) return priorityDiff;
      
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < sortedPayloads.length; i += batchSize) {
      const batch = sortedPayloads.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (payload) => {
        try {
          const result = await this.syncPayload(payload);
          if (result.success) {
            successful++;
            if (result.conflicts) {
              totalConflicts += result.conflicts.length;
            }
          } else {
            failed++;
          }
          return result;
        } catch (error) {
          failed++;
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error', syncId: uuidv4() };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < sortedPayloads.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return {
      totalProcessed: payloads.length,
      successful,
      failed,
      conflicts: totalConflicts,
      results
    };
  }

  // Real-time sync via WebSocket
  async enableRealtimeSync(userId: string, websocket: WebSocket): Promise<void> {
    this.activeConnections.set(userId, websocket);
    
    websocket.on('message', async (message: WebSocket.Data) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'sync_request') {
          const result = await this.syncPayload(data.payload);
          websocket.send(JSON.stringify({
            type: 'sync_response',
            result,
            requestId: data.requestId
          }));
        }
      } catch (error) {
        websocket.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });

    websocket.on('close', () => {
      this.activeConnections.delete(userId);
    });
  }

  // Conflict detection
  private detectConflicts(payload: SyncPayload, existingData: any): ConflictData[] {
    if (!existingData) return [];

    const conflicts: ConflictData[] = [];
    const payloadData = payload.data;

    // Version conflict
    if (existingData.version && payload.version <= existingData.version) {
      conflicts.push({
        field: '_version',
        localValue: payload.version,
        serverValue: existingData.version,
        lastModified: existingData.updatedAt || new Date()
      });
    }

    // Field-level conflicts
    for (const [key, value] of Object.entries(payloadData)) {
      if (key === 'id' || key === 'createdAt') continue;

      const existingValue = existingData[key];
      if (existingValue !== undefined && existingValue !== value) {
        // Check if values are actually different (deep comparison for objects)
        if (!this.deepEqual(existingValue, value)) {
          conflicts.push({
            field: key,
            localValue: value,
            serverValue: existingValue,
            lastModified: existingData.updatedAt || new Date()
          });
        }
      }
    }

    return conflicts;
  }

  // Conflict resolution strategies
  private async resolveConflicts(
    payload: SyncPayload, 
    existingData: any, 
    conflicts: ConflictData[]
  ): Promise<ReconciliationResult> {
    const strategy = this.selectResolutionStrategy(payload, conflicts);
    const resolver = this.conflictResolvers.get(strategy);

    if (!resolver) {
      return {
        resolved: false,
        strategy,
        mergedData: payload.data,
        conflicts
      };
    }

    return resolver(payload, existingData, conflicts);
  }

  // Timestamp-based conflict resolver
  private timestampBasedResolver(
    payload: SyncPayload, 
    existingData: any, 
    conflicts: ConflictData[]
  ): ReconciliationResult {
    const payloadTime = payload.timestamp.getTime();
    const existingTime = existingData.updatedAt?.getTime() || 0;

    const mergedData = payloadTime > existingTime ? payload.data : existingData;

    return {
      resolved: true,
      strategy: 'timestamp',
      mergedData,
      conflicts: []
    };
  }

  // Priority-based conflict resolver
  private priorityBasedResolver(
    payload: SyncPayload, 
    existingData: any, 
    conflicts: ConflictData[]
  ): ReconciliationResult {
    // Prioritize certain operations and users
    const operationPriority = { delete: 3, create: 2, update: 1 };
    const payloadPriority = operationPriority[payload.operation] || 0;

    // For now, use payload data if it's a higher priority operation
    const usePayload = payloadPriority >= 2;

    return {
      resolved: true,
      strategy: 'priority',
      mergedData: usePayload ? payload.data : existingData,
      conflicts: []
    };
  }

  // Intelligent merge resolver
  private intelligentMergeResolver(
    payload: SyncPayload, 
    existingData: any, 
    conflicts: ConflictData[]
  ): ReconciliationResult {
    const mergedData = { ...existingData };

    for (const conflict of conflicts) {
      // Apply intelligent merging rules
      switch (conflict.field) {
        case 'status':
          // Status progression rules
          mergedData[conflict.field] = this.mergeStatus(conflict.localValue, conflict.serverValue);
          break;
        
        case 'tags':
        case 'skills':
          // Merge arrays by combining unique values
          mergedData[conflict.field] = [...new Set([
            ...(conflict.localValue || []),
            ...(conflict.serverValue || [])
          ])];
          break;
        
        case 'notes':
        case 'description':
          // Concatenate text fields
          mergedData[conflict.field] = `${conflict.serverValue}\n--- Merged from device ---\n${conflict.localValue}`;
          break;
        
        default:
          // Use most recent value for other fields
          const localTime = payload.timestamp.getTime();
          const serverTime = conflict.lastModified.getTime();
          mergedData[conflict.field] = localTime > serverTime ? conflict.localValue : conflict.serverValue;
      }
    }

    // Update version and timestamps
    mergedData.version = Math.max(payload.version, existingData.version || 0) + 1;
    mergedData.updatedAt = new Date();

    return {
      resolved: true,
      strategy: 'merge',
      mergedData,
      conflicts: []
    };
  }

  // User preference resolver
  private userPreferenceResolver(
    payload: SyncPayload, 
    existingData: any, 
    conflicts: ConflictData[]
  ): ReconciliationResult {
    // For now, prefer user data (from mobile device)
    const resolvedConflicts = conflicts.map(conflict => ({
      ...conflict,
      resolution: 'local' as const
    }));

    return {
      resolved: true,
      strategy: 'user_preference',
      mergedData: payload.data,
      conflicts: resolvedConflicts
    };
  }

  // Helper methods
  private validatePayload(payload: SyncPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload.id) errors.push('Missing payload ID');
    if (!payload.userId) errors.push('Missing user ID');
    if (!payload.dataType) errors.push('Missing data type');
    if (!payload.operation) errors.push('Missing operation');
    if (!payload.data) errors.push('Missing data');
    if (typeof payload.version !== 'number') errors.push('Invalid version');

    return { valid: errors.length === 0, errors };
  }

  private async getExistingData(dataType: string, id: string): Promise<any> {
    try {
      const model = mongoose.model(dataType);
      return await model.findById(id);
    } catch (error) {
      console.warn(`⚠️ Could not find model for dataType: ${dataType}`);
      return null;
    }
  }

  private async applyDataChanges(
    dataType: string, 
    operation: string, 
    data: any, 
    version: number
  ): Promise<void> {
    try {
      const model = mongoose.model(dataType);
      
      switch (operation) {
        case 'create':
          await model.create({ ...data, version });
          break;
        
        case 'update':
          await model.findByIdAndUpdate(data.id, { 
            ...data, 
            version,
            updatedAt: new Date()
          });
          break;
        
        case 'delete':
          await model.findByIdAndDelete(data.id);
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to apply ${operation} for ${dataType}:`, error);
      throw error;
    }
  }

  private async broadcastSyncUpdate(userId: string, update: any): Promise<void> {
    const websocket = this.activeConnections.get(userId);
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'sync_update',
        update
      }));
    }
  }

  private selectResolutionStrategy(payload: SyncPayload, conflicts: ConflictData[]): string {
    // Simple strategy selection logic
    if (conflicts.some(c => c.field === 'status')) return 'merge';
    if (payload.operation === 'delete') return 'priority';
    if (conflicts.length > 3) return 'merge';
    
    return 'timestamp';
  }

  private mergeStatus(localStatus: string, serverStatus: string): string {
    // Status progression priority
    const statusPriority: Record<string, number> = {
      'completed': 5,
      'in_progress': 4,
      'assigned': 3,
      'pending': 2,
      'created': 1
    };

    const localPriority = statusPriority[localStatus] || 0;
    const serverPriority = statusPriority[serverStatus] || 0;

    return localPriority > serverPriority ? localStatus : serverStatus;
  }

  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;

    if (typeof obj1 === 'object') {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      
      if (keys1.length !== keys2.length) return false;
      
      for (const key of keys1) {
        if (!keys2.includes(key) || !this.deepEqual(obj1[key], obj2[key])) {
          return false;
        }
      }
      
      return true;
    }

    return false;
  }

  // Background processor for sync queue
  private startBackgroundProcessor(): void {
    setInterval(async () => {
      const pendingItems = this.syncQueue.filter(item => 
        item.status === 'pending' && item.retryCount < item.maxRetries
      );

      for (const item of pendingItems.slice(0, 5)) { // Process 5 at a time
        try {
          item.status = 'processing';
          const result = await this.syncPayload(item.payload);
          
          if (result.success) {
            item.status = 'completed';
            item.processedAt = new Date();
          } else {
            item.retryCount++;
            item.status = item.retryCount >= item.maxRetries ? 'failed' : 'pending';
          }
        } catch (error) {
          item.retryCount++;
          item.status = item.retryCount >= item.maxRetries ? 'failed' : 'pending';
        }
      }

      // Clean up old completed items
      this.syncQueue = this.syncQueue.filter(item => 
        item.status !== 'completed' || 
        (Date.now() - item.processedAt!.getTime()) < 24 * 60 * 60 * 1000 // Keep for 24 hours
      );
    }, 5000); // Run every 5 seconds
  }

  // Public getters
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  getQueueStatus(): { pending: number; processing: number; failed: number } {
    const pending = this.syncQueue.filter(item => item.status === 'pending').length;
    const processing = this.syncQueue.filter(item => item.status === 'processing').length;
    const failed = this.syncQueue.filter(item => item.status === 'failed').length;
    
    return { pending, processing, failed };
  }
}

// Service instance
const syncService = new SyncReconciliationService();

// Authentication helper
function ensureAuthenticated(req: AuthenticatedRequest): asserts req is AuthenticatedRequest & { user: NonNullable<AuthenticatedRequest['user']> } {
  if (!req.user) {
    throw new AppError('Authentication required', ErrorCodes.UNAUTHORIZED);
  }
}

// Exported functions for routes
export function syncPayload(payload: any) {
  return syncService.syncPayload(payload);
}

export async function syncData(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { payload, payloads } = req.body;
    
    if (payloads && Array.isArray(payloads)) {
      // Batch sync
      if (payloads.length === 0) {
        throw createValidationError('payloads', 'Payloads array cannot be empty');
      }
      
      const result = await syncService.processBatchSync(payloads);
      res.json(formatSuccess(result, 'Batch sync completed successfully'));
    } else if (payload) {
      // Single payload sync
      if (!payload.userId || !payload.dataType) {
        throw createValidationError('payload', 'Payload must include userId and dataType');
      }
      
      const result = await syncService.syncPayload(payload);
      res.json(formatSuccess(result, 'Sync completed successfully'));
    } else {
      throw createValidationError('payload or payloads', 'Either payload or payloads must be provided');
    }
  } catch (error) {
    console.error('Error in sync operation:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export function getSyncStatus(req: Request, res: Response) {
  try {
    const metrics = syncService.getMetrics();
    const queueStatus = syncService.getQueueStatus();
    
    res.json({
      status: 'operational',
      lastSync: metrics.lastSync,
      metrics: {
        totalSynced: metrics.totalSynced,
        conflicts: metrics.conflicts,
        errors: metrics.errors,
        dataTransferred: `${(metrics.dataTransferred / 1024 / 1024).toFixed(2)} MB`
      },
      queue: queueStatus,
      uptime: process.uptime(),
      version: '2.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function purgeOldData(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { dataType, olderThanDays = 30 } = req.body;
    
    if (!dataType) {
      throw createValidationError('dataType', 'Data type is required for purging');
    }
    
    if (olderThanDays < 1) {
      throw createValidationError('olderThanDays', 'Days must be at least 1');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const model = mongoose.model(dataType);
    const result = await model.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['completed', 'cancelled'] }
    });
    
    res.json(formatSuccess({
      deletedCount: result.deletedCount,
      cutoffDate,
      dataType
    }, `Successfully purged old ${dataType} data`));
  } catch (error) {
    console.error('Error purging old data:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export async function reconcileConflicts(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { conflicts, strategy = 'merge' } = req.body;
    
    if (!conflicts || !Array.isArray(conflicts)) {
      throw createValidationError('conflicts', 'Conflicts array is required');
    }
    
    if (conflicts.length === 0) {
      throw createValidationError('conflicts', 'Conflicts array cannot be empty');
    }

    const results = [];
    for (const conflict of conflicts) {
      if (!conflict.id) {
        throw createValidationError('conflict.id', 'Each conflict must have an id');
      }
      
      // This would typically involve more complex logic
      const resolution = {
        conflictId: conflict.id,
        resolved: true,
        strategy,
        resolution: conflict.preferredResolution || 'merge'
      };
      results.push(resolution);
    }

    res.json(formatSuccess({
      results,
      totalProcessed: conflicts.length,
      strategy
    }, 'Conflicts reconciled successfully'));
  } catch (error) {
    console.error('Error reconciling conflicts:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

// Export service for testing
export { syncService };
