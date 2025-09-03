/**
 * Comprehensive Alerting Service
 * Advanced alerting system with escalation policies, incident management, and notification channels
 */

import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import { loggingService } from './loggingService';
import { monitoring } from './MonitoringService';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  threshold: number;
  duration: number; // in seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  tags: Record<string, string>;
  escalationPolicy?: string;
  suppressionRules?: SuppressionRule[];
}

interface SuppressionRule {
  field: string;
  operator: 'equals' | 'contains' | 'regex';
  value: string;
  duration: number; // in seconds
}

interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  steps: EscalationStep[];
  repeatInterval?: number; // in minutes
  maxEscalations?: number;
}

interface EscalationStep {
  delay: number; // in minutes
  channels: NotificationChannel[];
  conditions?: {
    businessHours?: boolean;
    weekends?: boolean;
    holidays?: boolean;
  };
}

interface NotificationChannel {
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

interface Alert {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved' | 'suppressed' | 'acknowledged';
  timestamp: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  escalationLevel: number;
  nextEscalation?: Date;
  suppressedUntil?: Date;
  metadata: Record<string, any>;
  fingerprint: string;
  correlationId?: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  assignee?: string;
  alerts: string[]; // Alert IDs
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  postmortem?: {
    required: boolean;
    completed: boolean;
    url?: string;
  };
  timeline: IncidentEvent[];
  tags: Record<string, string>;
}

interface IncidentEvent {
  id: string;
  type: 'created' | 'updated' | 'alert_added' | 'alert_removed' | 'acknowledged' | 'resolved' | 'escalated' | 'note_added';
  timestamp: Date;
  description: string;
  user?: string;
  metadata?: Record<string, any>;
}

interface AlertingConfig {
  enabled: boolean;
  evaluationInterval: number; // in seconds
  maxAlertsPerRule: number;
  defaultEscalationPolicy: string;
  retentionDays: number;
  enableIncidentManagement: boolean;
  enablePostmortems: boolean;
  businessHours: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
    weekdays: number[]; // 0-6, Sunday=0
  };
  holidays: string[]; // ISO date strings
}

class AlertingService extends EventEmitter {
  private config: AlertingConfig;
  private rules: Map<string, AlertRule> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private suppressions: Map<string, Date> = new Map();
  private evaluationTimer?: NodeJS.Timeout;
  private escalationTimer?: NodeJS.Timeout;
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private emailTransporter?: nodemailer.Transporter;

  constructor(config: AlertingConfig) {
    super();
    this.config = config;
    this.initializeEmailTransporter();
    this.initializeDefaultPolicies();
    this.startEvaluationLoop();
    this.startEscalationLoop();
  }

  private initializeEmailTransporter(): void {
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  private initializeDefaultPolicies(): void {
    // Default escalation policy
    const defaultPolicy: EscalationPolicy = {
      id: 'default',
      name: 'Default Escalation Policy',
      description: 'Standard escalation for all alerts',
      steps: [
        {
          delay: 0,
          channels: [
            {
              type: 'email',
              config: { recipients: [process.env.DEFAULT_ALERT_EMAIL || 'admin@fieldsync.io'] },
              enabled: true,
            },
          ],
        },
        {
          delay: 15,
          channels: [
            {
              type: 'email',
              config: { recipients: [process.env.ESCALATION_EMAIL || 'escalation@fieldsync.io'] },
              enabled: true,
            },
          ],
          conditions: { businessHours: true },
        },
        {
          delay: 30,
          channels: [
            {
              type: 'webhook',
              config: { url: process.env.ESCALATION_WEBHOOK_URL },
              enabled: !!process.env.ESCALATION_WEBHOOK_URL,
            },
          ],
        },
      ],
      repeatInterval: 60,
      maxEscalations: 3,
    };

    this.escalationPolicies.set('default', defaultPolicy);

    // Critical alert policy
    const criticalPolicy: EscalationPolicy = {
      id: 'critical',
      name: 'Critical Alert Policy',
      description: 'Immediate escalation for critical issues',
      steps: [
        {
          delay: 0,
          channels: [
            {
              type: 'email',
              config: { recipients: [process.env.CRITICAL_ALERT_EMAIL || 'critical@fieldsync.io'] },
              enabled: true,
            },
          ],
        },
        {
          delay: 5,
          channels: [
            {
              type: 'webhook',
              config: { url: process.env.CRITICAL_WEBHOOK_URL },
              enabled: !!process.env.CRITICAL_WEBHOOK_URL,
            },
          ],
        },
      ],
      repeatInterval: 30,
      maxEscalations: 5,
    };

    this.escalationPolicies.set('critical', criticalPolicy);
  }

  /**
   * Create or update an alert rule
   */
  public createRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const id = this.generateId();
    const alertRule: AlertRule = { ...rule, id };
    
    this.rules.set(id, alertRule);
    
    loggingService.audit('alert_rule_created', 'alert_rule', undefined, {
      ruleId: id,
      ruleName: rule.name,
      metric: rule.metric,
      severity: rule.severity,
    });

    this.emit('ruleCreated', alertRule);
    return alertRule;
  }

