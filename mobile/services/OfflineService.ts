import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './ApiServiceNew';

interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

interface CachedData {
  key: string;
  data: any;
  timestamp: number;
  expiry?: number;
}

class OfflineService {
  private isOnline = true;
  private syncQueue: OfflineAction[] = [];
  private cache = new Map<string, CachedData>();
  private initialized = false;

  private readonly STORAGE_KEYS = {
    SYNC_QUEUE: '@FieldSync:syncQueue',
    CACHED_DATA: '@FieldSync:cachedData',
    LAST_SYNC: '@FieldSync:lastSync',
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('📱 Initializing Offline Service');

    // Load persisted data
    await this.loadPersistedData();
    
    // Check network connectivity periodically
    this.startConnectivityMonitoring();
    
    this.initialized = true;
    console.log('✅ Offline Service initialized');
  }

  private startConnectivityMonitoring(): void {
    // Simple connectivity check every 30 seconds
    setInterval(async () => {
      await this.checkConnectivity();
    }, 30000);

    // Initial check
    this.checkConnectivity();
  }

  private async checkConnectivity(): Promise<void> {
    try {
      // Simple ping to check connectivity
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-cache',
      });
      
      const wasOnline = this.isOnline;
      this.isOnline = true;

      // If we just came back online, try to sync
      if (!wasOnline && this.isOnline) {
        console.log('📶 Connection restored, starting sync...');
        this.syncOfflineActions();
      }
    } catch (error) {
      this.isOnline = false;
      console.log('📵 No internet connection');
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      // Load sync queue
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEYS.SYNC_QUEUE);
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
      }

      // Load cached data
      const cachedData = await AsyncStorage.getItem(this.STORAGE_KEYS.CACHED_DATA);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        this.cache = new Map(parsed);
      }
    } catch (error) {
      console.error('Failed to load persisted offline data:', error);
    }
  }

  private async persistSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.SYNC_QUEUE,
        JSON.stringify(this.syncQueue)
      );
    } catch (error) {
      console.error('Failed to persist sync queue:', error);
    }
  }

  private async persistCache(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.CACHED_DATA,
        JSON.stringify(Array.from(this.cache.entries()))
      );
    } catch (error) {
      console.error('Failed to persist cache:', error);
    }
  }

  // Queue an action for when we're back online
  async queueAction(
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    endpoint: string,
    data: any
  ): Promise<string> {
    const action: OfflineAction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      endpoint,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(action);
    await this.persistSyncQueue();

    console.log('Queued offline action:', action);
    return action.id;
  }

  // Try to sync all queued actions
  async syncOfflineActions(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    console.log(`Starting sync of ${this.syncQueue.length} queued actions`);

    const actionsToSync = [...this.syncQueue];
    const successfulActions: string[] = [];

    for (const action of actionsToSync) {
      try {
        await this.executeAction(action);
        successfulActions.push(action.id);
        console.log('Successfully synced action:', action.id);
      } catch (error) {
        console.error('Failed to sync action:', action.id, error);
        
        // Increment retry count
        action.retryCount++;
        
        // Remove action if it has failed too many times
        if (action.retryCount >= 3) {
          console.log('Removing action after 3 failed attempts:', action.id);
          successfulActions.push(action.id);
        }
      }
    }

    // Remove successful/failed actions from queue
    this.syncQueue = this.syncQueue.filter(
      action => !successfulActions.includes(action.id)
    );

    await this.persistSyncQueue();
    
    // Update last sync time
    await AsyncStorage.setItem(
      this.STORAGE_KEYS.LAST_SYNC,
      new Date().toISOString()
    );

    console.log(`Sync completed. Remaining actions: ${this.syncQueue.length}`);
  }

  private async executeAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'CREATE':
        await ApiService.post(action.endpoint, action.data);
        break;
      case 'UPDATE':
        await ApiService.put(action.endpoint, action.data);
        break;
      case 'DELETE':
        await ApiService.delete(action.endpoint);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // Cache data for offline access
  async cacheData(key: string, data: any, expiryMinutes = 60): Promise<void> {
    const cachedItem: CachedData = {
      key,
      data,
      timestamp: Date.now(),
      expiry: Date.now() + (expiryMinutes * 60 * 1000),
    };

    this.cache.set(key, cachedItem);
    await this.persistCache();
  }

  // Get cached data
  getCachedData(key: string): any | null {
    const cachedItem = this.cache.get(key);
    
    if (!cachedItem) {
      return null;
    }

    // Check if expired
    if (cachedItem.expiry && Date.now() > cachedItem.expiry) {
      this.cache.delete(key);
      this.persistCache();
      return null;
    }

    return cachedItem.data;
  }

  // Clear expired cache items
  async clearExpiredCache(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && now > item.expiry) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      await this.persistCache();
      console.log(`Cleared ${keysToDelete.length} expired cache items`);
    }
  }

  // Get sync status
  getSyncStatus(): {
    isOnline: boolean;
    queueLength: number;
    lastSync: Promise<string | null>;
  } {
    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSync: AsyncStorage.getItem(this.STORAGE_KEYS.LAST_SYNC),
    };
  }

  // Clear all offline data
  async clearAllData(): Promise<void> {
    this.syncQueue = [];
    this.cache.clear();
    
    await AsyncStorage.multiRemove([
      this.STORAGE_KEYS.SYNC_QUEUE,
      this.STORAGE_KEYS.CACHED_DATA,
      this.STORAGE_KEYS.LAST_SYNC,
    ]);

    console.log('Cleared all offline data');
  }

  // Check if we're online
  get isOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Get pending actions count
  get pendingActionsCount(): number {
    return this.syncQueue.length;
  }

  // Force sync manually
  async forcSync(): Promise<void> {
    await this.checkConnectivity();
    if (this.isOnline) {
      await this.syncOfflineActions();
    }
  }
}

export default new OfflineService();
