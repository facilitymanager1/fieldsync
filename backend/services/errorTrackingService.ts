import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import loggingService from './loggingService';
import metricsService from './metricsService';

export interface ErrorEvent {
  id: string;
  timestamp: string;
  name: string;
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  endpoint?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  environment: string;
  version: string;
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
  tags: string[];
  context: Record<string, any>;
  breadcrumbs: Array<{
    timestamp: string;
    message: string;
    category: string;
    level: string;
    data?: Record<string, any>;
  }>;
}

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  enabled: boolean;
  configuration: Record<string, any>;
  filters: {
    severity?: string[];
    services?: string[];
    tags?: string[];
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: Array<{
    field: string;
    operator: '>' | '<' | '=' | '!=' | 'contains' | 'matches';
    value: any;
    timeWindow?: number; // in minutes
  }>;
  channels: string[];
  cooldown: number; // minutes between alerts
  lastTriggered?: string;
}

class ErrorTrackingService {
  private errors: Map<string, ErrorEvent> = new Map();
  private alertChannels: Map<string, AlertChannel> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private breadcrumbs: Map<string, any[]> = new Map(); // sessionId -> breadcrumbs
  private errorStoragePath: string;
  private maxErrorsInMemory = 10000;
  private maxBreadcrumbs = 50;

  constructor() {
    this.errorStoragePath = path.join(
      process.env.LOG_DIRECTORY || './logs',
      'errors'
    );
    
    this.ensureStorageDirectory();
    this.loadPersistedErrors();
    this.initializeDefaultChannels();
    this.initializeDefaultAlertRules();
    this.setupPeriodicCleanup();
  }

  /**
   * Ensure error storage directory exists
   */
  private ensureStorageDirectory(): void {
    try {
      if (!fs.existsSync(this.errorStoragePath)) {
        fs.mkdirSync(this.errorStoragePath, { recursive: true });
      }
    } catch (error) {
      loggingService.error('Failed to create error storage directory', error);
    }
  }

  /**
   * Load persisted errors from disk
   */
  private loadPersistedErrors(): void {
    try {
      const errorFiles = fs.readdirSync(this.errorStoragePath)
        .filter(file => file.endsWith('.json'));

      for (const file of errorFiles) {
        const filePath = path.join(this.errorStoragePath, file);
        const errorData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.errors.set(errorData.fingerprint, errorData);
      }

      loggingService.info(`Loaded ${this.errors.size} persisted errors`);
    } catch (error) {
      loggingService.error('Failed to load persisted errors', error);
    }
  }

