import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import { ApiService } from './apiService';

export enum SyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT'
}

export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  UPLOAD = 'UPLOAD'
}

export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  entityType: string;
  entityId: string;
  data: any;
  timestamp: Date;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  priority: number;
  dependencies?: string[];
  localVersion: number;
  serverVersion?: number;
  conflictData?: any;
}

export interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  syncInterval: number;
  conflictResolution: 'server' | 'client' | 'manual';
  enableCompression: boolean;
  enableEncryption: boolean;
}

export interface SyncStats {
  totalItems: number;
  pendingItems: number;
  completedItems: number;
  failedItems: number;
  conflictItems: number;
  lastSyncTime?: Date;
  isOnline: boolean;
  syncInProgress: boolean;
}

class SyncService {
  private static instance: SyncService;
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = false;
  private syncInProgress: boolean = false;
  private syncIntervalId?: NodeJS.Timeout;
  private listeners: ((stats: SyncStats) => void)[] = [];
  private config: SyncConfig = {
    maxRetries: 3,
    retryDelay: 5000,
    batchSize: 10,
    syncInterval: 30000,
    conflictResolution: 'manual',
    enableCompression: true,
    enableEncryption: true
  };

  private constructor() {
    this.initializeNetworkListener();
    this.loadSyncQueue();
    this.startPeriodicSync();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOffline && this.isOnline) {
        // Back online - start syncing
        this.startSync();
      }
      
