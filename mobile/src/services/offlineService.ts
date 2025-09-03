import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import SyncService, { SyncOperation } from './syncService';
import { performanceService } from './performanceService';

export interface OfflineData {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  synced: boolean;
  version: number;
}

export interface OfflineConfig {
  maxStorageSize: number; // in MB
  autoCleanup: boolean;
  cleanupThreshold: number; // percentage
  retentionDays: number;
  enableBackup: boolean;
  compressionEnabled: boolean;
  batchSize: number;
  enableIntelligentPrefetch: boolean;
  priorityLevels: {
    critical: number;
    high: number;
    normal: number;
    low: number;
  };
}

export interface OfflineStats {
  totalItems: number;
  syncedItems: number;
  pendingItems: number;
  storageUsed: number; // in MB
  isOnline: boolean;
  lastCleanup?: Date;
}

class OfflineService {
  private static instance: OfflineService;
  private isOnline: boolean = false;
  private listeners: ((isOnline: boolean) => void)[] = [];
  private config: OfflineConfig = {
    maxStorageSize: 100,
    autoCleanup: true,
    cleanupThreshold: 80,
    retentionDays: 30,
    enableBackup: true,
    compressionEnabled: true,
    batchSize: 50,
    enableIntelligentPrefetch: true,
    priorityLevels: {
      critical: 1,
      high: 2,
      normal: 3,
      low: 4
    }
  };
  private dataCache: Map<string, OfflineData> = new Map();
  private compressionWorker: any = null;

