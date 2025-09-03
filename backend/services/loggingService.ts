import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  traceId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface LoggingConfig {
  level: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRotation: boolean;
  maxSize: string;
  maxFiles: string;
  logDirectory: string;
  enableStructuredLogging: boolean;
  enableRequestLogging: boolean;
  enableErrorTracking: boolean;
  enablePerformanceLogging: boolean;
  redactSensitiveData: boolean;
}

class LoggingService {
  private logger: winston.Logger;
  private config: LoggingConfig;
  private sensitiveFields = ['password', 'token', 'authorization', 'ssn', 'creditCard', 'bankAccount'];

  constructor() {
    this.config = {
      level: process.env.LOG_LEVEL || 'info',
      enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
      enableFile: process.env.ENABLE_FILE_LOGGING !== 'false',
      enableRotation: process.env.ENABLE_LOG_ROTATION !== 'false',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      logDirectory: process.env.LOG_DIRECTORY || './logs',
      enableStructuredLogging: process.env.ENABLE_STRUCTURED_LOGGING !== 'false',
      enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
      enableErrorTracking: process.env.ENABLE_ERROR_TRACKING !== 'false',
      enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING !== 'false',
      redactSensitiveData: process.env.REDACT_SENSITIVE_DATA !== 'false'
    };

    this.initializeLogger();
    this.createLogDirectory();
  }

