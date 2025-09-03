import fs from 'fs';
import path from 'path';
import loggingService from './loggingService';

export interface LogAnalytics {
  period: string;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  slowestRequests: any[];
  errorsByType: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  requestsByMethod: Record<string, number>;
  requestsByStatusCode: Record<string, number>;
  authenticationEvents: {
    successfulLogins: number;
    failedLogins: number;
    logouts: number;
  };
  securityEvents: {
    rateLimit: number;
    unauthorized: number;
    forbidden: number;
    suspiciousActivity: number;
  };
  performanceMetrics: {
    averageMemoryUsage: number;
    peakMemoryUsage: number;
    averageCpuUsage: number;
    slowQueries: any[];
  };
  businessMetrics: {
    ticketsCreated: number;
    shiftsStarted: number;
    usersRegistered: number;
    totalTransactions: number;
  };
  alertsTriggered: any[];
  topUsers: Array<{
    userId: string;
    requestCount: number;
    errorCount: number;
  }>;
  topIPs: Array<{
    ip: string;
    requestCount: number;
    uniqueUsers: number;
  }>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
}

class LogAnalyticsService {
  private alertRules: AlertRule[] = [];
  private logDirectory: string;

  constructor() {
    this.logDirectory = process.env.LOG_DIRECTORY || './logs';
    this.initializeDefaultAlerts();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlerts() {
    this.alertRules = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds threshold',
        condition: 'errorRate > threshold',
        threshold: 5, // 5%
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        description: 'Average response time exceeds threshold',
        condition: 'averageResponseTime > threshold',
        threshold: 2000, // 2 seconds
        severity: 'medium',
        enabled: true,
        notificationChannels: ['slack']
      },
      {
        id: 'failed-logins',
        name: 'Multiple Failed Logins',
        description: 'Too many failed login attempts',
        condition: 'failedLogins > threshold',
        threshold: 10,
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'memory-usage',
        name: 'High Memory Usage',
        description: 'Memory usage exceeds threshold',
        condition: 'averageMemoryUsage > threshold',
        threshold: 80, // 80%
        severity: 'medium',
        enabled: true,
        notificationChannels: ['slack']
      },
      {
        id: 'security-events',
        name: 'Security Events Spike',
        description: 'Unusual number of security events',
        condition: 'securityEvents > threshold',
        threshold: 20,
        severity: 'critical',
        enabled: true,
        notificationChannels: ['email', 'slack', 'pagerduty']
      }
    ];
  }

  /**
   * Analyze logs for a specific time period
   */
  async analyzeLogs(startDate: Date, endDate: Date): Promise<LogAnalytics> {
    try {
      const logs = await this.readLogsInRange(startDate, endDate);
      const analytics = this.processLogs(logs, startDate, endDate);
      
      // Check for alert conditions
      const triggeredAlerts = this.checkAlerts(analytics);
      analytics.alertsTriggered = triggeredAlerts;

      // Send notifications for triggered alerts
      for (const alert of triggeredAlerts) {
        await this.sendAlertNotification(alert, analytics);
      }

      return analytics;
    } catch (error) {
      loggingService.error('Failed to analyze logs', error);
      throw error;
    }
  }

  /**
   * Read logs within date range
   */
  private async readLogsInRange(startDate: Date, endDate: Date): Promise<any[]> {
    const logs: any[] = [];
    
    try {
      const logFiles = fs.readdirSync(this.logDirectory)
        .filter(file => file.endsWith('.log') && !file.includes('exceptions') && !file.includes('rejections'))
        .sort();

      for (const file of logFiles) {
        const filePath = path.join(this.logDirectory, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const logEntry = JSON.parse(line);
            const logDate = new Date(logEntry.timestamp);

            if (logDate >= startDate && logDate <= endDate) {
              logs.push(logEntry);
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } catch (error) {
      loggingService.error('Error reading log files', error);
    }

    return logs;
  }

  /**
   * Process logs and generate analytics
   */
  private processLogs(logs: any[], startDate: Date, endDate: Date): LogAnalytics {
    const analytics: LogAnalytics = {
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      totalRequests: 0,
      errorRate: 0,
      averageResponseTime: 0,
      slowestRequests: [],
      errorsByType: {},
      requestsByEndpoint: {},
      requestsByMethod: {},
      requestsByStatusCode: {},
      authenticationEvents: {
        successfulLogins: 0,
        failedLogins: 0,
        logouts: 0
      },
      securityEvents: {
        rateLimit: 0,
        unauthorized: 0,
        forbidden: 0,
        suspiciousActivity: 0
      },
      performanceMetrics: {
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        averageCpuUsage: 0,
        slowQueries: []
      },
      businessMetrics: {
        ticketsCreated: 0,
        shiftsStarted: 0,
        usersRegistered: 0,
        totalTransactions: 0
      },
      alertsTriggered: [],
      topUsers: [],
      topIPs: []
    };

    const requestLogs = logs.filter(log => log.message === 'HTTP Request');
    const errorLogs = logs.filter(log => log.level === 'error');
    const authLogs = logs.filter(log => log.service === 'authentication');
    const securityLogs = logs.filter(log => log.service === 'security');
    const businessLogs = logs.filter(log => log.service === 'business');
    const performanceLogs = logs.filter(log => log.service === 'performance');

    // Request analytics
    analytics.totalRequests = requestLogs.length;
    
    if (requestLogs.length > 0) {
      const totalResponseTime = requestLogs.reduce((sum, log) => sum + (log.responseTime || 0), 0);
      analytics.averageResponseTime = totalResponseTime / requestLogs.length;

      // Error rate
      const errorRequests = requestLogs.filter(log => log.statusCode >= 400);
      analytics.errorRate = (errorRequests.length / requestLogs.length) * 100;

      // Slowest requests
      analytics.slowestRequests = requestLogs
        .filter(log => log.responseTime > 1000)
        .sort((a, b) => b.responseTime - a.responseTime)
        .slice(0, 10)
        .map(log => ({
          url: log.url,
          method: log.method,
          responseTime: log.responseTime,
          statusCode: log.statusCode,
          timestamp: log.timestamp
        }));

      // Requests by endpoint
      requestLogs.forEach(log => {
        const endpoint = `${log.method} ${log.url?.split('?')[0] || 'unknown'}`;
        analytics.requestsByEndpoint[endpoint] = (analytics.requestsByEndpoint[endpoint] || 0) + 1;
      });

      // Requests by method
      requestLogs.forEach(log => {
        analytics.requestsByMethod[log.method] = (analytics.requestsByMethod[log.method] || 0) + 1;
      });

      // Requests by status code
      requestLogs.forEach(log => {
        const statusCode = log.statusCode?.toString() || 'unknown';
        analytics.requestsByStatusCode[statusCode] = (analytics.requestsByStatusCode[statusCode] || 0) + 1;
      });
    }

    // Error analytics
    errorLogs.forEach(log => {
      const errorType = log.error?.name || log.errorType || 'UnknownError';
      analytics.errorsByType[errorType] = (analytics.errorsByType[errorType] || 0) + 1;
    });

    // Authentication analytics
    authLogs.forEach(log => {
      if (log.event?.includes('login')) {
        if (log.success) {
          analytics.authenticationEvents.successfulLogins++;
        } else {
          analytics.authenticationEvents.failedLogins++;
        }
      } else if (log.event?.includes('logout')) {
        analytics.authenticationEvents.logouts++;
      }
    });

    // Security analytics
    securityLogs.forEach(log => {
      if (log.event?.includes('rate limit')) {
        analytics.securityEvents.rateLimit++;
      } else if (log.event?.includes('unauthorized')) {
        analytics.securityEvents.unauthorized++;
      } else if (log.event?.includes('forbidden')) {
        analytics.securityEvents.forbidden++;
      } else {
        analytics.securityEvents.suspiciousActivity++;
      }
    });

    // Performance analytics
    if (performanceLogs.length > 0) {
      const memoryUsages = performanceLogs
        .filter(log => log.metadata?.memoryUsage)
        .map(log => log.metadata.memoryUsage.heapUsedDelta);
      
      if (memoryUsages.length > 0) {
        analytics.performanceMetrics.averageMemoryUsage = memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length;
        analytics.performanceMetrics.peakMemoryUsage = Math.max(...memoryUsages);
      }

      // Slow queries
      analytics.performanceMetrics.slowQueries = performanceLogs
        .filter(log => log.duration > 500) // Queries slower than 500ms
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(log => ({
          operation: log.operation,
          duration: log.duration,
          timestamp: log.timestamp
        }));
    }

    // Business analytics
    businessLogs.forEach(log => {
      if (log.event === 'ticket_created') {
        analytics.businessMetrics.ticketsCreated++;
      } else if (log.event === 'shift_started') {
        analytics.businessMetrics.shiftsStarted++;
      } else if (log.event === 'user_created') {
        analytics.businessMetrics.usersRegistered++;
      }
      analytics.businessMetrics.totalTransactions++;
    });

    // Top users analytics
    const userCounts = new Map();
    const userErrors = new Map();
    
    requestLogs.forEach(log => {
      if (log.userId) {
        userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
        if (log.statusCode >= 400) {
          userErrors.set(log.userId, (userErrors.get(log.userId) || 0) + 1);
        }
      }
    });

    analytics.topUsers = Array.from(userCounts.entries())
      .map(([userId, requestCount]) => ({
        userId,
        requestCount,
        errorCount: userErrors.get(userId) || 0
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    // Top IPs analytics
    const ipCounts = new Map();
    const ipUsers = new Map();

    requestLogs.forEach(log => {
      if (log.ip) {
        ipCounts.set(log.ip, (ipCounts.get(log.ip) || 0) + 1);
        
        if (log.userId) {
          if (!ipUsers.has(log.ip)) {
            ipUsers.set(log.ip, new Set());
          }
          ipUsers.get(log.ip).add(log.userId);
        }
      }
    });

    analytics.topIPs = Array.from(ipCounts.entries())
      .map(([ip, requestCount]) => ({
        ip,
        requestCount,
        uniqueUsers: ipUsers.get(ip)?.size || 0
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    return analytics;
  }

  /**
   * Check alert conditions
   */
  private checkAlerts(analytics: LogAnalytics): any[] {
    const triggeredAlerts: any[] = [];

    for (const rule of this.alertRules.filter(r => r.enabled)) {
      let triggered = false;
      let actualValue: number;

      switch (rule.id) {
        case 'high-error-rate':
          actualValue = analytics.errorRate;
          triggered = actualValue > rule.threshold;
          break;
        
        case 'slow-response-time':
          actualValue = analytics.averageResponseTime;
          triggered = actualValue > rule.threshold;
          break;
        
        case 'failed-logins':
          actualValue = analytics.authenticationEvents.failedLogins;
          triggered = actualValue > rule.threshold;
          break;
        
        case 'memory-usage':
          actualValue = analytics.performanceMetrics.averageMemoryUsage;
          triggered = actualValue > rule.threshold;
          break;
        
        case 'security-events':
          actualValue = Object.values(analytics.securityEvents).reduce((sum, count) => sum + count, 0);
          triggered = actualValue > rule.threshold;
          break;
      }

      if (triggered) {
        triggeredAlerts.push({
          ...rule,
          actualValue,
          triggeredAt: new Date().toISOString(),
          message: `${rule.name}: ${actualValue} exceeds threshold of ${rule.threshold}`
        });
      }
    }

    return triggeredAlerts;
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: any, analytics: LogAnalytics): Promise<void> {
    try {
      loggingService.error(`ALERT TRIGGERED: ${alert.name}`, null, {
        alertId: alert.id,
        severity: alert.severity,
        actualValue: alert.actualValue,
        threshold: alert.threshold,
        message: alert.message,
        analytics: {
          totalRequests: analytics.totalRequests,
          errorRate: analytics.errorRate,
          averageResponseTime: analytics.averageResponseTime
        }
      });

      // Here you would implement actual notification sending
      // For example: email, Slack, PagerDuty, etc.
      for (const channel of alert.notificationChannels) {
        await this.sendNotificationToChannel(channel, alert, analytics);
      }
    } catch (error) {
      loggingService.error('Failed to send alert notification', error);
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendNotificationToChannel(channel: string, alert: any, analytics: LogAnalytics): Promise<void> {
    // This is a placeholder implementation
    // In production, implement actual integration with notification services
    
    const notificationData = {
      channel,
      alert: {
        name: alert.name,
        severity: alert.severity,
        message: alert.message,
        actualValue: alert.actualValue,
        threshold: alert.threshold
      },
      context: {
        totalRequests: analytics.totalRequests,
        errorRate: analytics.errorRate,
        averageResponseTime: analytics.averageResponseTime,
        period: analytics.period
      }
    };

    loggingService.info(`Notification sent to ${channel}`, notificationData);
  }

  /**
   * Generate real-time dashboard data
   */
  async generateDashboardData(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    try {
      const recentAnalytics = await this.analyzeLogs(oneHourAgo, now);
      
      return {
        timestamp: now.toISOString(),
        metrics: {
          requestsPerMinute: Math.round(recentAnalytics.totalRequests / 60),
          errorRate: recentAnalytics.errorRate,
          averageResponseTime: recentAnalytics.averageResponseTime,
          activeAlerts: recentAnalytics.alertsTriggered.length
        },
        charts: {
          requestsByMethod: recentAnalytics.requestsByMethod,
          statusCodeDistribution: recentAnalytics.requestsByStatusCode,
          topEndpoints: Object.entries(recentAnalytics.requestsByEndpoint)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
          errorsByType: recentAnalytics.errorsByType
        },
        recentErrors: recentAnalytics.slowestRequests.slice(0, 5),
        systemHealth: {
          memoryUsage: recentAnalytics.performanceMetrics.averageMemoryUsage,
          securityEvents: Object.values(recentAnalytics.securityEvents).reduce((sum, count) => sum + count, 0),
          authentication: recentAnalytics.authenticationEvents
        }
      };
    } catch (error) {
      loggingService.error('Failed to generate dashboard data', error);
      return {
        timestamp: now.toISOString(),
        error: 'Unable to generate dashboard data'
      };
    }
  }

  /**
   * Export analytics to different formats
   */
  async exportAnalytics(analytics: LogAnalytics, format: 'json' | 'csv' | 'pdf'): Promise<string> {
    try {
      const exportDir = path.join(this.logDirectory, 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `analytics-${timestamp}.${format}`;
      const filepath = path.join(exportDir, filename);

      switch (format) {
        case 'json':
          fs.writeFileSync(filepath, JSON.stringify(analytics, null, 2));
          break;
        
        case 'csv':
          const csvContent = this.convertToCSV(analytics);
          fs.writeFileSync(filepath, csvContent);
          break;
        
        case 'pdf':
          // For PDF generation, you might want to use a library like puppeteer or jsPDF
          // This is a placeholder implementation
          const htmlContent = this.generateHTMLReport(analytics);
          fs.writeFileSync(filepath.replace('.pdf', '.html'), htmlContent);
          break;
      }

      loggingService.info(`Analytics exported to ${filepath}`);
      return filepath;
    } catch (error) {
      loggingService.error('Failed to export analytics', error);
      throw error;
    }
  }

  /**
   * Convert analytics to CSV format
   */
  private convertToCSV(analytics: LogAnalytics): string {
    let csv = 'Metric,Value\n';
    csv += `Period,${analytics.period}\n`;
    csv += `Total Requests,${analytics.totalRequests}\n`;
    csv += `Error Rate,${analytics.errorRate}%\n`;
    csv += `Average Response Time,${analytics.averageResponseTime}ms\n`;
    csv += `Successful Logins,${analytics.authenticationEvents.successfulLogins}\n`;
    csv += `Failed Logins,${analytics.authenticationEvents.failedLogins}\n`;
    csv += `Tickets Created,${analytics.businessMetrics.ticketsCreated}\n`;
    csv += `Shifts Started,${analytics.businessMetrics.shiftsStarted}\n`;
    
    return csv;
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(analytics: LogAnalytics): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>FieldSync Analytics Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; }
        .error { color: red; }
        .warning { color: orange; }
        .success { color: green; }
      </style>
    </head>
    <body>
      <h1>FieldSync Analytics Report</h1>
      <p><strong>Period:</strong> ${analytics.period}</p>
      
      <h2>Request Metrics</h2>
      <div class="metric">Total Requests: ${analytics.totalRequests}</div>
      <div class="metric ${analytics.errorRate > 5 ? 'error' : 'success'}">Error Rate: ${analytics.errorRate.toFixed(2)}%</div>
      <div class="metric ${analytics.averageResponseTime > 1000 ? 'warning' : 'success'}">Average Response Time: ${analytics.averageResponseTime.toFixed(2)}ms</div>
      
      <h2>Security Metrics</h2>
      <div class="metric">Successful Logins: ${analytics.authenticationEvents.successfulLogins}</div>
      <div class="metric ${analytics.authenticationEvents.failedLogins > 10 ? 'error' : 'success'}">Failed Logins: ${analytics.authenticationEvents.failedLogins}</div>
      <div class="metric">Security Events: ${Object.values(analytics.securityEvents).reduce((sum, count) => sum + count, 0)}</div>
      
      <h2>Business Metrics</h2>
      <div class="metric">Tickets Created: ${analytics.businessMetrics.ticketsCreated}</div>
      <div class="metric">Shifts Started: ${analytics.businessMetrics.shiftsStarted}</div>
      <div class="metric">Users Registered: ${analytics.businessMetrics.usersRegistered}</div>
      
      ${analytics.alertsTriggered.length > 0 ? `
      <h2>Alerts</h2>
      ${analytics.alertsTriggered.map(alert => `
        <div class="metric error">
          <strong>${alert.name}:</strong> ${alert.message}
        </div>
      `).join('')}
      ` : ''}
    </body>
    </html>
    `;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `custom-${Date.now()}`;
    this.alertRules.push({ ...rule, id });
    loggingService.info(`Added custom alert rule: ${rule.name}`, { id, rule });
    return id;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(id: string): boolean {
    const index = this.alertRules.findIndex(rule => rule.id === id);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      loggingService.info(`Removed alert rule: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Update alert rule
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.find(r => r.id === id);
    if (rule) {
      Object.assign(rule, updates);
      loggingService.info(`Updated alert rule: ${id}`, updates);
      return true;
    }
    return false;
  }
}

export default new LogAnalyticsService();