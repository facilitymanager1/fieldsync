import mongoose from 'mongoose';
import { EventEmitter } from 'events';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';

export interface ConnectionPoolConfig {
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  waitQueueTimeoutMS: number;
  serverSelectionTimeoutMS: number;
  heartbeatFrequencyMS: number;
  maxConnecting: number;
  bufferMaxEntries: number;
  useUnifiedTopology: boolean;
  retryWrites: boolean;
  readPreference: 'primary' | 'secondary' | 'primaryPreferred' | 'secondaryPreferred' | 'nearest';
}

export interface PoolMetrics {
  totalConnections: number;
  availableConnections: number;
  checkedOutConnections: number;
  waitQueueSize: number;
  maxPoolSize: number;
  minPoolSize: number;
}

export interface ConnectionStats {
  connected: boolean;
  connecting: boolean;
  disconnected: boolean;
  readyState: number;
  host: string;
  port: number;
  name: string;
  poolMetrics: PoolMetrics;
  uptime: number;
  reconnectAttempts: number;
}

// Enhanced metrics for performance optimization
export interface AdvancedPoolMetrics {
  connectionCreationTime: number;
  connectionDestroyTime: number;
  averageConnectionAge: number;
  queryExecutionStats: {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    failedQueries: number;
  };
  resourceUtilization: {
    cpuUsage: number;
    memoryUsage: number;
    networkIO: number;
  };
}

class ConnectionPoolService extends EventEmitter {
  private config: ConnectionPoolConfig;
  private connectionStartTime: number = Date.now();
  private reconnectAttempts: number = 0;
  private isShuttingDown: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private advancedMetrics: AdvancedPoolMetrics;
  private connectionHistory: Map<string, { created: Date; destroyed?: Date; queries: number }> = new Map();