  private initializeLogger() {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.errors({ stack: true }),
            winston.format.printf(this.formatConsoleLog.bind(this))
          )
        })
      );
    }

    // File transports
    if (this.config.enableFile) {
      // General application logs
      if (this.config.enableRotation) {
        transports.push(
          new DailyRotateFile({
            filename: path.join(this.config.logDirectory, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: this.config.maxSize,
            maxFiles: this.config.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            )
          })
        );

        // Error logs
        transports.push(
          new DailyRotateFile({
            filename: path.join(this.config.logDirectory, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: this.config.maxSize,
            maxFiles: this.config.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            )
          })
        );

        // Request logs
        if (this.config.enableRequestLogging) {
          transports.push(
            new DailyRotateFile({
              filename: path.join(this.config.logDirectory, 'requests-%DATE%.log'),
              datePattern: 'YYYY-MM-DD',
              maxSize: this.config.maxSize,
              maxFiles: this.config.maxFiles,
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
              )
            })
          );
        }

        // Performance logs
        if (this.config.enablePerformanceLogging) {
          transports.push(
            new DailyRotateFile({
              filename: path.join(this.config.logDirectory, 'performance-%DATE%.log'),
              datePattern: 'YYYY-MM-DD',
              maxSize: this.config.maxSize,
              maxFiles: this.config.maxFiles,
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
              )
            })
          );
        }
      } else {
        transports.push(
          new winston.transports.File({
            filename: path.join(this.config.logDirectory, 'application.log'),
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json()
            )
          })
        );
      }
    }

    this.logger = winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
      ),
      transports,
      rejectionHandlers: [
        new winston.transports.File({ 
          filename: path.join(this.config.logDirectory, 'rejections.log') 
        })
      ],
      exceptionHandlers: [
        new winston.transports.File({ 
          filename: path.join(this.config.logDirectory, 'exceptions.log') 
        })
      ]
    });
  }

  private createLogDirectory() {
    if (!fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  private formatConsoleLog(info: any) {
    const { timestamp, level, message, service, traceId, userId, ...meta } = info;
    
    let logLine = `${timestamp} [${level.toUpperCase()}]`;
    
    if (service) logLine += ` [${service}]`;
    if (traceId) logLine += ` [${traceId}]`;
    if (userId) logLine += ` [User:${userId}]`;
    
    logLine += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logLine += ` ${JSON.stringify(meta)}`;
    }
    
    return logLine;
  }

  private redactSensitiveData(obj: any): any {
    if (!this.config.redactSensitiveData) return obj;
    
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const redacted = { ...obj };
    
    for (const key in redacted) {
      if (typeof key === 'string') {
        const lowerKey = key.toLowerCase();
        if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
          redacted[key] = '[REDACTED]';
        } else if (typeof redacted[key] === 'object') {
          redacted[key] = this.redactSensitiveData(redacted[key]);
        }
      }
    }
    
    return redacted;
  }

  /**
   * Generate unique trace ID for request tracking
   */
  generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log with different levels
   */
  info(message: string, metadata?: Record<string, any>) {
    this.logger.info(message, this.redactSensitiveData(metadata));
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.logger.warn(message, this.redactSensitiveData(metadata));
  }

  error(message: string, error?: Error | any, metadata?: Record<string, any>) {
    const logData: any = { ...this.redactSensitiveData(metadata) };
    
    if (error) {
      if (error instanceof Error) {
        logData.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      } else {
        logData.error = error;
      }
    }
    
    this.logger.error(message, logData);
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.logger.debug(message, this.redactSensitiveData(metadata));
  }

  /**
   * Log HTTP requests
   */
  logRequest(req: Request, res: Response, responseTime: number) {
    if (!this.config.enableRequestLogging) return;

    const requestLog: LogEntry = {
      level: 'info',
      message: 'HTTP Request',
      timestamp: new Date().toISOString(),
      service: 'api',
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      requestId: (req as any).id,
      traceId: (req as any).traceId,
      userId: (req as any).user?.id,
      metadata: {
        query: this.redactSensitiveData(req.query),
        params: this.redactSensitiveData(req.params),
        body: this.redactSensitiveData(req.body),
        headers: this.redactSensitiveData(req.headers),
        referrer: req.get('Referrer'),
        contentLength: req.get('Content-Length')
      }
    };

    // Use different log levels based on status code
    if (res.statusCode >= 500) {
      this.logger.error('HTTP Request', requestLog);
    } else if (res.statusCode >= 400) {
      this.logger.warn('HTTP Request', requestLog);
    } else {
      this.logger.info('HTTP Request', requestLog);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
    if (!this.config.enablePerformanceLogging) return;

    const performanceLog = {
      level: 'info',
      message: `Performance: ${operation}`,
      timestamp: new Date().toISOString(),
      service: 'performance',
      operation,
      duration,
      metadata: this.redactSensitiveData(metadata)
    };

    this.logger.info(performanceLog.message, performanceLog);
  }

  /**
   * Log database operations
   */
  logDatabase(operation: string, collection: string, duration?: number, metadata?: Record<string, any>) {
    const dbLog = {
      level: 'debug',
      message: `Database: ${operation} on ${collection}`,
      timestamp: new Date().toISOString(),
      service: 'database',
      operation,
      collection,
      duration,
      metadata: this.redactSensitiveData(metadata)
    };

    this.logger.debug(dbLog.message, dbLog);
  }

  /**
   * Log security events
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, any>) {
    const securityLog = {
      level: severity === 'critical' || severity === 'high' ? 'error' : 'warn',
      message: `Security Event: ${event}`,
      timestamp: new Date().toISOString(),
      service: 'security',
      event,
      severity,
      metadata: this.redactSensitiveData(metadata)
    };

    if (severity === 'critical' || severity === 'high') {
      this.logger.error(securityLog.message, securityLog);
    } else {
      this.logger.warn(securityLog.message, securityLog);
    }
  }

  /**
   * Log authentication events
   */
  logAuth(event: string, userId?: string, success: boolean = true, metadata?: Record<string, any>) {
    const authLog = {
      level: success ? 'info' : 'warn',
      message: `Auth: ${event}`,
      timestamp: new Date().toISOString(),
      service: 'authentication',
      event,
      userId,
      success,
      metadata: this.redactSensitiveData(metadata)
    };

    if (success) {
      this.logger.info(authLog.message, authLog);
    } else {
      this.logger.warn(authLog.message, authLog);
    }
  }

  /**
   * Log business events
   */
  logBusiness(event: string, entity: string, entityId: string, metadata?: Record<string, any>) {
    const businessLog = {
      level: 'info',
      message: `Business: ${event}`,
      timestamp: new Date().toISOString(),
      service: 'business',
      event,
      entity,
      entityId,
      metadata: this.redactSensitiveData(metadata)
    };

    this.logger.info(businessLog.message, businessLog);
  }

  /**
   * Log system health events
   */
  logHealth(component: string, status: 'healthy' | 'degraded' | 'unhealthy', metadata?: Record<string, any>) {
    const healthLog = {
      level: status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warn' : 'info',
      message: `Health: ${component} is ${status}`,
      timestamp: new Date().toISOString(),
      service: 'health',
      component,
      status,
      metadata: this.redactSensitiveData(metadata)
    };

    switch (status) {
      case 'unhealthy':
        this.logger.error(healthLog.message, healthLog);
        break;
      case 'degraded':
        this.logger.warn(healthLog.message, healthLog);
        break;
      default:
        this.logger.info(healthLog.message, healthLog);
    }
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>) {
    return {
      info: (message: string, metadata?: Record<string, any>) => 
        this.info(message, { ...context, ...metadata }),
      
      warn: (message: string, metadata?: Record<string, any>) => 
        this.warn(message, { ...context, ...metadata }),
      
      error: (message: string, error?: Error, metadata?: Record<string, any>) => 
        this.error(message, error, { ...context, ...metadata }),
      
      debug: (message: string, metadata?: Record<string, any>) => 
        this.debug(message, { ...context, ...metadata })
    };
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<any> {
    try {
      const logFiles = fs.readdirSync(this.config.logDirectory);
      const stats: any = {
        totalFiles: logFiles.length,
        files: [],
        totalSize: 0
      };

      for (const file of logFiles) {
        const filePath = path.join(this.config.logDirectory, file);
        const fileStat = fs.statSync(filePath);
        
        stats.files.push({
          name: file,
          size: fileStat.size,
          created: fileStat.birthtime,
          modified: fileStat.mtime
        });
        
        stats.totalSize += fileStat.size;
      }

      return stats;
    } catch (error) {
      this.error('Failed to get log statistics', error);
      return { error: 'Unable to retrieve log statistics' };
    }
  }

  /**
   * Search logs with filters
   */
  async searchLogs(filters: {
    level?: string;
    service?: string;
    startDate?: Date;
    endDate?: Date;
    keyword?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    // This is a basic implementation - in production, consider using ELK stack or similar
    try {
      const results: LogEntry[] = [];
      const logFiles = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.endsWith('.log'))
        .sort()
        .reverse(); // Most recent first

      for (const file of logFiles) {
        if (results.length >= (filters.limit || 100)) break;

        const filePath = path.join(this.config.logDirectory, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const logEntry: LogEntry = JSON.parse(line);
            
            // Apply filters
            if (filters.level && logEntry.level !== filters.level) continue;
            if (filters.service && logEntry.service !== filters.service) continue;
            if (filters.keyword && !logEntry.message.toLowerCase().includes(filters.keyword.toLowerCase())) continue;
            
            if (filters.startDate || filters.endDate) {
              const logDate = new Date(logEntry.timestamp);
              if (filters.startDate && logDate < filters.startDate) continue;
              if (filters.endDate && logDate > filters.endDate) continue;
            }

            results.push(logEntry);
            
            if (results.length >= (filters.limit || 100)) break;
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }

      return results;
    } catch (error) {
      this.error('Failed to search logs', error);
      return [];
    }
  }

  /**
   * Archive old logs
   */
  async archiveLogs(olderThanDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const logFiles = fs.readdirSync(this.config.logDirectory);
      const archiveDir = path.join(this.config.logDirectory, 'archive');

      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      for (const file of logFiles) {
        const filePath = path.join(this.config.logDirectory, file);
        const fileStat = fs.statSync(filePath);

        if (fileStat.mtime < cutoffDate) {
          const archivePath = path.join(archiveDir, file);
          fs.renameSync(filePath, archivePath);
          this.info(`Archived log file: ${file}`);
        }
      }
    } catch (error) {
      this.error('Failed to archive logs', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.initializeLogger(); // Reinitialize with new config
  }

  /**
   * Flush all logs
   */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

export default new LoggingService();