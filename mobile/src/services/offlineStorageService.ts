/**
 * Enhanced Offline Storage Service
 * SQLite-based offline storage with advanced caching, indexing, and performance optimization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import { openDatabase, SQLiteDatabase, ResultSet } from 'react-native-sqlite-storage';

// Database schema interfaces
interface OfflineEntity {
  id: string;
  type: string;
  data: string; // JSON stringified data
  hash: string; // Data hash for conflict detection
  version: number;
  created_at: number;
  updated_at: number;
  synced: boolean;
  sync_priority: number; // 1=high, 2=normal, 3=low
  size_bytes: number;
  metadata?: string; // JSON stringified metadata
}

interface OfflineFile {
  id: string;
  entity_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  created_at: number;
  synced: boolean;
}

interface SyncQueue {
  id: string;
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: string;
  retry_count: number;
  last_attempt: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';
  error_message?: string;
}

interface OfflineIndex {
  id: string;
  entity_type: string;
  field_name: string;
  field_value: string;
  entity_id: string;
}

interface StorageStats {
  totalEntities: number;
  totalFiles: number;
  pendingSyncItems: number;
  storageUsed: number; // bytes
  cacheHitRate: number;
  lastOptimization: number;
  indexCount: number;
}

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

/**
 * Enhanced Offline Storage Service with SQLite backend
 */
export class OfflineStorageService {
  private static instance: OfflineStorageService;
  private db: SQLiteDatabase | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private isInitialized: boolean = false;
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  // Configuration
  private readonly config = {
    dbVersion: 1,
    dbName: 'fieldsync_offline.db',
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    maxCacheItems: 10000,
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    compressionThreshold: 1024, // bytes
    enableAutoOptimization: true,
    optimizationInterval: 24 * 60 * 60 * 1000 // 24 hours
  };

  private constructor() {
    this.initialize();
  }