  constructor() {
    super();
    
    this.advancedMetrics = this.initializeAdvancedMetrics();
    
    this.config = {
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '20'),
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '5'),
      maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME || '300000'), // 5 minutes
      waitQueueTimeoutMS: parseInt(process.env.DB_WAIT_QUEUE_TIMEOUT || '30000'), // 30 seconds
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT || '30000'),
      heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY || '10000'), // 10 seconds
      maxConnecting: parseInt(process.env.DB_MAX_CONNECTING || '5'),
      bufferMaxEntries: parseInt(process.env.DB_BUFFER_MAX_ENTRIES || '0'), // Disable buffering
      useUnifiedTopology: true,
      retryWrites: true,
      readPreference: (process.env.DB_READ_PREFERENCE as any) || 'primary'
    };

    this.setupConnectionEventHandlers();
    this.startAdvancedMetricsCollection();
  }

  /**
   * Initialize advanced metrics
   */
  private initializeAdvancedMetrics(): AdvancedPoolMetrics {
    return {
      connectionCreationTime: 0,
      connectionDestroyTime: 0,
      averageConnectionAge: 0,
      queryExecutionStats: {
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        failedQueries: 0
      },
      resourceUtilization: {
        cpuUsage: 0,
        memoryUsage: 0,
        networkIO: 0
      }
    };
  }

  /**
   * Start advanced metrics collection
   */
  private startAdvancedMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.collectAdvancedMetrics();
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Initialize database connection with optimized pool settings
   */
  async connect(mongoUri?: string): Promise<void> {
    const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/fieldsync';
    
    try {
      console.log('🔌 Initializing database connection pool...');
      
      // Configure mongoose for connection pooling
      mongoose.set('strictQuery', false);
      
      const connectionOptions = {
        ...this.config,
        useNewUrlParser: true,
        autoIndex: process.env.NODE_ENV !== 'production', // Disable in production
        autoCreate: process.env.NODE_ENV !== 'production',
      };

      await mongoose.connect(uri, connectionOptions);
      
      this.connectionStartTime = Date.now();
      this.reconnectAttempts = 0;
      
      console.log('✅ Database connection pool initialized successfully');
      console.log(`📊 Pool configuration: ${this.config.minPoolSize}-${this.config.maxPoolSize} connections`);
      
      loggingService.info('Database connection pool initialized', {
        minPoolSize: this.config.minPoolSize,
        maxPoolSize: this.config.maxPoolSize,
        maxIdleTime: this.config.maxIdleTimeMS
      });
      
      monitoring.incrementCounter('connection_pool_initializations', 1);
      
      this.startHealthChecks();
      this.emit('connected');
      
    } catch (error) {
      this.reconnectAttempts++;
      console.error('❌ Database connection failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionEventHandlers(): void {
    mongoose.connection.on('connected', () => {
      console.log('📡 MongoDB connected');
      this.emit('connected');
    });

    mongoose.connection.on('error', (error) => {
      console.error('💥 MongoDB connection error:', error);
      this.emit('error', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('🔌 MongoDB disconnected');
      this.emit('disconnected');
      
      if (!this.isShuttingDown) {
        this.attemptReconnection();
      }
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      this.reconnectAttempts = 0;
      this.emit('reconnected');
    });

    mongoose.connection.on('close', () => {
      console.log('🔒 MongoDB connection closed');
      this.emit('closed');
    });

    // Monitor connection pool events
    mongoose.connection.on('connectionPoolCreated', (event: any) => {
      console.log(`🏊 Connection pool created for ${event.address}`);
    });

    mongoose.connection.on('connectionPoolCleared', (event: any) => {
      console.log(`🧹 Connection pool cleared for ${event.address}`);
    });

    mongoose.connection.on('connectionCreated', (event: any) => {
      console.log(`➕ New connection created: ${event.connectionId}`);
    });

    mongoose.connection.on('connectionClosed', (event: any) => {
      console.log(`➖ Connection closed: ${event.connectionId}`);
    });

    mongoose.connection.on('connectionCheckOutStarted', (event: any) => {
      console.log(`⏳ Connection checkout started for ${event.address}`);
    });

    mongoose.connection.on('connectionCheckOutFailed', (event: any) => {
      console.error(`❌ Connection checkout failed: ${event.reason}`);
    });
  }

  /**
   * Attempt to reconnect to database
   */
  private async attemptReconnection(): Promise<void> {
    if (this.isShuttingDown) return;

    const maxReconnectAttempts = parseInt(process.env.DB_MAX_RECONNECT_ATTEMPTS || '10');
    const reconnectDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s

    if (this.reconnectAttempts < maxReconnectAttempts) {
      console.log(`🔄 Attempting to reconnect in ${reconnectDelay}ms (attempt ${this.reconnectAttempts + 1}/${maxReconnectAttempts})`);
      
      setTimeout(async () => {
        try {
          this.reconnectAttempts++;
          await mongoose.connect(process.env.MONGODB_URI!);
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
        }
      }, reconnectDelay);
    } else {
      console.error('💀 Maximum reconnection attempts reached. Manual intervention required.');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    const interval = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '60000'); // 1 minute
    
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getConnectionStats();
      
      if (!health.connected) {
        console.warn('⚠️ Database health check failed');
        this.emit('healthCheckFailed', health);
      }
      
      // Log metrics periodically
      if (process.env.LOG_POOL_METRICS === 'true') {
        console.log('📊 Pool metrics:', health.poolMetrics);
      }
    }, interval);
  }

  /**
   * Get detailed connection statistics
   */
  async getConnectionStats(): Promise<ConnectionStats> {
    const connection = mongoose.connection;
    const db = connection.db;
    
    let poolMetrics: PoolMetrics = {
      totalConnections: 0,
      availableConnections: 0,
      checkedOutConnections: 0,
      waitQueueSize: 0,
      maxPoolSize: this.config.maxPoolSize,
      minPoolSize: this.config.minPoolSize
    };

    try {
      if (db) {
        // Get server status to extract pool metrics
        const serverStatus = await db.admin().serverStatus();
        const connectionMetrics = serverStatus.connections;
        
        poolMetrics = {
          totalConnections: connectionMetrics?.current || 0,
          availableConnections: connectionMetrics?.available || 0,
          checkedOutConnections: connectionMetrics?.current - connectionMetrics?.available || 0,
          waitQueueSize: 0, // Not directly available
          maxPoolSize: this.config.maxPoolSize,
          minPoolSize: this.config.minPoolSize
        };
      }
    } catch (error) {
      console.error('Error getting pool metrics:', error);
    }

    return {
      connected: connection.readyState === 1,
      connecting: connection.readyState === 2,
      disconnected: connection.readyState === 0,
      readyState: connection.readyState,
      host: connection.host || 'unknown',
      port: connection.port || 0,
      name: connection.name || 'unknown',
      poolMetrics,
      uptime: Date.now() - this.connectionStartTime,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Execute a database operation with connection retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Only retry on connection-related errors
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = Math.min(1000 * attempt, 5000); // Max 5 second delay
          console.warn(`Database operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const retryableErrors = [
      'MongoNetworkError',
      'MongoTimeoutError',
      'MongoServerSelectionError',
      'MongoWriteConcernError'
    ];
    
    return retryableErrors.includes(error.name) || 
           error.message?.includes('connection') ||
           error.message?.includes('timeout');
  }

  /**
   * Create a new connection for specific operations
   */
  async createConnection(uri?: string): Promise<mongoose.Connection> {
    const connectionUri = uri || process.env.MONGODB_URI!;
    
    const newConnection = mongoose.createConnection(connectionUri, {
      ...this.config,
      useNewUrlParser: true,
    });

    return new Promise((resolve, reject) => {
      newConnection.once('connected', () => resolve(newConnection));
      newConnection.once('error', reject);
    });
  }

  /**
   * Monitor connection pool performance
   */
  async getPoolPerformanceMetrics(): Promise<{
    averageConnectionTime: number;
    slowQueries: any[];
    connectionUtilization: number;
    errors: number;
  }> {
    try {
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database not connected');
      }

      // Enable profiling for slow operations
      await db.command({ profile: 2, slowms: 100 });
      
      // Get slow operations from the last hour
      const slowQueries = await db.collection('system.profile')
        .find({ 
          ts: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
          millis: { $gte: 100 }
        })
        .sort({ ts: -1 })
        .limit(10)
        .toArray();

      const stats = await this.getConnectionStats();
      const connectionUtilization = stats.poolMetrics.totalConnections > 0 
        ? (stats.poolMetrics.checkedOutConnections / stats.poolMetrics.totalConnections) * 100 
        : 0;

      return {
        averageConnectionTime: 0, // Would need to calculate from metrics
        slowQueries: slowQueries.map(q => ({
          operation: q.command,
          duration: q.millis,
          timestamp: q.ts
        })),
        connectionUtilization,
        errors: this.reconnectAttempts
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        averageConnectionTime: 0,
        slowQueries: [],
        connectionUtilization: 0,
        errors: 0
      };
    }
  }

  /**
   * Optimize connection pool based on usage patterns
   */
  async optimizePool(): Promise<void> {
    const metrics = await this.getPoolPerformanceMetrics();
    
    // Auto-adjust pool size based on utilization
    if (metrics.connectionUtilization > 80) {
      const newMaxPoolSize = Math.min(this.config.maxPoolSize + 5, 50);
      console.log(`📈 High utilization detected. Increasing max pool size to ${newMaxPoolSize}`);
      this.config.maxPoolSize = newMaxPoolSize;
    } else if (metrics.connectionUtilization < 20 && this.config.maxPoolSize > 10) {
      const newMaxPoolSize = Math.max(this.config.maxPoolSize - 2, 10);
      console.log(`📉 Low utilization detected. Decreasing max pool size to ${newMaxPoolSize}`);
      this.config.maxPoolSize = newMaxPoolSize;
    }
  }

  /**
   * Health check for the database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const stats = await this.getConnectionStats();
      
      if (!stats.connected) {
        return false;
      }

      // Test with a simple ping
      await mongoose.connection.db?.admin().ping();
      
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Gracefully disconnect from database
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Closing database connections...');
    
    this.isShuttingDown = true;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    try {
      await mongoose.disconnect();
      console.log('✅ Database connections closed gracefully');
      this.emit('closed');
    } catch (error) {
      console.error('Error during database disconnect:', error);
      throw error;
    }
  }

  /**
   * Get connection configuration
   */
  getConfig(): ConnectionPoolConfig {
    return { ...this.config };
  }

  /**
   * Update connection configuration
   */
  updateConfig(updates: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Force connection pool refresh
   */
  async refreshPool(): Promise<void> {
    try {
      console.log('🔄 Refreshing connection pool...');
      loggingService.info('Refreshing connection pool');
      monitoring.incrementCounter('connection_pool_refreshes', 1);
      
      await mongoose.connection.close();
      await this.connect();
    } catch (error) {
      console.error('Error refreshing connection pool:', error);
      loggingService.error('Connection pool refresh failed', error);
      monitoring.incrementCounter('connection_pool_refresh_errors', 1);
      throw error;
    }
  }

  /**
   * Collect advanced performance metrics
   */
  private async collectAdvancedMetrics(): Promise<void> {
    try {
      // Calculate connection age statistics
      const now = Date.now();
      let totalAge = 0;
      let activeConnections = 0;

      for (const [connectionId, history] of this.connectionHistory.entries()) {
        if (!history.destroyed) {
          const age = now - history.created.getTime();
          totalAge += age;
          activeConnections++;
        }
      }

      this.advancedMetrics.averageConnectionAge = activeConnections > 0 ? totalAge / activeConnections : 0;

      // Get database server statistics
      const db = mongoose.connection.db;
      if (db) {
        try {
          const serverStatus = await db.admin().serverStatus();
          
          // Update resource utilization
          this.advancedMetrics.resourceUtilization = {
            cpuUsage: serverStatus.extra_info?.page_faults || 0,
            memoryUsage: serverStatus.mem?.resident || 0,
            networkIO: serverStatus.network?.bytesIn + serverStatus.network?.bytesOut || 0
          };

          // Update query execution stats from opcounters
          if (serverStatus.opcounters) {
            const totalOps = Object.values(serverStatus.opcounters).reduce((sum: number, val) => 
              sum + (typeof val === 'number' ? val : 0), 0
            ) as number;
            
            this.advancedMetrics.queryExecutionStats.totalQueries = totalOps;
          }

          // Report metrics to monitoring
          monitoring.setGauge('connection_pool_average_age', this.advancedMetrics.averageConnectionAge);
          monitoring.setGauge('connection_pool_memory_usage', this.advancedMetrics.resourceUtilization.memoryUsage);
          monitoring.setGauge('connection_pool_network_io', this.advancedMetrics.resourceUtilization.networkIO);

        } catch (dbError) {
          loggingService.warn('Failed to collect database server metrics', dbError);
        }
      }

    } catch (error) {
      loggingService.error('Advanced metrics collection failed', error);
    }
  }

  /**
   * Get comprehensive pool analytics
   */
  async getPoolAnalytics(): Promise<{
    performance: AdvancedPoolMetrics;
    connectionHistory: any[];
    recommendations: string[];
    healthScore: number;
  }> {
    await this.collectAdvancedMetrics();
    
    const stats = await this.getConnectionStats();
    const recommendations: string[] = [];
    let healthScore = 100;

    // Analyze pool performance and generate recommendations
    const utilization = stats.poolMetrics.totalConnections > 0 
      ? (stats.poolMetrics.checkedOutConnections / stats.poolMetrics.totalConnections) * 100 
      : 0;

    if (utilization > 80) {
      recommendations.push('High connection utilization detected - consider increasing max pool size');
      healthScore -= 20;
    }

    if (this.advancedMetrics.averageConnectionAge > 3600000) { // 1 hour
      recommendations.push('Connections are aging - consider connection recycling');
      healthScore -= 10;
    }

    if (this.reconnectAttempts > 5) {
      recommendations.push('Frequent reconnection attempts - check network stability');
      healthScore -= 30;
    }

    const connectionHistory = Array.from(this.connectionHistory.entries()).map(([id, history]) => ({
      connectionId: id,
      created: history.created,
      destroyed: history.destroyed,
      queries: history.queries,
      age: history.destroyed ? 
        history.destroyed.getTime() - history.created.getTime() : 
        Date.now() - history.created.getTime()
    }));

    return {
      performance: this.advancedMetrics,
      connectionHistory,
      recommendations,
      healthScore: Math.max(0, healthScore)
    };
  }

  /**
   * Optimize connection pool based on current usage patterns
   */
  async optimizeConnectionPool(): Promise<void> {
    const analytics = await this.getPoolAnalytics();
    
    loggingService.info('Optimizing connection pool', {
      currentHealth: analytics.healthScore,
      recommendations: analytics.recommendations
    });

    // Apply optimizations based on analytics
    if (analytics.healthScore < 70) {
      // Pool is unhealthy - apply aggressive optimizations
      if (analytics.recommendations.some(r => r.includes('increasing max pool size'))) {
        const newMaxSize = Math.min(this.config.maxPoolSize + 5, 50);
        this.updateConfig({ maxPoolSize: newMaxSize });
        loggingService.info('Increased max pool size', { newMaxSize });
      }

      if (analytics.recommendations.some(r => r.includes('connection recycling'))) {
        const newMaxIdleTime = Math.max(this.config.maxIdleTimeMS - 60000, 60000); // Reduce by 1 minute
        this.updateConfig({ maxIdleTimeMS: newMaxIdleTime });
        loggingService.info('Reduced max idle time', { newMaxIdleTime });
      }
    }

    monitoring.incrementCounter('connection_pool_optimizations', 1);
    monitoring.setGauge('connection_pool_health_score', analytics.healthScore);
  }

  /**
   * Enhanced disconnect with cleanup
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Closing database connections...');
    loggingService.info('Initiating database disconnect');
    
    this.isShuttingDown = true;
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    try {
      await mongoose.disconnect();
      console.log('✅ Database connections closed gracefully');
      loggingService.info('Database connections closed gracefully');
      monitoring.incrementCounter('connection_pool_graceful_shutdowns', 1);
      this.emit('closed');
    } catch (error) {
      console.error('Error during database disconnect:', error);
      loggingService.error('Database disconnect failed', error);
      monitoring.incrementCounter('connection_pool_shutdown_errors', 1);
      throw error;
    }
  }

  /**
   * Get advanced pool metrics
   */
  getAdvancedMetrics(): AdvancedPoolMetrics {
    return { ...this.advancedMetrics };
  }
}

export default new ConnectionPoolService();