// Enhanced Notification module for FieldSync backend
// Handles saving/loading notification preferences and sending notifications for SLA engine

import Notification, { NotificationPreference, NotificationLog } from '../models/notification';
import * as nodemailer from 'nodemailer';

// Enhanced interfaces for SLA notifications
export interface SlaNotificationRequest {
  type: 'breach' | 'escalation' | 'warning' | 'completion';
  entityId: string;
  entityType: string;
  recipients: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  subject: string;
  message: string;
  data?: Record<string, any>;
}

export class NotificationService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Send SLA notification to specified recipients
   */
  async sendSlaNotification(request: SlaNotificationRequest): Promise<boolean> {
    try {
      const results = await Promise.allSettled([
        this.sendEmailNotifications(request),
        this.sendPushNotifications(request),
        this.logNotifications(request)
      ]);

      // Return true if at least one notification method succeeded
      return results.some(result => result.status === 'fulfilled');
    } catch (error) {
      console.error('Error sending SLA notification:', error);
      return false;
    }
  }

  /**
   * Send email notifications to recipients
   */
  private async sendEmailNotifications(request: SlaNotificationRequest): Promise<void> {
    const emailPromises = request.recipients.map(async (recipient) => {
      try {
        await this.transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: recipient,
          subject: request.subject,
          html: this.generateEmailTemplate(request),
        });

        console.log(`Email sent successfully to ${recipient}`);
      } catch (error) {
        console.error(`Failed to send email to ${recipient}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
  }

  /**
   * Send push notifications (mock implementation)
   */
  private async sendPushNotifications(request: SlaNotificationRequest): Promise<void> {
    // Mock push notification implementation
    console.log('Sending push notifications:', {
      type: request.type,
      entityId: request.entityId,
      recipients: request.recipients,
      message: request.message
    });
  }

  /**
   * Log notifications to database
   */
  private async logNotifications(request: SlaNotificationRequest): Promise<void> {
    const logPromises = request.recipients.map(async (recipient) => {
      const log: NotificationLog = {
        userId: recipient,
        type: request.type,
        message: request.message,
        sentAt: new Date(),
        via: 'email'
      };

      await logNotification(recipient, log);
    });

    await Promise.allSettled(logPromises);
  }

  /**
   * Generate HTML email template for SLA notifications
   */
  private generateEmailTemplate(request: SlaNotificationRequest): string {
    const priorityColors = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545'
    };

    const color = priorityColors[request.priority];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
          .footer { background-color: #e9ecef; padding: 10px; border-radius: 0 0 5px 5px; font-size: 12px; }
          .priority { font-weight: bold; text-transform: uppercase; }
          .details { margin: 15px 0; }
          .label { font-weight: bold; color: #495057; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>FieldSync SLA Alert</h2>
          <span class="priority">${request.priority} Priority</span>
        </div>
        <div class="content">
          <p><span class="label">Alert Type:</span> ${request.type.toUpperCase()}</p>
          <p><span class="label">Entity:</span> ${request.entityType} - ${request.entityId}</p>
          <div class="details">
            <p>${request.message}</p>
          </div>
          ${request.data ? `
            <div class="details">
              <h4>Additional Information:</h4>
              ${Object.entries(request.data).map(([key, value]) => 
                `<p><span class="label">${key}:</span> ${value}</p>`
              ).join('')}
            </div>
          ` : ''}
          <p><span class="label">Timestamp:</span> ${new Date().toLocaleString()}</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from FieldSync SLA Engine.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send breach notification
   */
  async sendBreachNotification(
    entityId: string,
    entityType: string,
    breachType: 'response' | 'resolution',
    recipients: string[]
  ): Promise<boolean> {
    return this.sendSlaNotification({
      type: 'breach',
      entityId,
      entityType,
      recipients,
      priority: 'critical',
      subject: `SLA BREACH ALERT - ${entityType} ${entityId}`,
      message: `Critical: SLA ${breachType} deadline has been breached for ${entityType} ${entityId}. Immediate action required.`,
      data: {
        breachType,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send escalation notification
   */
  async sendEscalationNotification(
    entityId: string,
    entityType: string,
    escalationLevel: number,
    recipients: string[]
  ): Promise<boolean> {
    return this.sendSlaNotification({
      type: 'escalation',
      entityId,
      entityType,
      recipients,
      priority: escalationLevel > 2 ? 'critical' : 'high',
      subject: `SLA ESCALATION LEVEL ${escalationLevel} - ${entityType} ${entityId}`,
      message: `SLA has been escalated to level ${escalationLevel} for ${entityType} ${entityId}. Please review and take appropriate action.`,
      data: {
        escalationLevel,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send warning notification for at-risk SLAs
   */
  async sendWarningNotification(
    entityId: string,
    entityType: string,
    riskScore: number,
    timeRemaining: number,
    recipients: string[]
  ): Promise<boolean> {
    return this.sendSlaNotification({
      type: 'warning',
      entityId,
      entityType,
      recipients,
      priority: riskScore > 80 ? 'high' : 'medium',
      subject: `SLA WARNING - ${entityType} ${entityId}`,
      message: `Warning: SLA for ${entityType} ${entityId} is at ${riskScore}% risk of breach with ${timeRemaining} minutes remaining.`,
      data: {
        riskScore,
        timeRemaining,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send completion notification
   */
  async sendCompletionNotification(
    entityId: string,
    entityType: string,
    completionType: 'response' | 'resolution',
    recipients: string[]
  ): Promise<boolean> {
    return this.sendSlaNotification({
      type: 'completion',
      entityId,
      entityType,
      recipients,
      priority: 'low',
      subject: `SLA Completed - ${entityType} ${entityId}`,
      message: `SLA ${completionType} has been successfully completed for ${entityType} ${entityId}.`,
      data: {
        completionType,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export async function getUserNotificationPreferences(userId: string) {
  let doc = await Notification.findOne({ userId });
  if (!doc) {
    doc = await Notification.create({ userId, preferences: [], logs: [] });
  }
  return doc.preferences;
}

export async function setUserNotificationPreferences(userId: string, prefs: NotificationPreference[]) {
  let doc = await Notification.findOneAndUpdate(
    { userId },
    { $set: { preferences: prefs } },
    { upsert: true, new: true }
  );
  return doc.preferences;
}

export async function logNotification(userId: string, log: NotificationLog) {
  await Notification.updateOne(
    { userId },
    { $push: { logs: log } },
    { upsert: true }
  );
}

// Example: send email notification (configure transporter for production)
const transporter = nodemailer.createTransport({
  // Configure with your SMTP or service
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendEmailNotification(to: string, subject: string, text: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
}