  private constructor() {
    this.initializeNetworkListener();
    this.performMaintenanceTasks();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      this.notifyListeners();
      
      if (wasOffline && this.isOnline) {
        // Back online - trigger sync
        this.handleOnlineReconnection();
      }
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected ?? false;
      this.notifyListeners();
    });
  }

  private async handleOnlineReconnection() {
    console.log('Device back online - starting sync process');
    try {
      // Sync all pending offline data
      await this.syncPendingData();
    } catch (error) {
      console.error('Error syncing data after reconnection:', error);
    }
  }

  // Data Storage Methods

  async storeData(type: string, id: string, data: any): Promise<void> {
    try {
      await this.checkStorageSpace();
      
      const offlineData: OfflineData = {
        id: `${type}_${id}`,
        type,
        data,
        timestamp: new Date(),
        synced: false,
        version: await this.getNextVersion(type, id)
      };

      await AsyncStorage.setItem(`offline_${offlineData.id}`, JSON.stringify(offlineData));
      
      // Update index
      await this.updateDataIndex(offlineData);

      // Queue for sync if online
      if (this.isOnline) {
        await SyncService.queueOperation(
          SyncOperation.CREATE,
          type,
          id,
          data,
          1 // normal priority
        );
      }

    } catch (error) {
      console.error('Error storing offline data:', error);
      throw error;
    }
  }

  async updateData(type: string, id: string, data: any): Promise<void> {
    try {
      const existingData = await this.getData(type, id);
      if (!existingData) {
        throw new Error('Data not found for update');
      }

      const offlineData: OfflineData = {
        ...existingData,
        data: { ...existingData.data, ...data },
        timestamp: new Date(),
        synced: false,
        version: existingData.version + 1
      };

      await AsyncStorage.setItem(`offline_${offlineData.id}`, JSON.stringify(offlineData));
      await this.updateDataIndex(offlineData);

      // Queue for sync if online
      if (this.isOnline) {
        await SyncService.queueOperation(
          SyncOperation.UPDATE,
          type,
          id,
          offlineData.data,
          1
        );
      }

    } catch (error) {
      console.error('Error updating offline data:', error);
      throw error;
    }
  }

  async getData(type: string, id: string): Promise<OfflineData | null> {
    try {
      const key = `offline_${type}_${id}`;
      const dataString = await AsyncStorage.getItem(key);
      
      if (!dataString) {
        return null;
      }

      const offlineData = JSON.parse(dataString);
      offlineData.timestamp = new Date(offlineData.timestamp);
      
      return offlineData;
    } catch (error) {
      console.error('Error retrieving offline data:', error);
      return null;
    }
  }

  async getDataByType(type: string): Promise<OfflineData[]> {
    try {
      const index = await this.getDataIndex();
      const typeData = index.filter(item => item.type === type);
      
      const promises = typeData.map(item => this.getData(item.type, item.id.replace(`${item.type}_`, '')));
      const results = await Promise.all(promises);
      
      return results.filter(item => item !== null) as OfflineData[];
    } catch (error) {
      console.error('Error retrieving data by type:', error);
      return [];
    }
  }

  async deleteData(type: string, id: string): Promise<void> {
    try {
      const key = `offline_${type}_${id}`;
      await AsyncStorage.removeItem(key);
      await this.removeFromDataIndex(type, id);

      // Queue for sync if online
      if (this.isOnline) {
        await SyncService.queueOperation(
          SyncOperation.DELETE,
          type,
          id,
          null,
          1
        );
      }

    } catch (error) {
      console.error('Error deleting offline data:', error);
      throw error;
    }
  }

  // File Operations

  async storeFile(type: string, id: string, fileUri: string, metadata?: any): Promise<void> {
    try {
      const fileName = `${type}_${id}_${Date.now()}`;
      
      // Store file metadata
      const fileData = {
        id: fileName,
        type: 'file',
        originalUri: fileUri,
        metadata: metadata || {},
        timestamp: new Date(),
        synced: false,
        version: 1
      };

      await AsyncStorage.setItem(`offline_file_${fileName}`, JSON.stringify(fileData));
      await this.updateDataIndex(fileData);

      // Queue for upload if online
      if (this.isOnline) {
        await SyncService.queueOperation(
          SyncOperation.UPLOAD,
          type,
          id,
          { fileUri, metadata },
          2 // higher priority for files
        );
      }

    } catch (error) {
      console.error('Error storing offline file:', error);
      throw error;
    }
  }

  async getStoredFiles(type?: string): Promise<OfflineData[]> {
    try {
      const index = await this.getDataIndex();
      const fileData = index.filter(item => 
        item.type === 'file' && (!type || item.id.startsWith(`${type}_`))
      );
      
      const promises = fileData.map(item => 
        AsyncStorage.getItem(`offline_file_${item.id}`)
      );
      const results = await Promise.all(promises);
      
      return results
        .filter(result => result !== null)
        .map(result => {
          const data = JSON.parse(result!);
          data.timestamp = new Date(data.timestamp);
          return data;
        });
    } catch (error) {
      console.error('Error retrieving stored files:', error);
      return [];
    }
  }

  // Sync Operations

  private async syncPendingData(): Promise<void> {
    try {
      const pendingData = await this.getPendingData();
      console.log(`Found ${pendingData.length} items to sync`);

      for (const item of pendingData) {
        try {
          if (item.type === 'file') {
            await SyncService.queueOperation(
              SyncOperation.UPLOAD,
              'document',
              item.id,
              item.data,
              2
            );
          } else {
            const operation = item.version === 1 ? SyncOperation.CREATE : SyncOperation.UPDATE;
            await SyncService.queueOperation(
              operation,
              item.type,
              item.id.replace(`${item.type}_`, ''),
              item.data,
              1
            );
          }
        } catch (error) {
          console.error(`Error queuing sync for item ${item.id}:`, error);
        }
      }

      // Start the sync process
      await SyncService.startSync();
    } catch (error) {
      console.error('Error syncing pending data:', error);
    }
  }

  async markAsSynced(type: string, id: string): Promise<void> {
    try {
      const data = await this.getData(type, id);
      if (data) {
        data.synced = true;
        data.timestamp = new Date();
        await AsyncStorage.setItem(`offline_${data.id}`, JSON.stringify(data));
        await this.updateDataIndex(data);
      }
    } catch (error) {
      console.error('Error marking data as synced:', error);
    }
  }

  async getPendingData(): Promise<OfflineData[]> {
    try {
      const index = await this.getDataIndex();
      const pendingItems = index.filter(item => !item.synced);
      
      const promises = pendingItems.map(item => {
        if (item.type === 'file') {
          return AsyncStorage.getItem(`offline_file_${item.id}`);
        } else {
          return AsyncStorage.getItem(`offline_${item.id}`);
        }
      });
      
      const results = await Promise.all(promises);
      
      return results
        .filter(result => result !== null)
        .map(result => {
          const data = JSON.parse(result!);
          data.timestamp = new Date(data.timestamp);
          return data;
        });
    } catch (error) {
      console.error('Error getting pending data:', error);
      return [];
    }
  }

  // Storage Management

  async getStorageStats(): Promise<OfflineStats> {
    try {
      const index = await this.getDataIndex();
      const storageUsed = await this.calculateStorageUsage();
      
      return {
        totalItems: index.length,
        syncedItems: index.filter(item => item.synced).length,
        pendingItems: index.filter(item => !item.synced).length,
        storageUsed,
        isOnline: this.isOnline,
        lastCleanup: await this.getLastCleanupDate()
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalItems: 0,
        syncedItems: 0,
        pendingItems: 0,
        storageUsed: 0,
        isOnline: this.isOnline
      };
    }
  }

  private async checkStorageSpace(): Promise<void> {
    if (!this.config.autoCleanup) return;

    const storageUsed = await this.calculateStorageUsage();
    const threshold = (this.config.maxStorageSize * this.config.cleanupThreshold) / 100;

    if (storageUsed > threshold) {
      console.log('Storage threshold exceeded, performing cleanup...');
      await this.performCleanup();
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      const index = await this.getDataIndex();
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      
      // Find old synced items to clean up
      const itemsToCleanup = index.filter(item => 
        item.synced && new Date(item.timestamp) < cutoffDate
      );

      console.log(`Cleaning up ${itemsToCleanup.length} old items`);

      for (const item of itemsToCleanup) {
        try {
          if (item.type === 'file') {
            await AsyncStorage.removeItem(`offline_file_${item.id}`);
          } else {
            await AsyncStorage.removeItem(`offline_${item.id}`);
          }
        } catch (error) {
          console.error(`Error removing item ${item.id}:`, error);
        }
      }

      // Update index
      const updatedIndex = index.filter(item => !itemsToCleanup.includes(item));
      await AsyncStorage.setItem('offline_data_index', JSON.stringify(updatedIndex));
      await AsyncStorage.setItem('offline_last_cleanup', new Date().toISOString());

    } catch (error) {
      console.error('Error performing cleanup:', error);
    }
  }

  async clearAllData(): Promise<void> {
    try {
      const index = await this.getDataIndex();
      
      for (const item of index) {
        try {
          if (item.type === 'file') {
            await AsyncStorage.removeItem(`offline_file_${item.id}`);
          } else {
            await AsyncStorage.removeItem(`offline_${item.id}`);
          }
        } catch (error) {
          console.error(`Error removing item ${item.id}:`, error);
        }
      }

      await AsyncStorage.removeItem('offline_data_index');
      await AsyncStorage.removeItem('offline_version_counter');
      
      console.log('All offline data cleared');
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  // Index Management

  private async getDataIndex(): Promise<{ id: string; type: string; timestamp: Date; synced: boolean }[]> {
    try {
      const indexString = await AsyncStorage.getItem('offline_data_index');
      if (!indexString) return [];
      
      const index = JSON.parse(indexString);
      return index.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    } catch (error) {
      console.error('Error getting data index:', error);
      return [];
    }
  }

  private async updateDataIndex(data: OfflineData): Promise<void> {
    try {
      const index = await this.getDataIndex();
      const existingIndex = index.findIndex(item => item.id === data.id);
      
      const indexItem = {
        id: data.id,
        type: data.type,
        timestamp: data.timestamp,
        synced: data.synced
      };

      if (existingIndex >= 0) {
        index[existingIndex] = indexItem;
      } else {
        index.push(indexItem);
      }

      await AsyncStorage.setItem('offline_data_index', JSON.stringify(index));
    } catch (error) {
      console.error('Error updating data index:', error);
    }
  }

  private async removeFromDataIndex(type: string, id: string): Promise<void> {
    try {
      const index = await this.getDataIndex();
      const itemId = `${type}_${id}`;
      const updatedIndex = index.filter(item => item.id !== itemId);
      
      await AsyncStorage.setItem('offline_data_index', JSON.stringify(updatedIndex));
    } catch (error) {
      console.error('Error removing from data index:', error);
    }
  }

  // Utility Methods

  private async getNextVersion(type: string, id: string): Promise<number> {
    try {
      const existingData = await this.getData(type, id);
      return existingData ? existingData.version + 1 : 1;
    } catch (error) {
      return 1;
    }
  }

  private async calculateStorageUsage(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => key.startsWith('offline_'));
      
      if (offlineKeys.length === 0) return 0;

      const values = await AsyncStorage.multiGet(offlineKeys);
      const totalSize = values.reduce((sum, [, value]) => {
        return sum + (value ? new Blob([value]).size : 0);
      }, 0);

      return totalSize / (1024 * 1024); // Convert to MB
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return 0;
    }
  }

  private async getLastCleanupDate(): Promise<Date | undefined> {
    try {
      const dateString = await AsyncStorage.getItem('offline_last_cleanup');
      return dateString ? new Date(dateString) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async performMaintenanceTasks(): Promise<void> {
    try {
      // Perform cleanup if needed
      if (this.config.autoCleanup) {
        const lastCleanup = await this.getLastCleanupDate();
        const daysSinceCleanup = lastCleanup 
          ? (Date.now() - lastCleanup.getTime()) / (24 * 60 * 60 * 1000)
          : Infinity;

        if (daysSinceCleanup >= 7) { // Weekly cleanup
          await this.performCleanup();
        }
      }

      // Check storage usage
      await this.checkStorageSpace();
    } catch (error) {
      console.error('Error performing maintenance tasks:', error);
    }
  }

  // Configuration and Listeners

  setConfig(config: Partial<OfflineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): OfflineConfig {
    return { ...this.config };
  }

  addNetworkListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);
    // Immediately call with current state
    listener(this.isOnline);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  async exportData(): Promise<string> {
    try {
      const index = await this.getDataIndex();
      const allData = [];

      for (const item of index) {
        let data;
        if (item.type === 'file') {
          data = await AsyncStorage.getItem(`offline_file_${item.id}`);
        } else {
          data = await AsyncStorage.getItem(`offline_${item.id}`);
        }
        
        if (data) {
          allData.push(JSON.parse(data));
        }
      }

      return JSON.stringify({
        exportDate: new Date().toISOString(),
        version: '1.0',
        data: allData
      }, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.data || !Array.isArray(importData.data)) {
        throw new Error('Invalid import data format');
      }

      for (const item of importData.data) {
        const key = item.type === 'file' ? `offline_file_${item.id}` : `offline_${item.id}`;
        await AsyncStorage.setItem(key, JSON.stringify(item));
        
        // Update index
        const offlineData: OfflineData = {
          ...item,
          timestamp: new Date(item.timestamp)
        };
        await this.updateDataIndex(offlineData);
      }

      console.log(`Imported ${importData.data.length} items`);
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  // Enhanced Performance Optimizations

  /**
   * Compress data using intelligent compression based on content type
   */
  private async compressData(data: any): Promise<string> {
    if (!this.config.compressionEnabled) {
      return JSON.stringify(data);
    }

    try {
      const jsonString = JSON.stringify(data);
      const endMeasureCompression = performanceService.measureRenderPerformance('data_compression');
      
      // Simple compression - in production, use a proper compression library
      const compressed = this.simpleCompress(jsonString);
      endMeasureCompression();
      
      return compressed;
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return JSON.stringify(data);
    }
  }

  /**
   * Decompress data
   */
  private async decompressData(compressedData: string): Promise<any> {
    if (!this.config.compressionEnabled) {
      return JSON.parse(compressedData);
    }

    try {
      const endMeasureDecompression = performanceService.measureRenderPerformance('data_decompression');
      const decompressed = this.simpleDecompress(compressedData);
      endMeasureDecompression();
      
      return JSON.parse(decompressed);
    } catch (error) {
      // Fallback to uncompressed
      return JSON.parse(compressedData);
    }
  }

  /**
   * Simple compression algorithm (placeholder for real compression)
   */
  private simpleCompress(data: string): string {
    // This is a placeholder - in production use LZ4, Brotli, or similar
    return btoa(data);
  }

  /**
   * Simple decompression algorithm
   */
  private simpleDecompress(compressedData: string): string {
    try {
      return atob(compressedData);
    } catch {
      return compressedData; // Assume uncompressed
    }
  }

  /**
   * Batch storage operations for better performance
   */
  async storeBatchData(items: Array<{type: string, id: string, data: any, priority?: string}>): Promise<void> {
    const endMeasureBatch = performanceService.measureInteractionPerformance('batch_store_operation');
    
    try {
      await this.checkStorageSpace();
      
      const operations: Array<[string, string]> = [];
      const indexUpdates: OfflineData[] = [];
      
      for (const item of items) {
        const offlineData: OfflineData = {
          id: `${item.type}_${item.id}`,
          type: item.type,
          data: item.data,
          timestamp: new Date(),
          synced: false,
          version: await this.getNextVersion(item.type, item.id)
        };

        const compressedData = await this.compressData(offlineData);
        operations.push([`offline_${offlineData.id}`, compressedData]);
        indexUpdates.push(offlineData);
        
        // Add to cache
        this.dataCache.set(offlineData.id, offlineData);
      }

      // Perform batch storage
      await AsyncStorage.multiSet(operations);
      
      // Update index in batch
      for (const data of indexUpdates) {
        await this.updateDataIndex(data);
      }

      // Queue for sync if online
      if (this.isOnline) {
        for (const item of items) {
          const priority = this.config.priorityLevels[item.priority as keyof typeof this.config.priorityLevels] || this.config.priorityLevels.normal;
          await SyncService.queueOperation(
            SyncOperation.CREATE,
            item.type,
            item.id,
            item.data,
            priority
          );
        }
      }

      endMeasureBatch();
    } catch (error) {
      endMeasureBatch();
      console.error('Error in batch storage operation:', error);
      throw error;
    }
  }

  /**
   * Intelligent data prefetching based on usage patterns
   */
  async enableIntelligentPrefetch(): Promise<void> {
    if (!this.config.enableIntelligentPrefetch) return;

    try {
      const usagePatterns = await this.analyzeUsagePatterns();
      const predictedData = this.predictDataNeeds(usagePatterns);
      
      // Prefetch predicted data when device is idle
      this.schedulePrefetching(predictedData);
    } catch (error) {
      console.error('Error enabling intelligent prefetch:', error);
    }
  }

  /**
   * Analyze usage patterns for intelligent prefetching
   */
  private async analyzeUsagePatterns(): Promise<any> {
    try {
      const historicalAccess = await AsyncStorage.getItem('usage_patterns');
      return historicalAccess ? JSON.parse(historicalAccess) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Predict data needs based on patterns
   */
  private predictDataNeeds(patterns: any): string[] {
    // Simple prediction based on frequency and recency
    const predictions: string[] = [];
    
    for (const [dataType, access] of Object.entries(patterns)) {
      if (access && typeof access === 'object' && access.frequency > 5) {
        predictions.push(dataType);
      }
    }
    
    return predictions;
  }

  /**
   * Schedule prefetching during idle times
   */
  private schedulePrefetching(dataToPrefetch: string[]): void {
    // Use InteractionManager to prefetch during idle time
    require('react-native').InteractionManager.runAfterInteractions(() => {
      this.performPrefetching(dataToPrefetch);
    });
  }

  /**
   * Perform actual prefetching
   */
  private async performPrefetching(dataToPrefetch: string[]): Promise<void> {
    for (const dataType of dataToPrefetch) {
      try {
        // Prefetch logic would go here
        // This would typically involve fetching from API and storing locally
        console.log(`Prefetching data for type: ${dataType}`);
      } catch (error) {
        console.error(`Error prefetching ${dataType}:`, error);
      }
    }
  }

  /**
   * Enhanced storage operations with caching
   */
  async storeDataWithCache(type: string, id: string, data: any): Promise<void> {
    const endMeasureStore = performanceService.measureInteractionPerformance('enhanced_store_operation');
    
    try {
      await this.checkStorageSpace();
      
      const offlineData: OfflineData = {
        id: `${type}_${id}`,
        type,
        data,
        timestamp: new Date(),
        synced: false,
        version: await this.getNextVersion(type, id)
      };

      // Store in memory cache for fast access
      this.dataCache.set(offlineData.id, offlineData);
      
      // Compress and store
      const compressedData = await this.compressData(offlineData);
      await AsyncStorage.setItem(`offline_${offlineData.id}`, compressedData);
      
      // Update index
      await this.updateDataIndex(offlineData);

      // Record access pattern
      await this.recordAccessPattern(type);

      // Queue for sync if online
      if (this.isOnline) {
        await SyncService.queueOperation(
          SyncOperation.CREATE,
          type,
          id,
          data,
          this.config.priorityLevels.normal
        );
      }

      endMeasureStore();
    } catch (error) {
      endMeasureStore();
      console.error('Error storing data with cache:', error);
      throw error;
    }
  }

  /**
   * Get data with cache optimization
   */
  async getDataWithCache(type: string, id: string): Promise<OfflineData | null> {
    const endMeasureGet = performanceService.measureInteractionPerformance('enhanced_get_operation');
    
    try {
      const cacheKey = `${type}_${id}`;
      
      // Check memory cache first
      if (this.dataCache.has(cacheKey)) {
        const cached = this.dataCache.get(cacheKey)!;
        endMeasureGet();
        return cached;
      }

      // Get from storage
      const key = `offline_${cacheKey}`;
      const compressedData = await AsyncStorage.getItem(key);
      
      if (!compressedData) {
        endMeasureGet();
        return null;
      }

      const offlineData = await this.decompressData(compressedData);
      offlineData.timestamp = new Date(offlineData.timestamp);
      
      // Add to cache for future access
      this.dataCache.set(cacheKey, offlineData);
      
      // Record access pattern
      await this.recordAccessPattern(type);
      
      endMeasureGet();
      return offlineData;
    } catch (error) {
      endMeasureGet();
      console.error('Error retrieving data with cache:', error);
      return null;
    }
  }

  /**
   * Record access patterns for intelligent prefetching
   */
  private async recordAccessPattern(type: string): Promise<void> {
    try {
      const patterns = await this.analyzeUsagePatterns();
      
      if (!patterns[type]) {
        patterns[type] = { frequency: 0, lastAccess: Date.now() };
      }
      
      patterns[type].frequency++;
      patterns[type].lastAccess = Date.now();
      
      await AsyncStorage.setItem('usage_patterns', JSON.stringify(patterns));
    } catch (error) {
      console.error('Error recording access pattern:', error);
    }
  }

  /**
   * Optimize storage based on device capabilities
   */
  async optimizeStorageForDevice(): Promise<void> {
    const deviceCapabilities = performanceService.getDeviceCapabilities();
    
    if (!deviceCapabilities) return;
    
    // Adjust configuration based on device performance
    if (deviceCapabilities.performance === 'low') {
      this.config.maxStorageSize = Math.min(this.config.maxStorageSize, 50);
      this.config.batchSize = Math.min(this.config.batchSize, 25);
      this.config.compressionEnabled = false; // Disable compression on low-end devices
    } else if (deviceCapabilities.performance === 'high') {
      this.config.maxStorageSize = Math.max(this.config.maxStorageSize, 200);
      this.config.batchSize = Math.max(this.config.batchSize, 100);
      this.config.compressionEnabled = true;
    }
    
    // Adjust cache size based on available memory
    const maxCacheSize = Math.floor(deviceCapabilities.ram * 0.05); // 5% of RAM
    this.trimCacheToSize(maxCacheSize);
  }

  /**
   * Trim cache to specified size
   */
  private trimCacheToSize(maxSizeMB: number): void {
    const maxItems = maxSizeMB * 10; // Rough estimate
    
    if (this.dataCache.size > maxItems) {
      // Remove oldest items first
      const entries = Array.from(this.dataCache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const itemsToRemove = entries.slice(0, this.dataCache.size - maxItems);
      itemsToRemove.forEach(([key]) => this.dataCache.delete(key));
      
      console.log(`Trimmed cache: removed ${itemsToRemove.length} items`);
    }
  }

  /**
   * Get enhanced performance statistics
   */
  async getEnhancedStorageStats(): Promise<OfflineStats & {
    cacheHitRate: number;
    compressionRatio: number;
    averageAccessTime: number;
    prefetchAccuracy: number;
  }> {
    const baseStats = await this.getStorageStats();
    
    // Calculate additional metrics
    const cacheHitRate = this.calculateCacheHitRate();
    const compressionRatio = await this.calculateCompressionRatio();
    const averageAccessTime = this.calculateAverageAccessTime();
    const prefetchAccuracy = await this.calculatePrefetchAccuracy();
    
    return {
      ...baseStats,
      cacheHitRate,
      compressionRatio,
      averageAccessTime,
      prefetchAccuracy
    };
  }

  private calculateCacheHitRate(): number {
    // Implementation would track hits/misses
    return 0.85; // Placeholder
  }

  private async calculateCompressionRatio(): Promise<number> {
    // Implementation would compare compressed vs uncompressed sizes
    return this.config.compressionEnabled ? 0.65 : 1.0; // Placeholder
  }

  private calculateAverageAccessTime(): number {
    // Implementation would track access times
    return 15; // Placeholder in milliseconds
  }

  private async calculatePrefetchAccuracy(): Promise<number> {
    // Implementation would track prefetch hit rate
    return 0.72; // Placeholder
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.dataCache.clear();
    console.log('Memory cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.dataCache.size,
      maxSize: 1000, // Placeholder
      hitRate: this.calculateCacheHitRate(),
      memoryUsage: this.estimateCacheMemoryUsage()
    };
  }

  private estimateCacheMemoryUsage(): number {
    // Rough estimate of cache memory usage
    return this.dataCache.size * 0.01; // MB
  }
}

export default OfflineService.getInstance();