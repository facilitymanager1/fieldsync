/**
 * Advanced Sync Service
 * Intelligent synchronization with conflict resolution, delta sync, and performance optimization
 */

import NetInfo from '@react-native-netinfo/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineStorageService from './offlineStorageService';
import { ApiService } from './apiService';

interface SyncConfig {
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  enableDeltaSync: boolean;
  enableCompression: boolean;
  conflictResolutionStrategy: 'client' | 'server' | 'timestamp' | 'manual';
  prioritySync: boolean;
}

interface SyncOperation {
  id: string;
  type: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  hash: string;
  timestamp: number;
  priority: number;
  retryCount: number;
  lastError?: string;
  dependencies?: string[];
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: Array<{ id: string; error: string }>;
  duration: number;
  dataTransferred: number; // bytes
}

interface ConflictItem {
  id: string;
  type: string;
  clientVersion: any;
  serverVersion: any;
  lastModifiedClient: number;
  lastModifiedServer: number;
  conflictReason: string;
}

interface DeltaSync {
  entityType: string;
  lastSyncTimestamp: number;
  checkpoint: string;
  changes: Array<{
    id: string;
    operation: string;
    timestamp: number;
    data?: any;
  }>;
}

/**
 * Advanced Synchronization Service
 */
export class AdvancedSyncService {
  private static instance: AdvancedSyncService;
  private storage: OfflineStorageService;
  private apiService: ApiService;
  private isOnline: boolean = false;
  private syncInProgress: boolean = false;
  private syncQueue: Map<string, SyncOperation> = new Map();
  private conflicts: Map<string, ConflictItem> = new Map();
  private syncListeners: Array<(result: Partial<SyncResult>) => void> = [];

  private config: SyncConfig = {
    batchSize: 50,
    maxRetries: 3,
    retryDelayMs: 5000,
    enableDeltaSync: true,
    enableCompression: true,
    conflictResolutionStrategy: 'timestamp',
    prioritySync: true
  };