  /**
   * Initialize default alert channels
   */
  private initializeDefaultChannels(): void {
    const defaultChannels: AlertChannel[] = [
      {
        id: 'default-email',
        name: 'Default Email Alerts',
        type: 'email',
        enabled: true,
        configuration: {
          recipients: [process.env.ALERT_EMAIL || 'admin@fieldsync.com'],
          smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
              user: process.env.SMTP_USER || 'alerts@fieldsync.com',
              pass: process.env.SMTP_PASSWORD || 'password'
            }
          }
        },
        filters: {
          severity: ['high', 'critical']
        }
      },
      {
        id: 'default-slack',
        name: 'Default Slack Alerts',
        type: 'slack',
        enabled: !!process.env.SLACK_WEBHOOK_URL,
        configuration: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts',
          username: 'FieldSync Alerts'
        },
        filters: {
          severity: ['medium', 'high', 'critical']
        }
      },
      {
        id: 'critical-pagerduty',
        name: 'Critical PagerDuty Alerts',
        type: 'pagerduty',
        enabled: !!process.env.PAGERDUTY_INTEGRATION_KEY,
        configuration: {
          integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
          severity: 'critical'
        },
        filters: {
          severity: ['critical']
        }
      }
    ];

    defaultChannels.forEach(channel => {
      this.alertChannels.set(channel.id, channel);
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'critical-error-spike',
        name: 'Critical Error Spike',
        description: 'Triggered when critical errors spike',
        enabled: true,
        conditions: [
          {
            field: 'severity',
            operator: '=',
            value: 'critical'
          },
          {
            field: 'count',
            operator: '>',
            value: 5,
            timeWindow: 5 // 5 minutes
          }
        ],
        channels: ['default-email', 'critical-pagerduty'],
        cooldown: 15
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Triggered when error rate is high',
        enabled: true,
        conditions: [
          {
            field: 'severity',
            operator: '=',
            value: 'high'
          },
          {
            field: 'count',
            operator: '>',
            value: 10,
            timeWindow: 10
          }
        ],
        channels: ['default-email', 'default-slack'],
        cooldown: 30
      },
      {
        id: 'authentication-failures',
        name: 'Authentication Failure Spike',
        description: 'Too many authentication failures',
        enabled: true,
        conditions: [
          {
            field: 'service',
            operator: '=',
            value: 'authentication'
          },
          {
            field: 'count',
            operator: '>',
            value: 20,
            timeWindow: 10
          }
        ],
        channels: ['default-email', 'default-slack'],
        cooldown: 20
      },
      {
        id: 'database-errors',
        name: 'Database Error Alert',
        description: 'Database connectivity or query errors',
        enabled: true,
        conditions: [
          {
            field: 'service',
            operator: '=',
            value: 'database'
          },
          {
            field: 'severity',
            operator: '=',
            value: 'critical'
          }
        ],
        channels: ['default-email', 'critical-pagerduty'],
        cooldown: 10
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Setup periodic cleanup of old errors
   */
  private setupPeriodicCleanup(): void {
    // Clean up old errors every hour
    setInterval(() => {
      this.cleanupOldErrors();
    }, 60 * 60 * 1000);
  }

  /**
   * Capture and track an error
   */
  captureError(error: Error | any, context: {
    service: string;
    endpoint?: string;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    ip?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    extra?: Record<string, any>;
  }): string {
    try {
      const fingerprint = this.generateFingerprint(error, context);
      const now = new Date().toISOString();

      let errorEvent = this.errors.get(fingerprint);

      if (errorEvent) {
        // Update existing error
        errorEvent.count++;
        errorEvent.lastSeen = now;
        
        // Update context with new information
        if (context.userId && !errorEvent.context.userIds?.includes(context.userId)) {
          errorEvent.context.userIds = [...(errorEvent.context.userIds || []), context.userId];
        }
        
        if (context.ip && !errorEvent.context.ips?.includes(context.ip)) {
          errorEvent.context.ips = [...(errorEvent.context.ips || []), context.ip];
        }
      } else {
        // Create new error event
        errorEvent = {
          id: crypto.randomUUID(),
          timestamp: now,
          name: error.name || 'Error',
          message: error.message || 'Unknown error',
          stack: error.stack,
          severity: context.severity || this.determineSeverity(error, context),
          service: context.service,
          endpoint: context.endpoint,
          userId: context.userId,
          sessionId: context.sessionId,
          userAgent: context.userAgent,
          ip: context.ip,
          environment: process.env.NODE_ENV || 'development',
          version: process.env.APP_VERSION || '1.0.0',
          fingerprint,
          count: 1,
          firstSeen: now,
          lastSeen: now,
          resolved: false,
          tags: context.tags || [],
          context: {
            ...context.extra,
            userIds: context.userId ? [context.userId] : [],
            ips: context.ip ? [context.ip] : [],
            endpoints: context.endpoint ? [context.endpoint] : []
          },
          breadcrumbs: this.getBreadcrumbs(context.sessionId || 'global')
        };
      }

      // Store error
      this.errors.set(fingerprint, errorEvent);
      
      // Persist to disk
      this.persistError(errorEvent);

      // Record metrics
      metricsService.recordError(
        errorEvent.name,
        errorEvent.severity,
        errorEvent.service,
        errorEvent.endpoint
      );

      // Log the error
      loggingService.error('Error captured by tracking service', error, {
        errorId: errorEvent.id,
        fingerprint,
        count: errorEvent.count,
        severity: errorEvent.severity,
        service: context.service
      });

      // Check alert rules
      this.checkAlertRules(errorEvent);

      // Cleanup if we have too many errors in memory
      this.cleanupMemoryIfNeeded();

      return errorEvent.id;
    } catch (trackingError) {
      loggingService.error('Failed to capture error in tracking service', trackingError);
      return '';
    }
  }

  /**
   * Add breadcrumb for debugging context
   */
  addBreadcrumb(sessionId: string, breadcrumb: {
    message: string;
    category: string;
    level?: string;
    data?: Record<string, any>;
  }): void {
    try {
      if (!this.breadcrumbs.has(sessionId)) {
        this.breadcrumbs.set(sessionId, []);
      }

      const breadcrumbs = this.breadcrumbs.get(sessionId)!;
      
      breadcrumbs.push({
        timestamp: new Date().toISOString(),
        message: breadcrumb.message,
        category: breadcrumb.category,
        level: breadcrumb.level || 'info',
        data: breadcrumb.data
      });

      // Keep only the most recent breadcrumbs
      if (breadcrumbs.length > this.maxBreadcrumbs) {
        breadcrumbs.splice(0, breadcrumbs.length - this.maxBreadcrumbs);
      }
    } catch (error) {
      loggingService.error('Failed to add breadcrumb', error);
    }
  }

  /**
   * Get errors with filtering options
   */
  getErrors(options: {
    severity?: string[];
    service?: string;
    resolved?: boolean;
    limit?: number;
    offset?: number;
    since?: string;
  } = {}): ErrorEvent[] {
    let errors = Array.from(this.errors.values());

    // Apply filters
    if (options.severity) {
      errors = errors.filter(e => options.severity!.includes(e.severity));
    }

    if (options.service) {
      errors = errors.filter(e => e.service === options.service);
    }

    if (options.resolved !== undefined) {
      errors = errors.filter(e => e.resolved === options.resolved);
    }

    if (options.since) {
      const sinceDate = new Date(options.since);
      errors = errors.filter(e => new Date(e.lastSeen) >= sinceDate);
    }

    // Sort by last seen (most recent first)
    errors.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    
    return errors.slice(offset, offset + limit);
  }

  /**
   * Get error by ID
   */
  getError(id: string): ErrorEvent | null {
    return Array.from(this.errors.values()).find(e => e.id === id) || null;
  }

  /**
   * Mark error as resolved
   */
  resolveError(fingerprint: string, resolvedBy: string): boolean {
    const error = this.errors.get(fingerprint);
    if (error) {
      error.resolved = true;
      error.context.resolvedBy = resolvedBy;
      error.context.resolvedAt = new Date().toISOString();
      
      this.persistError(error);
      
      loggingService.info('Error marked as resolved', {
        errorId: error.id,
        fingerprint,
        resolvedBy
      });
      
      return true;
    }
    return false;
  }

  /**
   * Generate error statistics
   */
  getErrorStats(timeWindow: number = 24): {
    total: number;
    byService: Record<string, number>;
    bySeverity: Record<string, number>;
    resolved: number;
    unresolved: number;
    topErrors: Array<{
      fingerprint: string;
      name: string;
      count: number;
      service: string;
      severity: string;
    }>;
  } {
    const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
    const recentErrors = Array.from(this.errors.values())
      .filter(e => new Date(e.lastSeen) >= since);

    const stats = {
      total: recentErrors.reduce((sum, e) => sum + e.count, 0),
      byService: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      resolved: recentErrors.filter(e => e.resolved).reduce((sum, e) => sum + e.count, 0),
      unresolved: recentErrors.filter(e => !e.resolved).reduce((sum, e) => sum + e.count, 0),
      topErrors: recentErrors
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(e => ({
          fingerprint: e.fingerprint,
          name: e.name,
          count: e.count,
          service: e.service,
          severity: e.severity
        }))
    };

    // Calculate service and severity distributions
    recentErrors.forEach(error => {
      stats.byService[error.service] = (stats.byService[error.service] || 0) + error.count;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + error.count;
    });

    return stats;
  }

  /**
   * Add or update alert channel
   */
  setAlertChannel(channel: AlertChannel): void {
    this.alertChannels.set(channel.id, channel);
    loggingService.info('Alert channel updated', { channelId: channel.id, type: channel.type });
  }

  /**
   * Get all alert channels
   */
  getAlertChannels(): AlertChannel[] {
    return Array.from(this.alertChannels.values());
  }

  /**
   * Add or update alert rule
   */
  setAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    loggingService.info('Alert rule updated', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Test alert channel
   */
  async testAlertChannel(channelId: string): Promise<boolean> {
    const channel = this.alertChannels.get(channelId);
    if (!channel) return false;

    try {
      const testError: ErrorEvent = {
        id: 'test-error',
        timestamp: new Date().toISOString(),
        name: 'Test Error',
        message: 'This is a test alert from FieldSync Error Tracking',
        severity: 'medium',
        service: 'test',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        fingerprint: 'test-fingerprint',
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        resolved: false,
        tags: ['test'],
        context: {},
        breadcrumbs: []
      };

      await this.sendAlert(channel, testError, 'Test Alert');
      return true;
    } catch (error) {
      loggingService.error(`Failed to test alert channel ${channelId}`, error);
      return false;
    }
  }

  /**
   * Private methods
   */

  private generateFingerprint(error: Error | any, context: any): string {
    const errorString = `${error.name || 'Error'}:${error.message || 'Unknown'}:${context.service}:${context.endpoint || ''}`;
    return crypto.createHash('sha256').update(errorString).digest('hex').substring(0, 16);
  }

  private determineSeverity(error: Error | any, context: any): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Database errors, authentication failures, system crashes
    if (context.service === 'database' || 
        context.service === 'authentication' ||
        error.name === 'SystemError' ||
        error.message?.includes('ECONNREFUSED')) {
      return 'critical';
    }

    // High: Business logic errors, API errors
    if (context.service === 'business' ||
        context.service === 'api' ||
        error.name === 'ValidationError' ||
        error.name === 'BusinessRuleError') {
      return 'high';
    }

    // Medium: User errors, external service errors
    if (error.name === 'UserError' ||
        error.name === 'ExternalServiceError' ||
        context.service === 'external') {
      return 'medium';
    }

    return 'low';
  }

  private getBreadcrumbs(sessionId: string): any[] {
    return [...(this.breadcrumbs.get(sessionId) || [])];
  }

  private persistError(error: ErrorEvent): void {
    try {
      const filePath = path.join(this.errorStoragePath, `${error.fingerprint}.json`);
      fs.writeFileSync(filePath, JSON.stringify(error, null, 2));
    } catch (error) {
      loggingService.error('Failed to persist error', error);
    }
  }

  private async checkAlertRules(error: ErrorEvent): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered) {
        const cooldownEnd = new Date(rule.lastTriggered).getTime() + (rule.cooldown * 60 * 1000);
        if (Date.now() < cooldownEnd) continue;
      }

      // Check conditions
      const shouldAlert = await this.evaluateRuleConditions(rule, error);
      
      if (shouldAlert) {
        await this.triggerAlert(rule, error);
      }
    }
  }

  private async evaluateRuleConditions(rule: AlertRule, error: ErrorEvent): Promise<boolean> {
    for (const condition of rule.conditions) {
      let value: any;

      // Get the field value from the error
      switch (condition.field) {
        case 'severity':
          value = error.severity;
          break;
        case 'service':
          value = error.service;
          break;
        case 'count':
          // For count conditions, we need to check recent occurrences
          if (condition.timeWindow) {
            const since = new Date(Date.now() - condition.timeWindow * 60 * 1000);
            value = Array.from(this.errors.values())
              .filter(e => e.fingerprint === error.fingerprint && new Date(e.lastSeen) >= since)
              .reduce((sum, e) => sum + e.count, 0);
          } else {
            value = error.count;
          }
          break;
        case 'name':
          value = error.name;
          break;
        default:
          value = error.context[condition.field];
      }

      // Evaluate condition
      const result = this.evaluateCondition(value, condition.operator, condition.value);
      if (!result) return false;
    }

    return true;
  }

  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case '>':
        return actual > expected;
      case '<':
        return actual < expected;
      case '=':
        return actual === expected;
      case '!=':
        return actual !== expected;
      case 'contains':
        return typeof actual === 'string' && actual.includes(expected);
      case 'matches':
        return new RegExp(expected).test(actual);
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, error: ErrorEvent): Promise<void> {
    try {
      rule.lastTriggered = new Date().toISOString();

      for (const channelId of rule.channels) {
        const channel = this.alertChannels.get(channelId);
        if (channel && channel.enabled) {
          // Check channel filters
          if (this.shouldSendToChannel(channel, error)) {
            await this.sendAlert(channel, error, rule.name);
          }
        }
      }

      loggingService.info('Alert triggered', {
        ruleId: rule.id,
        ruleName: rule.name,
        errorId: error.id,
        channels: rule.channels
      });
    } catch (error) {
      loggingService.error('Failed to trigger alert', error);
    }
  }

  private shouldSendToChannel(channel: AlertChannel, error: ErrorEvent): boolean {
    if (channel.filters.severity && !channel.filters.severity.includes(error.severity)) {
      return false;
    }

    if (channel.filters.services && !channel.filters.services.includes(error.service)) {
      return false;
    }

    if (channel.filters.tags && !error.tags.some(tag => channel.filters.tags!.includes(tag))) {
      return false;
    }

    return true;
  }

  private async sendAlert(channel: AlertChannel, error: ErrorEvent, ruleName: string): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailAlert(channel, error, ruleName);
          break;
        case 'slack':
          await this.sendSlackAlert(channel, error, ruleName);
          break;
        case 'webhook':
          await this.sendWebhookAlert(channel, error, ruleName);
          break;
        case 'pagerduty':
          await this.sendPagerDutyAlert(channel, error, ruleName);
          break;
      }
    } catch (error) {
      loggingService.error(`Failed to send ${channel.type} alert`, error);
    }
  }

  private async sendEmailAlert(channel: AlertChannel, error: ErrorEvent, ruleName: string): Promise<void> {
    // Email implementation would go here
    // For now, just log the alert
    loggingService.info('Email alert sent', {
      channel: channel.id,
      error: error.id,
      rule: ruleName,
      recipients: channel.configuration.recipients
    });
  }

  private async sendSlackAlert(channel: AlertChannel, error: ErrorEvent, ruleName: string): Promise<void> {
    // Slack webhook implementation would go here
    // For now, just log the alert
    loggingService.info('Slack alert sent', {
      channel: channel.id,
      error: error.id,
      rule: ruleName,
      webhookUrl: channel.configuration.webhookUrl
    });
  }

  private async sendWebhookAlert(channel: AlertChannel, error: ErrorEvent, ruleName: string): Promise<void> {
    // Generic webhook implementation would go here
    // For now, just log the alert
    loggingService.info('Webhook alert sent', {
      channel: channel.id,
      error: error.id,
      rule: ruleName,
      url: channel.configuration.url
    });
  }

  private async sendPagerDutyAlert(channel: AlertChannel, error: ErrorEvent, ruleName: string): Promise<void> {
    // PagerDuty implementation would go here
    // For now, just log the alert
    loggingService.info('PagerDuty alert sent', {
      channel: channel.id,
      error: error.id,
      rule: ruleName,
      integrationKey: channel.configuration.integrationKey
    });
  }

  private cleanupOldErrors(): void {
    try {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      for (const [fingerprint, error] of this.errors) {
        if (new Date(error.lastSeen) < oneMonthAgo && error.resolved) {
          this.errors.delete(fingerprint);
          
          // Remove from disk
          const filePath = path.join(this.errorStoragePath, `${fingerprint}.json`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        loggingService.info(`Cleaned up ${cleanedCount} old resolved errors`);
      }
    } catch (error) {
      loggingService.error('Failed to cleanup old errors', error);
    }
  }

  private cleanupMemoryIfNeeded(): void {
    if (this.errors.size > this.maxErrorsInMemory) {
      const sortedErrors = Array.from(this.errors.values())
        .sort((a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime());

      const toRemove = sortedErrors.slice(0, this.errors.size - this.maxErrorsInMemory);
      
      toRemove.forEach(error => {
        this.errors.delete(error.fingerprint);
      });

      loggingService.info(`Removed ${toRemove.length} old errors from memory`);
    }
  }
}

export default new ErrorTrackingService();