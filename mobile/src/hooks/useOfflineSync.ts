import { useState, useEffect, useCallback } from 'react';
import OfflineService, { OfflineStats } from '../services/offlineService';
import SyncService, { SyncStats } from '../services/syncService';
import { ApiService } from '../services/apiService';

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  offlineStats: OfflineStats;
  syncStats: SyncStats;
  lastSyncTime?: Date;
  pendingCount: number;
  conflictCount: number;
  error?: string;
}

export interface OfflineSyncActions {
  // Data operations
  storeData: (type: string, id: string, data: any) => Promise<void>;
  updateData: (type: string, id: string, data: any) => Promise<void>;
  getData: (type: string, id: string) => Promise<any>;
  deleteData: (type: string, id: string) => Promise<void>;
  
  // File operations
  storeFile: (type: string, id: string, fileUri: string, metadata?: any) => Promise<void>;
  
  // Sync operations
  startSync: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
  clearSyncQueue: () => Promise<void>;
  
  // Conflict resolution
  getConflicts: () => Promise<any[]>;
  resolveConflict: (itemId: string, resolution: 'server' | 'client' | 'merge') => Promise<void>;
  
  // Storage management
  clearOfflineData: () => Promise<void>;
  exportData: () => Promise<string>;
  importData: (jsonData: string) => Promise<void>;
  
  // Utility
  checkConnectivity: () => Promise<boolean>;
  refreshStats: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState & OfflineSyncActions {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: false,
    isSyncing: false,
    offlineStats: {
      totalItems: 0,
      syncedItems: 0,
      pendingItems: 0,
      storageUsed: 0,
      isOnline: false
    },
    syncStats: {
      totalItems: 0,
      pendingItems: 0,
      completedItems: 0,
      failedItems: 0,
      conflictItems: 0,
      isOnline: false,
      syncInProgress: false
    },
    pendingCount: 0,
    conflictCount: 0
  });

  // Initialize and set up listeners
  useEffect(() => {
    let mounted = true;

    const initializeServices = async () => {
      try {
        // Set up network listener
        const removeNetworkListener = OfflineService.addNetworkListener((isOnline) => {
          if (mounted) {
            setState(prev => ({ ...prev, isOnline }));
          }
        });

        // Set up sync listener
        const removeSyncListener = SyncService.addSyncListener((syncStats) => {
          if (mounted) {
            setState(prev => ({
              ...prev,
              syncStats,
              isSyncing: syncStats.syncInProgress,
              pendingCount: syncStats.pendingItems,
              conflictCount: syncStats.conflictItems,
              lastSyncTime: syncStats.lastSyncTime
            }));
          }
        });

        // Initial stats load
        await refreshStats();

        return () => {
          removeNetworkListener();
          removeSyncListener();
        };
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            error: `Initialization error: ${error}`
          }));
        }
      }
    };

    initializeServices();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const [offlineStats, syncStats] = await Promise.all([
        OfflineService.getStorageStats(),
        Promise.resolve(SyncService.getSyncStats())
      ]);

      setState(prev => ({
        ...prev,
        offlineStats,
        syncStats,
        isOnline: offlineStats.isOnline,
        isSyncing: syncStats.syncInProgress,
        pendingCount: syncStats.pendingItems + offlineStats.pendingItems,
        conflictCount: syncStats.conflictItems,
        lastSyncTime: syncStats.lastSyncTime,
        error: undefined
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to refresh stats: ${error}`
      }));
    }
  }, []);

  // Data operations
  const storeData = useCallback(async (type: string, id: string, data: any) => {
    try {
      await OfflineService.storeData(type, id, data);
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to store data: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  const updateData = useCallback(async (type: string, id: string, data: any) => {
    try {
      await OfflineService.updateData(type, id, data);
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to update data: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  const getData = useCallback(async (type: string, id: string) => {
    try {
      const data = await OfflineService.getData(type, id);
      setState(prev => ({ ...prev, error: undefined }));
      return data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to get data: ${error}`
      }));
      throw error;
    }
  }, []);

  const deleteData = useCallback(async (type: string, id: string) => {
    try {
      await OfflineService.deleteData(type, id);
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to delete data: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  const storeFile = useCallback(async (type: string, id: string, fileUri: string, metadata?: any) => {
    try {
      await OfflineService.storeFile(type, id, fileUri, metadata);
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to store file: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  // Sync operations
  const startSync = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isSyncing: true, error: undefined }));
      await SyncService.startSync();
      await refreshStats();
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: `Sync failed: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  const retryFailedSync = useCallback(async () => {
    try {
      await SyncService.retryFailedItems();
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Retry failed: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  const clearSyncQueue = useCallback(async () => {
    try {
      await SyncService.clearSyncQueue();
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to clear sync queue: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  // Conflict resolution
  const getConflicts = useCallback(async () => {
    try {
      const conflicts = await SyncService.getConflictItems();
      setState(prev => ({ ...prev, error: undefined }));
      return conflicts;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to get conflicts: ${error}`
      }));
      throw error;
    }
  }, []);

  const resolveConflict = useCallback(async (itemId: string, resolution: 'server' | 'client' | 'merge') => {
    try {
      await SyncService.resolveConflict(itemId, resolution);
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to resolve conflict: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  // Storage management
  const clearOfflineData = useCallback(async () => {
    try {
      await Promise.all([
        OfflineService.clearAllData(),
        SyncService.clearSyncQueue()
      ]);
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to clear offline data: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  const exportData = useCallback(async () => {
    try {
      const exportedData = await OfflineService.exportData();
      setState(prev => ({ ...prev, error: undefined }));
      return exportedData;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to export data: ${error}`
      }));
      throw error;
    }
  }, []);

  const importData = useCallback(async (jsonData: string) => {
    try {
      await OfflineService.importData(jsonData);
      await refreshStats();
      setState(prev => ({ ...prev, error: undefined }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to import data: ${error}`
      }));
      throw error;
    }
  }, [refreshStats]);

  // Utility functions
  const checkConnectivity = useCallback(async () => {
    try {
      const isHealthy = await ApiService.checkHealth();
      setState(prev => ({ ...prev, error: undefined }));
      return isHealthy;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Connectivity check failed: ${error}`
      }));
      return false;
    }
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    storeData,
    updateData,
    getData,
    deleteData,
    storeFile,
    startSync,
    retryFailedSync,
    clearSyncQueue,
    getConflicts,
    resolveConflict,
    clearOfflineData,
    exportData,
    importData,
    checkConnectivity,
    refreshStats
  };
}

// Helper hook for simpler data operations
export function useOfflineData(type: string) {
  const {
    storeData,
    updateData,
    getData,
    deleteData,
    isOnline,
    pendingCount,
    error
  } = useOfflineSync();

  const store = useCallback((id: string, data: any) => {
    return storeData(type, id, data);
  }, [storeData, type]);

  const update = useCallback((id: string, data: any) => {
    return updateData(type, id, data);
  }, [updateData, type]);

  const get = useCallback((id: string) => {
    return getData(type, id);
  }, [getData, type]);

  const remove = useCallback((id: string) => {
    return deleteData(type, id);
  }, [deleteData, type]);

  return {
    store,
    update,
    get,
    remove,
    isOnline,
    hasPendingChanges: pendingCount > 0,
    error
  };
}