  /**
   * Update an existing alert rule
   */
  public updateRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(id, updatedRule);

    loggingService.audit('alert_rule_updated', 'alert_rule', undefined, {
      ruleId: id,
      updates: Object.keys(updates),
    });

    this.emit('ruleUpdated', updatedRule);
    return updatedRule;
  }

  /**
   * Delete an alert rule
   */
  public deleteRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    this.rules.delete(id);
    
    loggingService.audit('alert_rule_deleted', 'alert_rule', undefined, {
      ruleId: id,
      ruleName: rule.name,
    });

    this.emit('ruleDeleted', id);
    return true;
  }

  /**
   * Create or update an escalation policy
   */
  public createEscalationPolicy(policy: Omit<EscalationPolicy, 'id'>): EscalationPolicy {
    const id = this.generateId();
    const escalationPolicy: EscalationPolicy = { ...policy, id };
    
    this.escalationPolicies.set(id, escalationPolicy);
    
    loggingService.audit('escalation_policy_created', 'escalation_policy', undefined, {
      policyId: id,
      policyName: policy.name,
      steps: policy.steps.length,
    });

    return escalationPolicy;
  }

  /**
   * Manually fire an alert
   */
  public fireAlert(
    ruleId: string,
    title: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Alert {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const fingerprint = this.generateFingerprint(rule, metadata);
    const existingAlert = this.findAlertByFingerprint(fingerprint);

    // If alert already exists and is firing, update it
    if (existingAlert && existingAlert.status === 'firing') {
      existingAlert.timestamp = new Date();
      existingAlert.metadata = { ...existingAlert.metadata, ...metadata };
      return existingAlert;
    }

    const alert: Alert = {
      id: this.generateId(),
      ruleId,
      title,
      description,
      severity: rule.severity,
      status: 'firing',
      timestamp: new Date(),
      escalationLevel: 0,
      metadata,
      fingerprint,
      correlationId: metadata.correlationId,
    };

    this.alerts.set(alert.id, alert);

    loggingService.security(`Alert fired: ${title}`, rule.severity, undefined, {
      alertId: alert.id,
      ruleId,
      severity: rule.severity,
      fingerprint,
      metadata,
    });

    // Check if incident management is enabled
    if (this.config.enableIncidentManagement) {
      this.createOrUpdateIncident(alert);
    }

    // Start escalation process
    this.scheduleEscalation(alert);

    this.emit('alertFired', alert);
    return alert;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    
    loggingService.info(`Alert resolved: ${alert.title}`, undefined, {
      alertId,
      resolvedBy,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
    });

    // Update incident
    if (this.config.enableIncidentManagement) {
      this.updateIncidentForResolvedAlert(alert);
    }

    this.emit('alertResolved', alert);
    return true;
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    loggingService.info(`Alert acknowledged: ${alert.title}`, undefined, {
      alertId,
      acknowledgedBy,
    });

    this.emit('alertAcknowledged', alert);
    return true;
  }

  /**
   * Create or update incident
   */
  private createOrUpdateIncident(alert: Alert): void {
    // Find existing incident for similar alerts
    const existingIncident = this.findIncidentForAlert(alert);

    if (existingIncident) {
      // Add alert to existing incident
      if (!existingIncident.alerts.includes(alert.id)) {
        existingIncident.alerts.push(alert.id);
        existingIncident.updatedAt = new Date();
        
        // Escalate severity if needed
        if (this.compareSeverity(alert.severity, existingIncident.severity) > 0) {
          existingIncident.severity = alert.severity;
        }

        this.addIncidentEvent(existingIncident, {
          type: 'alert_added',
          description: `Alert added: ${alert.title}`,
          metadata: { alertId: alert.id },
        });
      }
    } else {
      // Create new incident
      const incident: Incident = {
        id: this.generateId(),
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        status: 'open',
        alerts: [alert.id],
        createdAt: new Date(),
        updatedAt: new Date(),
        timeline: [],
        tags: { alertRule: alert.ruleId },
        postmortem: {
          required: alert.severity === 'critical',
          completed: false,
        },
      };

      this.incidents.set(incident.id, incident);

      this.addIncidentEvent(incident, {
        type: 'created',
        description: `Incident created for alert: ${alert.title}`,
        metadata: { alertId: alert.id },
      });

      loggingService.audit('incident_created', 'incident', undefined, {
        incidentId: incident.id,
        alertId: alert.id,
        severity: incident.severity,
      });

      this.emit('incidentCreated', incident);
    }
  }

  /**
   * Update incident when alert is resolved
   */
  private updateIncidentForResolvedAlert(alert: Alert): void {
    const incident = this.findIncidentByAlertId(alert.id);
    if (!incident) return;

    this.addIncidentEvent(incident, {
      type: 'alert_removed',
      description: `Alert resolved: ${alert.title}`,
      metadata: { alertId: alert.id },
    });

    // Check if all alerts in incident are resolved
    const activeAlerts = incident.alerts.filter(alertId => {
      const a = this.alerts.get(alertId);
      return a && a.status === 'firing';
    });

    if (activeAlerts.length === 0) {
      incident.status = 'resolved';
      incident.resolvedAt = new Date();
      incident.updatedAt = new Date();

      this.addIncidentEvent(incident, {
        type: 'resolved',
        description: 'All alerts resolved, incident auto-resolved',
      });

      this.emit('incidentResolved', incident);
    }
  }

  /**
   * Start evaluation loop for checking metrics
   */
  private startEvaluationLoop(): void {
    if (!this.config.enabled) return;

    this.evaluationTimer = setInterval(() => {
      this.evaluateRules();
    }, this.config.evaluationInterval * 1000);
  }

  /**
   * Start escalation loop for processing escalations
   */
  private startEscalationLoop(): void {
    this.escalationTimer = setInterval(() => {
      this.processEscalations();
    }, 60 * 1000); // Check every minute
  }

  /**
   * Evaluate all alert rules
   */
  private async evaluateRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        loggingService.error(`Failed to evaluate rule: ${rule.name}`, error, undefined, {
          ruleId: rule.id,
          metric: rule.metric,
        });
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const currentValue = await this.getMetricValue(rule.metric, rule.tags);
    const isConditionMet = this.evaluateCondition(currentValue, rule.condition, rule.threshold);

    if (isConditionMet) {
      const fingerprint = this.generateFingerprint(rule, { value: currentValue });
      const existingAlert = this.findAlertByFingerprint(fingerprint);

      if (!existingAlert || existingAlert.status !== 'firing') {
        this.fireAlert(
          rule.id,
          `${rule.name} threshold exceeded`,
          `${rule.metric} is ${currentValue}, threshold is ${rule.condition} ${rule.threshold}`,
          { value: currentValue, threshold: rule.threshold, condition: rule.condition }
        );
      }
    } else {
      // Check if we should resolve any existing alerts for this rule
      const activeAlerts = Array.from(this.alerts.values()).filter(
        alert => alert.ruleId === rule.id && alert.status === 'firing'
      );

      for (const alert of activeAlerts) {
        this.resolveAlert(alert.id, 'system');
      }
    }
  }

  /**
   * Get metric value from monitoring service
   */
  private async getMetricValue(metric: string, tags: Record<string, string>): Promise<number> {
    try {
      const metrics = monitoring.getMetrics();
      // Simple implementation - in production, this would query the actual metric store
      return Math.random() * 100; // Placeholder
    } catch (error) {
      loggingService.error(`Failed to get metric value: ${metric}`, error);
      return 0;
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  /**
   * Process escalations for all alerts
   */
  private processEscalations(): void {
    const now = new Date();

    for (const alert of this.alerts.values()) {
      if (alert.status !== 'firing' || !alert.nextEscalation) continue;

      if (now >= alert.nextEscalation) {
        this.escalateAlert(alert);
      }
    }
  }

  /**
   * Escalate an alert
   */
  private async escalateAlert(alert: Alert): Promise<void> {
    const rule = this.rules.get(alert.ruleId);
    if (!rule) return;

    const policyId = rule.escalationPolicy || this.config.defaultEscalationPolicy;
    const policy = this.escalationPolicies.get(policyId);
    if (!policy) return;

    const step = policy.steps[alert.escalationLevel];
    if (!step) return;

    // Check conditions
    if (step.conditions && !this.checkEscalationConditions(step.conditions)) {
      // Skip this step, schedule next one
      this.scheduleNextEscalation(alert, policy);
      return;
    }

    // Send notifications
    for (const channel of step.channels) {
      if (channel.enabled) {
        await this.sendNotification(channel, alert, rule);
      }
    }

    alert.escalationLevel++;
    
    loggingService.warn(`Alert escalated: ${alert.title}`, undefined, {
      alertId: alert.id,
      escalationLevel: alert.escalationLevel,
      policyId,
    });

    // Schedule next escalation if available
    this.scheduleNextEscalation(alert, policy);

    this.emit('alertEscalated', alert);
  }

  /**
   * Schedule escalation for an alert
   */
  private scheduleEscalation(alert: Alert): void {
    const rule = this.rules.get(alert.ruleId);
    if (!rule) return;

    const policyId = rule.escalationPolicy || this.config.defaultEscalationPolicy;
    const policy = this.escalationPolicies.get(policyId);
    if (!policy || policy.steps.length === 0) return;

    const firstStep = policy.steps[0];
    alert.nextEscalation = new Date(Date.now() + firstStep.delay * 60 * 1000);
  }

  /**
   * Schedule next escalation
   */
  private scheduleNextEscalation(alert: Alert, policy: EscalationPolicy): void {
    if (alert.escalationLevel >= policy.steps.length) {
      // Check if we should repeat
      if (policy.repeatInterval && (!policy.maxEscalations || alert.escalationLevel < policy.maxEscalations)) {
        alert.nextEscalation = new Date(Date.now() + policy.repeatInterval * 60 * 1000);
        alert.escalationLevel = 0; // Reset to first step
      } else {
        alert.nextEscalation = undefined; // No more escalations
      }
    } else {
      const nextStep = policy.steps[alert.escalationLevel];
      alert.nextEscalation = new Date(Date.now() + nextStep.delay * 60 * 1000);
    }
  }

  /**
   * Check escalation conditions
   */
  private checkEscalationConditions(conditions: any): boolean {
    const now = new Date();
    
    if (conditions.businessHours !== undefined) {
      const isBusinessHours = this.isBusinessHours(now);
      if (conditions.businessHours !== isBusinessHours) {
        return false;
      }
    }

    if (conditions.weekends !== undefined) {
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      if (conditions.weekends !== isWeekend) {
        return false;
      }
    }

    if (conditions.holidays !== undefined) {
      const isHoliday = this.isHoliday(now);
      if (conditions.holidays !== isHoliday) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current time is business hours
   */
  private isBusinessHours(date: Date): boolean {
    const dayOfWeek = date.getDay();
    if (!this.config.businessHours.weekdays.includes(dayOfWeek)) {
      return false;
    }

    const timeStr = date.toTimeString().substr(0, 5);
    return timeStr >= this.config.businessHours.start && timeStr <= this.config.businessHours.end;
  }

  /**
   * Check if date is a holiday
   */
  private isHoliday(date: Date): boolean {
    const dateStr = date.toISOString().substr(0, 10);
    return this.config.holidays.includes(dateStr);
  }

  /**
   * Send notification through a channel
   */
  private async sendNotification(channel: NotificationChannel, alert: Alert, rule: AlertRule): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel, alert, rule);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert, rule);
          break;
        case 'slack':
          await this.sendSlackNotification(channel, alert, rule);
          break;
        default:
          loggingService.warn(`Unsupported notification channel: ${channel.type}`);
      }
    } catch (error) {
      loggingService.error(`Failed to send notification via ${channel.type}`, error, undefined, {
        alertId: alert.id,
        channelType: channel.type,
      });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(channel: NotificationChannel, alert: Alert, rule: AlertRule): Promise<void> {
    if (!this.emailTransporter) return;

    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const body = `
Alert Details:
- Rule: ${rule.name}
- Severity: ${alert.severity}
- Status: ${alert.status}
- Time: ${alert.timestamp.toISOString()}
- Description: ${alert.description}

Metadata:
${JSON.stringify(alert.metadata, null, 2)}

Alert ID: ${alert.id}
    `;

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@fieldsync.io',
      to: channel.config.recipients.join(', '),
      subject,
      text: body,
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert, rule: AlertRule): Promise<void> {
    const payload = {
      alert,
      rule,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Send Slack notification (placeholder)
   */
  private async sendSlackNotification(channel: NotificationChannel, alert: Alert, rule: AlertRule): Promise<void> {
    // Implementation would use Slack SDK
    loggingService.info(`Slack notification sent for alert: ${alert.title}`);
  }

  /**
   * Utility methods
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateFingerprint(rule: AlertRule, metadata: Record<string, any>): string {
    const data = `${rule.id}:${JSON.stringify(metadata)}`;
    return Buffer.from(data).toString('base64');
  }

  private findAlertByFingerprint(fingerprint: string): Alert | undefined {
    return Array.from(this.alerts.values()).find(alert => alert.fingerprint === fingerprint);
  }

  private findIncidentForAlert(alert: Alert): Incident | undefined {
    return Array.from(this.incidents.values()).find(incident => 
      incident.status === 'open' && 
      incident.severity === alert.severity &&
      incident.tags.alertRule === alert.ruleId
    );
  }

  private findIncidentByAlertId(alertId: string): Incident | undefined {
    return Array.from(this.incidents.values()).find(incident => 
      incident.alerts.includes(alertId)
    );
  }

  private compareSeverity(severity1: string, severity2: string): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity1 as keyof typeof levels] - levels[severity2 as keyof typeof levels];
  }

  private addIncidentEvent(incident: Incident, event: Omit<IncidentEvent, 'id' | 'timestamp'>): void {
    const incidentEvent: IncidentEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
    };

    incident.timeline.push(incidentEvent);
    incident.updatedAt = new Date();
  }

  /**
   * Public API methods
   */
  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  public getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  public getAlerts(filters?: { status?: string; severity?: string; ruleId?: string }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(alert => alert.status === filters.status);
      }
      if (filters.severity) {
        alerts = alerts.filter(alert => alert.severity === filters.severity);
      }
      if (filters.ruleId) {
        alerts = alerts.filter(alert => alert.ruleId === filters.ruleId);
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getIncidents(filters?: { status?: string; severity?: string }): Incident[] {
    let incidents = Array.from(this.incidents.values());

    if (filters) {
      if (filters.status) {
        incidents = incidents.filter(incident => incident.status === filters.status);
      }
      if (filters.severity) {
        incidents = incidents.filter(incident => incident.severity === filters.severity);
      }
    }

    return incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getStats(): any {
    const alerts = Array.from(this.alerts.values());
    const incidents = Array.from(this.incidents.values());

    return {
      alerts: {
        total: alerts.length,
        firing: alerts.filter(a => a.status === 'firing').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        bySeverity: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length,
        },
      },
      incidents: {
        total: incidents.length,
        open: incidents.filter(i => i.status === 'open').length,
        investigating: incidents.filter(i => i.status === 'investigating').length,
        resolved: incidents.filter(i => i.status === 'resolved').length,
        closed: incidents.filter(i => i.status === 'closed').length,
      },
      rules: {
        total: this.rules.size,
        enabled: Array.from(this.rules.values()).filter(r => r.enabled).length,
      },
    };
  }

  /**
   * Cleanup old alerts and incidents
   */
  public cleanup(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    // Clean up old resolved alerts
    for (const [id, alert] of this.alerts) {
      if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < cutoffDate) {
        this.alerts.delete(id);
      }
    }

    // Clean up old closed incidents
    for (const [id, incident] of this.incidents) {
      if (incident.status === 'closed' && incident.resolvedAt && incident.resolvedAt < cutoffDate) {
        this.incidents.delete(id);
      }
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
    }

    // Close email transporter
    if (this.emailTransporter) {
      this.emailTransporter.close();
    }

    loggingService.info('Alerting service shut down gracefully');
  }
}

// Default configuration
const defaultConfig: AlertingConfig = {
  enabled: process.env.ALERTING_ENABLED !== 'false',
  evaluationInterval: parseInt(process.env.ALERT_EVALUATION_INTERVAL || '60'),
  maxAlertsPerRule: parseInt(process.env.MAX_ALERTS_PER_RULE || '10'),
  defaultEscalationPolicy: 'default',
  retentionDays: parseInt(process.env.ALERT_RETENTION_DAYS || '30'),
  enableIncidentManagement: process.env.INCIDENT_MANAGEMENT === 'true',
  enablePostmortems: process.env.POSTMORTEMS_ENABLED === 'true',
  businessHours: {
    start: process.env.BUSINESS_HOURS_START || '09:00',
    end: process.env.BUSINESS_HOURS_END || '17:00',
    timezone: process.env.BUSINESS_HOURS_TIMEZONE || 'UTC',
    weekdays: [1, 2, 3, 4, 5], // Monday to Friday
  },
  holidays: (process.env.HOLIDAYS || '').split(',').filter(Boolean),
};

// Export singleton instance
export const alertingService = new AlertingService(defaultConfig);

// Export types and classes
export { 
  AlertingService, 
  AlertingConfig, 
  AlertRule, 
  Alert, 
  Incident, 
  EscalationPolicy, 
  NotificationChannel 
};