  static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  /**
   * Initialize SQLite database and create tables
   */
  private async initialize(): Promise<void> {
    try {
      this.db = openDatabase(
        { name: this.config.dbName, location: 'default' },
        () => console.log('✅ SQLite database opened successfully'),
        (error) => console.error('❌ SQLite database failed to open:', error)
      );

      await this.createTables();
      await this.createIndexes();
      
      if (this.config.enableAutoOptimization) {
        this.scheduleOptimization();
      }

      this.isInitialized = true;
      console.log('✅ Offline Storage Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Offline Storage Service:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const queries = [
      // Main entities table
      `CREATE TABLE IF NOT EXISTS offline_entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        hash TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        synced BOOLEAN DEFAULT FALSE,
        sync_priority INTEGER DEFAULT 2,
        size_bytes INTEGER NOT NULL,
        metadata TEXT
      )`,

      // Files table
      `CREATE TABLE IF NOT EXISTS offline_files (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        synced BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (entity_id) REFERENCES offline_entities (id) ON DELETE CASCADE
      )`,

      // Sync queue table
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_attempt INTEGER DEFAULT 0,
        status TEXT DEFAULT 'PENDING',
        error_message TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES offline_entities (id) ON DELETE CASCADE
      )`,

      // Search indexes table
      `CREATE TABLE IF NOT EXISTS offline_indexes (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_value TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES offline_entities (id) ON DELETE CASCADE
      )`
    ];

    for (const query of queries) {
      await this.executeQuery(query);
    }
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_entities_type ON offline_entities (type)',
      'CREATE INDEX IF NOT EXISTS idx_entities_synced ON offline_entities (synced)',
      'CREATE INDEX IF NOT EXISTS idx_entities_updated ON offline_entities (updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_entities_priority ON offline_entities (sync_priority)',
      'CREATE INDEX IF NOT EXISTS idx_files_entity ON offline_files (entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue (status)',
      'CREATE INDEX IF NOT EXISTS idx_queue_priority ON sync_queue (entity_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_search_type_field ON offline_indexes (entity_type, field_name)',
      'CREATE INDEX IF NOT EXISTS idx_search_value ON offline_indexes (field_value)'
    ];

    for (const index of indexes) {
      await this.executeQuery(index);
    }
  }

  /**
   * Execute SQL query with error handling
   */
  private executeQuery(query: string, params: any[] = []): Promise<ResultSet> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          query,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            console.error('SQL Error:', error, 'Query:', query);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Store entity with advanced indexing
   */
  async storeEntity(
    type: string,
    id: string,
    data: any,
    options: {
      priority?: number;
      searchableFields?: string[];
      metadata?: any;
      ttl?: number;
    } = {}
  ): Promise<void> {
    const entityId = `${type}_${id}`;
    const serializedData = JSON.stringify(data);
    const hash = await this.generateHash(serializedData);
    const timestamp = Date.now();
    const sizeBytes = new Blob([serializedData]).size;

    // Store in SQLite
    const insertQuery = `
      INSERT OR REPLACE INTO offline_entities 
      (id, type, data, hash, version, created_at, updated_at, sync_priority, size_bytes, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const version = await this.getNextVersion(entityId);
    const metadata = options.metadata ? JSON.stringify(options.metadata) : null;

    await this.executeQuery(insertQuery, [
      entityId,
      type,
      serializedData,
      hash,
      version,
      timestamp,
      timestamp,
      options.priority || 2,
      sizeBytes,
      metadata
    ]);

    // Create searchable indexes
    if (options.searchableFields) {
      await this.createSearchIndexes(entityId, type, data, options.searchableFields);
    }

    // Cache in memory if within size limits
    if (sizeBytes < this.config.compressionThreshold) {
      this.setCache(entityId, data, options.ttl);
    }

    // Add to sync queue
    await this.addToSyncQueue(entityId, 'CREATE', data);

    console.log(`📦 Stored entity: ${entityId} (${sizeBytes} bytes)`);
  }

  /**
   * Get entity with caching
   */
  async getEntity(type: string, id: string): Promise<any | null> {
    const entityId = `${type}_${id}`;

    // Check memory cache first
    const cached = this.getCache(entityId);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }

    this.cacheStats.misses++;

    // Query from SQLite
    const query = 'SELECT data, updated_at FROM offline_entities WHERE id = ?';
    const result = await this.executeQuery(query, [entityId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows.item(0);
    const data = JSON.parse(row.data);

    // Cache for future use
    this.setCache(entityId, data);

    return data;
  }

  /**
   * Update entity with version control
   */
  async updateEntity(
    type: string,
    id: string,
    data: any,
    options: {
      searchableFields?: string[];
      metadata?: any;
    } = {}
  ): Promise<void> {
    const entityId = `${type}_${id}`;
    const serializedData = JSON.stringify(data);
    const hash = await this.generateHash(serializedData);
    const timestamp = Date.now();
    const sizeBytes = new Blob([serializedData]).size;
    const version = await this.getNextVersion(entityId);

    const updateQuery = `
      UPDATE offline_entities 
      SET data = ?, hash = ?, version = ?, updated_at = ?, synced = FALSE, size_bytes = ?, metadata = ?
      WHERE id = ?
    `;

    const metadata = options.metadata ? JSON.stringify(options.metadata) : null;

    await this.executeQuery(updateQuery, [
      serializedData,
      hash,
      version,
      timestamp,
      sizeBytes,
      metadata,
      entityId
    ]);

    // Update search indexes
    if (options.searchableFields) {
      await this.updateSearchIndexes(entityId, type, data, options.searchableFields);
    }

    // Update cache
    this.setCache(entityId, data);

    // Add to sync queue
    await this.addToSyncQueue(entityId, 'UPDATE', data);

    console.log(`📝 Updated entity: ${entityId} (v${version})`);
  }

  /**
   * Delete entity
   */
  async deleteEntity(type: string, id: string): Promise<void> {
    const entityId = `${type}_${id}`;

    // Remove from SQLite (cascades to files and indexes)
    await this.executeQuery('DELETE FROM offline_entities WHERE id = ?', [entityId]);

    // Remove from cache
    this.memoryCache.delete(entityId);

    // Add to sync queue
    await this.addToSyncQueue(entityId, 'DELETE', null);

    console.log(`🗑️ Deleted entity: ${entityId}`);
  }

  /**
   * Search entities with indexed fields
   */
  async searchEntities(
    type: string,
    field: string,
    value: string,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<any[]> {
    const query = `
      SELECT e.data, e.updated_at
      FROM offline_entities e
      INNER JOIN offline_indexes i ON e.id = i.entity_id
      WHERE i.entity_type = ? AND i.field_name = ? AND i.field_value LIKE ?
      ORDER BY ${options.orderBy || 'e.updated_at'} ${options.orderDirection || 'DESC'}
      LIMIT ? OFFSET ?
    `;

    const result = await this.executeQuery(query, [
      type,
      field,
      `%${value}%`,
      options.limit || 100,
      options.offset || 0
    ]);

    const entities = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      entities.push(JSON.parse(row.data));
    }

    return entities;
  }

  /**
   * Get entities by type with pagination
   */
  async getEntitiesByType(
    type: string,
    options: {
      limit?: number;
      offset?: number;
      syncedOnly?: boolean;
      orderBy?: 'created_at' | 'updated_at';
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{ entities: any[]; total: number }> {
    let whereClause = 'WHERE type = ?';
    const params = [type];

    if (options.syncedOnly) {
      whereClause += ' AND synced = TRUE';
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM offline_entities ${whereClause}`;
    const countResult = await this.executeQuery(countQuery, params);
    const total = countResult.rows.item(0).total;

    // Get entities
    const query = `
      SELECT data, updated_at
      FROM offline_entities
      ${whereClause}
      ORDER BY ${options.orderBy || 'updated_at'} ${options.orderDirection || 'DESC'}
      LIMIT ? OFFSET ?
    `;

    const result = await this.executeQuery(query, [
      ...params,
      options.limit || 50,
      options.offset || 0
    ]);

    const entities = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      entities.push(JSON.parse(row.data));
    }

    return { entities, total };
  }

  /**
   * Store file attachment
   */
  async storeFile(
    entityId: string,
    filePath: string,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stats = await this.getFileStats(filePath);
    const checksum = await this.generateFileHash(filePath);

    const insertQuery = `
      INSERT INTO offline_files 
      (id, entity_id, file_path, file_name, mime_type, size_bytes, checksum, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.executeQuery(insertQuery, [
      fileId,
      entityId,
      filePath,
      fileName,
      mimeType,
      stats.size,
      checksum,
      Date.now()
    ]);

    console.log(`📎 Stored file: ${fileName} (${stats.size} bytes)`);
    return fileId;
  }

  /**
   * Get sync queue items
   */
  async getSyncQueue(limit: number = 100): Promise<SyncQueue[]> {
    const query = `
      SELECT * FROM sync_queue 
      WHERE status IN ('PENDING', 'FAILED') 
      ORDER BY created_at ASC 
      LIMIT ?
    `;

    const result = await this.executeQuery(query, [limit]);
    const items: SyncQueue[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      items.push(result.rows.item(i));
    }

    return items;
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(
    queueId: string,
    status: 'SYNCING' | 'COMPLETED' | 'FAILED',
    errorMessage?: string
  ): Promise<void> {
    const query = `
      UPDATE sync_queue 
      SET status = ?, last_attempt = ?, error_message = ?
      WHERE id = ?
    `;

    await this.executeQuery(query, [status, Date.now(), errorMessage || null, queueId]);

    // Mark entity as synced if completed
    if (status === 'COMPLETED') {
      const queueItem = await this.executeQuery('SELECT entity_id FROM sync_queue WHERE id = ?', [queueId]);
      if (queueItem.rows.length > 0) {
        const entityId = queueItem.rows.item(0).entity_id;
        await this.executeQuery('UPDATE offline_entities SET synced = TRUE WHERE id = ?', [entityId]);
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const queries = [
      'SELECT COUNT(*) as count FROM offline_entities',
      'SELECT COUNT(*) as count FROM offline_files',
      'SELECT COUNT(*) as count FROM sync_queue WHERE status = "PENDING"',
      'SELECT SUM(size_bytes) as total FROM offline_entities',
      'SELECT COUNT(*) as count FROM offline_indexes'
    ];

    const results = await Promise.all(queries.map(q => this.executeQuery(q)));

    const totalOperations = this.cacheStats.hits + this.cacheStats.misses;
    const cacheHitRate = totalOperations > 0 ? this.cacheStats.hits / totalOperations : 0;

    return {
      totalEntities: results[0].rows.item(0).count,
      totalFiles: results[1].rows.item(0).count,
      pendingSyncItems: results[2].rows.item(0).count,
      storageUsed: results[3].rows.item(0).total || 0,
      cacheHitRate,
      lastOptimization: await this.getLastOptimizationTime(),
      indexCount: results[4].rows.item(0).count
    };
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase(): Promise<void> {
    console.log('🚀 Starting database optimization...');

    // VACUUM to reclaim space
    await this.executeQuery('VACUUM');

    // ANALYZE to update query planner statistics
    await this.executeQuery('ANALYZE');

    // Clean up old sync queue items
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await this.executeQuery(
      'DELETE FROM sync_queue WHERE status = "COMPLETED" AND last_attempt < ?',
      [oneWeekAgo]
    );

    // Optimize cache
    this.optimizeCache();

    // Store optimization timestamp
    await AsyncStorage.setItem('last_db_optimization', Date.now().toString());

    console.log('✅ Database optimization completed');
  }

  // Private helper methods

  private async generateHash(data: string): Promise<string> {
    // Simple hash function (in production, use crypto library)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async getNextVersion(entityId: string): Promise<number> {
    const result = await this.executeQuery(
      'SELECT version FROM offline_entities WHERE id = ?',
      [entityId]
    );
    return result.rows.length > 0 ? result.rows.item(0).version + 1 : 1;
  }

  private async createSearchIndexes(
    entityId: string,
    type: string,
    data: any,
    fields: string[]
  ): Promise<void> {
    // First, remove existing indexes for this entity
    await this.executeQuery('DELETE FROM offline_indexes WHERE entity_id = ?', [entityId]);

    // Create new indexes
    for (const field of fields) {
      const value = this.getNestedValue(data, field);
      if (value !== undefined && value !== null) {
        const indexId = `${entityId}_${field}_${Date.now()}`;
        await this.executeQuery(
          'INSERT INTO offline_indexes (id, entity_type, field_name, field_value, entity_id) VALUES (?, ?, ?, ?, ?)',
          [indexId, type, field, String(value), entityId]
        );
      }
    }
  }

  private async updateSearchIndexes(
    entityId: string,
    type: string,
    data: any,
    fields: string[]
  ): Promise<void> {
    await this.createSearchIndexes(entityId, type, data, fields);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async addToSyncQueue(
    entityId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    data: any
  ): Promise<void> {
    const queueId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const serializedData = data ? JSON.stringify(data) : '';

    await this.executeQuery(
      'INSERT INTO sync_queue (id, entity_id, operation, data, created_at) VALUES (?, ?, ?, ?, ?)',
      [queueId, entityId, operation, serializedData, Date.now()]
    );
  }

  // Cache management methods

  private getCache(key: string): any | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.memoryCache.delete(key);
      this.cacheStats.evictions++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccess = now;
    return entry.data;
  }

  private setCache(key: string, data: any, ttl?: number): void {
    if (this.memoryCache.size >= this.config.maxCacheItems) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccess: Date.now()
    };

    this.memoryCache.set(key, entry);
  }

  private evictLRU(): void {
    let oldestEntry: { key: string; lastAccess: number } | null = null;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (!oldestEntry || entry.lastAccess < oldestEntry.lastAccess) {
        oldestEntry = { key, lastAccess: entry.lastAccess };
      }
    }

    if (oldestEntry) {
      this.memoryCache.delete(oldestEntry.key);
      this.cacheStats.evictions++;
    }
  }

  private optimizeCache(): void {
    const now = Date.now();
    let evicted = 0;

    // Remove expired entries
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.memoryCache.delete(key);
        evicted++;
      }
    }

    console.log(`🧹 Cache optimized: ${evicted} expired entries removed`);
  }

  private async getFileStats(filePath: string): Promise<{ size: number }> {
    // This would use react-native-fs in a real implementation
    return { size: 0 };
  }

  private async generateFileHash(filePath: string): Promise<string> {
    // This would generate a proper file hash in a real implementation
    return `hash_${Date.now()}`;
  }

  private async getLastOptimizationTime(): Promise<number> {
    try {
      const time = await AsyncStorage.getItem('last_db_optimization');
      return time ? parseInt(time) : 0;
    } catch {
      return 0;
    }
  }

  private scheduleOptimization(): void {
    setInterval(async () => {
      try {
        await this.optimizeDatabase();
      } catch (error) {
        console.error('Scheduled optimization failed:', error);
      }
    }, this.config.optimizationInterval);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.memoryCache.clear();
    this.isInitialized = false;
  }
}

export default OfflineStorageService;