      this.notifyListeners();
    });
  }

  private async loadSyncQueue() {
    try {
      const queueData = await AsyncStorage.getItem('sync_queue');
      if (queueData) {
        this.syncQueue = JSON.parse(queueData).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        this.sortSyncQueue();
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }

  private async saveSyncQueue() {
    try {
      await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  private sortSyncQueue() {
    this.syncQueue.sort((a, b) => {
      // Sort by priority (higher first), then by timestamp (older first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  private startPeriodicSync() {
    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.startSync();
      }
    }, this.config.syncInterval);
  }

  private stopPeriodicSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }

  // Public API Methods

  async queueOperation(
    operation: SyncOperation,
    entityType: string,
    entityId: string,
    data: any,
    priority: number = 1,
    dependencies?: string[]
  ): Promise<string> {
    const item: SyncQueueItem = {
      id: `${entityType}_${entityId}_${Date.now()}`,
      operation,
      entityType,
      entityId,
      data: this.config.enableCompression ? this.compressData(data) : data,
      timestamp: new Date(),
      status: SyncStatus.PENDING,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      priority,
      dependencies,
      localVersion: await this.getLocalVersion(entityType, entityId)
    };

    this.syncQueue.push(item);
    this.sortSyncQueue();
    await this.saveSyncQueue();
    
    this.notifyListeners();

    // Try immediate sync if online
    if (this.isOnline && !this.syncInProgress) {
      this.startSync();
    }

    return item.id;
  }

  async startSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners();

    try {
      const pendingItems = this.syncQueue.filter(item => 
        item.status === SyncStatus.PENDING || 
        (item.status === SyncStatus.FAILED && item.retryCount < item.maxRetries)
      );

      // Process in batches
      for (let i = 0; i < pendingItems.length; i += this.config.batchSize) {
        const batch = pendingItems.slice(i, i + this.config.batchSize);
        await this.processBatch(batch);
      }

      // Clean up completed items older than 7 days
      await this.cleanupOldItems();

    } finally {
      this.syncInProgress = false;
      await this.saveSyncQueue();
      this.notifyListeners();
    }
  }

  private async processBatch(batch: SyncQueueItem[]) {
    const promises = batch.map(item => this.processItem(item));
    await Promise.allSettled(promises);
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    try {
      // Check dependencies
      if (item.dependencies) {
        const dependenciesCompleted = item.dependencies.every(depId =>
          this.syncQueue.find(dep => dep.id === depId)?.status === SyncStatus.COMPLETED
        );
        
        if (!dependenciesCompleted) {
          return; // Skip until dependencies are completed
        }
      }

      item.status = SyncStatus.IN_PROGRESS;
      
      let result;
      const decompressedData = this.config.enableCompression 
        ? this.decompressData(item.data) 
        : item.data;

      switch (item.operation) {
        case SyncOperation.CREATE:
          result = await ApiService.post(`/${item.entityType}`, decompressedData);
          break;
        
        case SyncOperation.UPDATE:
          // Check for conflicts
          const serverVersion = await this.getServerVersion(item.entityType, item.entityId);
          if (serverVersion && serverVersion > item.localVersion) {
            await this.handleConflict(item, serverVersion);
            return;
          }
          result = await ApiService.put(`/${item.entityType}/${item.entityId}`, decompressedData);
          break;
        
        case SyncOperation.DELETE:
          result = await ApiService.delete(`/${item.entityType}/${item.entityId}`);
          break;
        
        case SyncOperation.UPLOAD:
          result = await ApiService.uploadFile(item.entityType, item.entityId, decompressedData);
          break;
      }

      // Update local data with server response
      if (result.success && result.data) {
        await this.updateLocalData(item.entityType, item.entityId, result.data);
      }

      item.status = SyncStatus.COMPLETED;
      item.serverVersion = result.data?.version || item.localVersion + 1;
      
    } catch (error) {
      console.error(`Sync error for item ${item.id}:`, error);
      item.retryCount++;
      
      if (item.retryCount >= item.maxRetries) {
        item.status = SyncStatus.FAILED;
      } else {
        item.status = SyncStatus.PENDING;
        // Exponential backoff
        await this.delay(this.config.retryDelay * Math.pow(2, item.retryCount));
      }
    }
  }

  private async handleConflict(item: SyncQueueItem, serverVersion: number) {
    const serverData = await ApiService.get(`/${item.entityType}/${item.entityId}`);
    
    item.status = SyncStatus.CONFLICT;
    item.serverVersion = serverVersion;
    item.conflictData = serverData.data;

    if (this.config.conflictResolution === 'server') {
      await this.resolveConflict(item.id, 'server');
    } else if (this.config.conflictResolution === 'client') {
      await this.resolveConflict(item.id, 'client');
    }
    // For 'manual', leave in conflict state for user resolution
  }

  async resolveConflict(itemId: string, resolution: 'server' | 'client' | 'merge'): Promise<void> {
    const item = this.syncQueue.find(i => i.id === itemId);
    if (!item || item.status !== SyncStatus.CONFLICT) {
      throw new Error('Conflict item not found or not in conflict state');
    }

    try {
      let resolvedData;
      
      switch (resolution) {
        case 'server':
          resolvedData = item.conflictData;
          await this.updateLocalData(item.entityType, item.entityId, resolvedData);
          item.status = SyncStatus.COMPLETED;
          break;
          
        case 'client':
          const decompressedData = this.config.enableCompression 
            ? this.decompressData(item.data) 
            : item.data;
          const result = await ApiService.put(`/${item.entityType}/${item.entityId}`, {
            ...decompressedData,
            forceUpdate: true
          });
          item.status = SyncStatus.COMPLETED;
          item.serverVersion = result.data?.version;
          break;
          
        case 'merge':
          // Implement custom merge logic based on entity type
          resolvedData = await this.mergeConflictData(item);
          const mergeResult = await ApiService.put(`/${item.entityType}/${item.entityId}`, resolvedData);
          await this.updateLocalData(item.entityType, item.entityId, resolvedData);
          item.status = SyncStatus.COMPLETED;
          item.serverVersion = mergeResult.data?.version;
          break;
      }

      await this.saveSyncQueue();
      this.notifyListeners();
      
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  }

  async getConflictItems(): Promise<SyncQueueItem[]> {
    return this.syncQueue.filter(item => item.status === SyncStatus.CONFLICT);
  }

  async retryFailedItems(): Promise<void> {
    const failedItems = this.syncQueue.filter(item => item.status === SyncStatus.FAILED);
    failedItems.forEach(item => {
      item.status = SyncStatus.PENDING;
      item.retryCount = 0;
    });
    
    await this.saveSyncQueue();
    this.notifyListeners();
    
    if (this.isOnline) {
      this.startSync();
    }
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await AsyncStorage.removeItem('sync_queue');
    this.notifyListeners();
  }

  getSyncStats(): SyncStats {
    const stats = this.syncQueue.reduce(
      (acc, item) => {
        acc.totalItems++;
        switch (item.status) {
          case SyncStatus.PENDING:
          case SyncStatus.IN_PROGRESS:
            acc.pendingItems++;
            break;
          case SyncStatus.COMPLETED:
            acc.completedItems++;
            break;
          case SyncStatus.FAILED:
            acc.failedItems++;
            break;
          case SyncStatus.CONFLICT:
            acc.conflictItems++;
            break;
        }
        return acc;
      },
      {
        totalItems: 0,
        pendingItems: 0,
        completedItems: 0,
        failedItems: 0,
        conflictItems: 0
      }
    );

    return {
      ...stats,
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.getLastSyncTime()
    };
  }

  addSyncListener(listener: (stats: SyncStats) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    const stats = this.getSyncStats();
    this.listeners.forEach(listener => listener(stats));
  }

  setConfig(config: Partial<SyncConfig>) {
    this.config = { ...this.config, ...config };
    
    // Restart periodic sync with new interval
    if (config.syncInterval) {
      this.stopPeriodicSync();
      this.startPeriodicSync();
    }
  }

  getConfig(): SyncConfig {
    return { ...this.config };
  }

  // Helper Methods

  private async getLocalVersion(entityType: string, entityId: string): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(`${entityType}_${entityId}_version`);
      return data ? parseInt(data, 10) : 1;
    } catch (error) {
      return 1;
    }
  }

  private async getServerVersion(entityType: string, entityId: string): Promise<number | null> {
    try {
      const result = await ApiService.get(`/${entityType}/${entityId}/version`);
      return result.data?.version || null;
    } catch (error) {
      return null;
    }
  }

  private async updateLocalData(entityType: string, entityId: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(`${entityType}_${entityId}`, JSON.stringify(data));
      if (data.version) {
        await AsyncStorage.setItem(`${entityType}_${entityId}_version`, data.version.toString());
      }
    } catch (error) {
      console.error('Error updating local data:', error);
    }
  }

  private async mergeConflictData(item: SyncQueueItem): Promise<any> {
    // Implement entity-specific merge logic
    const localData = this.config.enableCompression 
      ? this.decompressData(item.data) 
      : item.data;
    const serverData = item.conflictData;

    // Simple field-level merge - can be enhanced based on requirements
    return {
      ...serverData,
      ...localData,
      version: serverData.version,
      mergedAt: new Date().toISOString()
    };
  }

  private compressData(data: any): string {
    // Simple compression - in production, use proper compression library
    return JSON.stringify(data);
  }

  private decompressData(compressedData: string): any {
    return JSON.parse(compressedData);
  }

  private getLastSyncTime(): Date | undefined {
    const completedItems = this.syncQueue.filter(item => item.status === SyncStatus.COMPLETED);
    if (completedItems.length === 0) return undefined;
    
    return completedItems.reduce((latest, item) => 
      item.timestamp > latest ? item.timestamp : latest, 
      completedItems[0].timestamp
    );
  }

  private async cleanupOldItems(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldCompletedItems = this.syncQueue.filter(item => 
      item.status === SyncStatus.COMPLETED && item.timestamp < sevenDaysAgo
    );

    if (oldCompletedItems.length > 0) {
      this.syncQueue = this.syncQueue.filter(item => !oldCompletedItems.includes(item));
      console.log(`Cleaned up ${oldCompletedItems.length} old sync items`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async destroy(): Promise<void> {
    this.stopPeriodicSync();
    await this.saveSyncQueue();
    this.listeners = [];
  }
}

export default SyncService.getInstance();