  private stats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    conflictsResolved: 0,
    totalDataTransferred: 0,
    avgSyncDuration: 0
  };

  private constructor() {
    this.storage = OfflineStorageService.getInstance();
    this.apiService = new ApiService();
    this.initializeNetworkListener();
    this.loadSyncQueue();
  }

  static getInstance(): AdvancedSyncService {
    if (!AdvancedSyncService.instance) {
      AdvancedSyncService.instance = new AdvancedSyncService();
    }
    return AdvancedSyncService.instance;
  }

  /**
   * Initialize network connectivity monitoring
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline && !this.syncInProgress) {
        // Back online - trigger automatic sync
        this.startAutoSync();
      }
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      this.isOnline = state.isConnected ?? false;
    });
  }

  /**
   * Load pending sync operations from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueItems = await this.storage.getSyncQueue();
      
      for (const item of queueItems) {
        const operation: SyncOperation = {
          id: item.id,
          type: 'unknown', // This would be extracted from entity_id
          entityId: item.entity_id,
          operation: item.operation as any,
          data: item.data ? JSON.parse(item.data) : null,
          hash: '',
          timestamp: item.created_at || Date.now(),
          priority: 2, // Default priority
          retryCount: item.retry_count || 0,
          lastError: item.error_message
        };

        this.syncQueue.set(item.id, operation);
      }

      console.log(`📥 Loaded ${queueItems.length} pending sync operations`);
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  /**
   * Start automatic synchronization
   */
  private async startAutoSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    try {
      await this.performFullSync();
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }

  /**
   * Perform full synchronization
   */
  async performFullSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    if (!this.isOnline) {
      throw new Error('No network connection');
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    let syncResult: SyncResult = {
      success: false,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
      dataTransferred: 0
    };

    try {
      console.log('🔄 Starting full synchronization...');
      this.notifyListeners({ synced: 0, failed: 0 });

      // Step 1: Download server changes (if delta sync enabled)
      if (this.config.enableDeltaSync) {
        await this.performDeltaSync();
      }

      // Step 2: Upload pending local changes
      syncResult = await this.uploadPendingChanges();

      // Step 3: Resolve any conflicts
      await this.resolveConflicts();

      // Update statistics
      this.updateSyncStats(syncResult);

      console.log(`✅ Sync completed: ${syncResult.synced} synced, ${syncResult.failed} failed, ${syncResult.conflicts} conflicts`);
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      syncResult.success = false;
      syncResult.errors.push({
        id: 'sync_error',
        error: error instanceof Error ? error.message : String(error)
      });
      this.stats.failedSyncs++;
    } finally {
      syncResult.duration = Date.now() - startTime;
      this.syncInProgress = false;
      this.notifyListeners(syncResult);
    }

    return syncResult;
  }

  /**
   * Perform delta synchronization (download only changes since last sync)
   */
  private async performDeltaSync(): Promise<void> {
    try {
      const lastSyncTime = await this.getLastSyncTime();
      const entityTypes = ['shifts', 'tickets', 'sites', 'users']; // Core entity types

      for (const entityType of entityTypes) {
        try {
          const deltaChanges = await this.apiService.getDeltaChanges(entityType, lastSyncTime);
          
          for (const change of deltaChanges.changes) {
            await this.applyServerChange(change);
          }

          // Update checkpoint
          await this.setLastSyncTime(entityType, deltaChanges.timestamp);
          
          console.log(`📥 Applied ${deltaChanges.changes.length} delta changes for ${entityType}`);
          
        } catch (error) {
          console.error(`Delta sync failed for ${entityType}:`, error);
        }
      }
    } catch (error) {
      console.error('Delta sync failed:', error);
      // Fallback to full sync for affected entities
    }
  }

  /**
   * Upload pending local changes to server
   */
  private async uploadPendingChanges(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
      dataTransferred: 0
    };

    const pendingOperations = Array.from(this.syncQueue.values())
      .filter(op => op.retryCount < this.config.maxRetries);

    if (pendingOperations.length === 0) {
      return result;
    }

    // Sort by priority and timestamp
    pendingOperations.sort((a, b) => {
      if (this.config.prioritySync && a.priority !== b.priority) {
        return a.priority - b.priority; // Lower number = higher priority
      }
      return a.timestamp - b.timestamp; // Earlier = higher priority
    });

    // Process in batches
    const batches = this.chunkArray(pendingOperations, this.config.batchSize);

    for (const batch of batches) {
      try {
        const batchResult = await this.processSyncBatch(batch);
        result.synced += batchResult.synced;
        result.failed += batchResult.failed;
        result.conflicts += batchResult.conflicts;
        result.errors.push(...batchResult.errors);
        result.dataTransferred += batchResult.dataTransferred;
      } catch (error) {
        console.error('Batch sync failed:', error);
        result.failed += batch.length;
        result.errors.push({
          id: 'batch_error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Process a batch of sync operations
   */
  private async processSyncBatch(operations: SyncOperation[]): Promise<SyncResult> {
    const batchResult: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
      dataTransferred: 0
    };

    // Prepare batch request
    const batchData = operations.map(op => ({
      id: op.id,
      type: op.type,
      entityId: op.entityId,
      operation: op.operation,
      data: op.data,
      hash: op.hash,
      timestamp: op.timestamp
    }));

    try {
      const response = await this.apiService.syncBatch(batchData);
      
      // Process response for each operation
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const responseItem = response.items[i];

        if (responseItem.success) {
          // Mark as synced
          await this.storage.updateSyncStatus(operation.id, 'COMPLETED');
          this.syncQueue.delete(operation.id);
          batchResult.synced++;
          batchResult.dataTransferred += this.estimateDataSize(operation.data);
          
        } else if (responseItem.conflict) {
          // Handle conflict
          await this.handleConflict(operation, responseItem.serverData);
          batchResult.conflicts++;
          
        } else {
          // Handle failure
          operation.retryCount++;
          operation.lastError = responseItem.error;
          
          if (operation.retryCount >= this.config.maxRetries) {
            await this.storage.updateSyncStatus(operation.id, 'FAILED', responseItem.error);
            batchResult.failed++;
          } else {
            // Schedule retry
            await this.storage.updateSyncStatus(operation.id, 'PENDING');
          }
          
          batchResult.errors.push({
            id: operation.id,
            error: responseItem.error
          });
        }
      }
      
    } catch (error) {
      // Entire batch failed
      for (const operation of operations) {
        operation.retryCount++;
        operation.lastError = error instanceof Error ? error.message : String(error);
        
        if (operation.retryCount >= this.config.maxRetries) {
          await this.storage.updateSyncStatus(operation.id, 'FAILED', operation.lastError);
          batchResult.failed++;
        }
      }
      
      batchResult.errors.push({
        id: 'batch_error',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return batchResult;
  }

  /**
   * Handle sync conflict
   */
  private async handleConflict(operation: SyncOperation, serverData: any): Promise<void> {
    const conflict: ConflictItem = {
      id: operation.id,
      type: operation.type,
      clientVersion: operation.data,
      serverVersion: serverData,
      lastModifiedClient: operation.timestamp,
      lastModifiedServer: serverData.updated_at || serverData.updatedAt,
      conflictReason: 'Data modified on both client and server'
    };

    this.conflicts.set(operation.id, conflict);

    // Apply automatic conflict resolution based on strategy
    switch (this.config.conflictResolutionStrategy) {
      case 'server':
        await this.resolveConflictWithServer(operation.id);
        break;
      case 'client':
        await this.resolveConflictWithClient(operation.id);
        break;
      case 'timestamp':
        await this.resolveConflictByTimestamp(operation.id);
        break;
      case 'manual':
        // Leave for manual resolution
        console.log(`⚠️ Manual conflict resolution required for ${operation.id}`);
        break;
    }
  }

  /**
   * Resolve conflict using server version
   */
  async resolveConflictWithServer(conflictId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return;

    // Apply server version to local storage
    const [type, id] = conflict.id.split('_', 2);
    await this.storage.updateEntity(type, id, conflict.serverVersion);

    // Mark conflict as resolved
    this.conflicts.delete(conflictId);
    this.stats.conflictsResolved++;
    
    console.log(`✅ Conflict resolved with server version: ${conflictId}`);
  }

  /**
   * Resolve conflict using client version
   */
  async resolveConflictWithClient(conflictId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return;

    // Retry sync with client version
    const operation = this.syncQueue.get(conflictId);
    if (operation) {
      operation.retryCount = 0; // Reset retry count
      // Will be retried in next sync cycle
    }

    this.conflicts.delete(conflictId);
    this.stats.conflictsResolved++;
    
    console.log(`✅ Conflict resolved with client version: ${conflictId}`);
  }

  /**
   * Resolve conflict by timestamp (most recent wins)
   */
  async resolveConflictByTimestamp(conflictId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return;

    if (conflict.lastModifiedServer > conflict.lastModifiedClient) {
      await this.resolveConflictWithServer(conflictId);
    } else {
      await this.resolveConflictWithClient(conflictId);
    }
  }

  /**
   * Resolve all pending conflicts
   */
  private async resolveConflicts(): Promise<void> {
    const conflicts = Array.from(this.conflicts.keys());
    
    for (const conflictId of conflicts) {
      try {
        switch (this.config.conflictResolutionStrategy) {
          case 'server':
            await this.resolveConflictWithServer(conflictId);
            break;
          case 'client':
            await this.resolveConflictWithClient(conflictId);
            break;
          case 'timestamp':
            await this.resolveConflictByTimestamp(conflictId);
            break;
        }
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflictId}:`, error);
      }
    }
  }

  /**
   * Apply server change to local storage
   */
  private async applyServerChange(change: any): Promise<void> {
    try {
      const [type, id] = change.id.split('_', 2);
      
      switch (change.operation) {
        case 'CREATE':
        case 'UPDATE':
          await this.storage.storeEntity(type, id, change.data, { 
            searchableFields: this.getSearchableFields(type) 
          });
          break;
        case 'DELETE':
          await this.storage.deleteEntity(type, id);
          break;
      }
    } catch (error) {
      console.error('Failed to apply server change:', error);
    }
  }

  /**
   * Get searchable fields for entity type
   */
  private getSearchableFields(type: string): string[] {
    const searchableFieldsMap: Record<string, string[]> = {
      users: ['email', 'profile.firstName', 'profile.lastName', 'role'],
      shifts: ['userId', 'status', 'startTime'],
      tickets: ['title', 'status', 'priority', 'assignedTo'],
      sites: ['name', 'clientId', 'location.address']
    };
    
    return searchableFieldsMap[type] || [];
  }

  /**
   * Add sync listener
   */
  addSyncListener(listener: (result: Partial<SyncResult>) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all sync listeners
   */
  private notifyListeners(result: Partial<SyncResult>): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }

  // Utility methods

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private estimateDataSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  private async getLastSyncTime(entityType?: string): Promise<number> {
    const key = entityType ? `last_sync_${entityType}` : 'last_sync_global';
    try {
      const time = await AsyncStorage.getItem(key);
      return time ? parseInt(time) : 0;
    } catch {
      return 0;
    }
  }

  private async setLastSyncTime(entityType: string, timestamp: number): Promise<void> {
    const key = `last_sync_${entityType}`;
    await AsyncStorage.setItem(key, timestamp.toString());
  }

  private updateSyncStats(result: SyncResult): void {
    this.stats.totalSyncs++;
    if (result.success) {
      this.stats.successfulSyncs++;
    } else {
      this.stats.failedSyncs++;
    }
    this.stats.totalDataTransferred += result.dataTransferred;
    this.stats.avgSyncDuration = 
      (this.stats.avgSyncDuration * (this.stats.totalSyncs - 1) + result.duration) / this.stats.totalSyncs;
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return {
      ...this.stats,
      pendingOperations: this.syncQueue.size,
      pendingConflicts: this.conflicts.size,
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Get pending conflicts for manual resolution
   */
  getPendingConflicts(): ConflictItem[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Manually resolve conflict
   */
  async resolveConflictManually(
    conflictId: string, 
    resolution: 'server' | 'client' | 'custom',
    customData?: any
  ): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    switch (resolution) {
      case 'server':
        await this.resolveConflictWithServer(conflictId);
        break;
      case 'client':
        await this.resolveConflictWithClient(conflictId);
        break;
      case 'custom':
        if (customData) {
          const [type, id] = conflict.id.split('_', 2);
          await this.storage.updateEntity(type, id, customData);
          this.conflicts.delete(conflictId);
          this.stats.conflictsResolved++;
        }
        break;
    }
  }
}

export default AdvancedSyncService;