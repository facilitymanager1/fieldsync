import nodemailer from 'nodemailer';
import axios from 'axios';
import loggingService from './loggingService';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
}

export interface PagerDutyConfig {
  integrationKey: string;
  apiUrl?: string;
}

class AlertNotificationService {
  private emailTransporter?: nodemailer.Transporter;

  constructor() {
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter(): void {
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        this.emailTransporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          },
          tls: {
            rejectUnauthorized: false // For self-signed certificates
          }
        });

        // Verify connection
        this.emailTransporter.verify((error, success) => {
          if (error) {
            loggingService.error('Email transporter verification failed', error);
          } else {
            loggingService.info('Email transporter ready');
          }
        });
      }
    } catch (error) {
      loggingService.error('Failed to initialize email transporter', error);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(
    config: EmailConfig,
    recipients: string[],
    subject: string,
    content: {
      text: string;
      html?: string;
    },
    errorContext?: any
  ): Promise<boolean> {
    try {
      let transporter = this.emailTransporter;

      // Create a new transporter if config is different from default
      if (config.host !== process.env.SMTP_HOST) {
        transporter = nodemailer.createTransporter({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.auth
        });
      }

      if (!transporter) {
        throw new Error('Email transporter not configured');
      }

      const mailOptions = {
        from: `"FieldSync Alerts" <${config.auth.user}>`,
        to: recipients.join(', '),
        subject,
        text: content.text,
        html: content.html || this.generateDefaultEmailHtml(subject, content.text, errorContext),
        attachments: errorContext?.attachments || []
      };

      const result = await transporter.sendMail(mailOptions);

      loggingService.info('Email alert sent successfully', {
        messageId: result.messageId,
        recipients: recipients.length,
        subject
      });

      return true;
    } catch (error) {
      loggingService.error('Failed to send email alert', error, {
        recipients: recipients.length,
        subject
      });
      return false;
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(
    config: SlackConfig,
    message: string,
    options: {
      color?: 'good' | 'warning' | 'danger' | string;
      fields?: Array<{
        title: string;
        value: string;
        short?: boolean;
      }>;
      actions?: Array<{
        type: string;
        text: string;
        url?: string;
      }>;
    } = {}
  ): Promise<boolean> {
    try {
      const payload = {
        channel: config.channel,
        username: config.username || 'FieldSync Alerts',
        icon_emoji: config.iconEmoji || ':warning:',
        attachments: [{
          color: options.color || 'warning',
          text: message,
          fields: options.fields || [],
          actions: options.actions || [],
          footer: 'FieldSync Alert System',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      const response = await axios.post(config.webhookUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        loggingService.info('Slack alert sent successfully', {
          channel: config.channel,
          webhook: config.webhookUrl.substring(0, 50) + '...'
        });
        return true;
      } else {
        throw new Error(`Slack API returned status ${response.status}`);
      }
    } catch (error) {
      loggingService.error('Failed to send Slack alert', error, {
        channel: config.channel,
        message: message.substring(0, 100)
      });
      return false;
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(
    config: WebhookConfig,
    payload: any
  ): Promise<boolean> {
    try {
      const response = await axios({
        method: config.method || 'POST',
        url: config.url,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FieldSync-Alert-System/1.0',
          ...config.headers
        },
        timeout: config.timeout || 10000
      });

      if (response.status >= 200 && response.status < 300) {
        loggingService.info('Webhook alert sent successfully', {
          url: config.url,
          method: config.method,
          statusCode: response.status
        });
        return true;
      } else {
        throw new Error(`Webhook returned status ${response.status}`);
      }
    } catch (error) {
      loggingService.error('Failed to send webhook alert', error, {
        url: config.url,
        method: config.method
      });
      return false;
    }
  }

  /**
   * Send PagerDuty alert
   */
  async sendPagerDutyAlert(
    config: PagerDutyConfig,
    alert: {
      summary: string;
      severity: 'critical' | 'error' | 'warning' | 'info';
      source: string;
      component?: string;
      group?: string;
      class?: string;
      customDetails?: Record<string, any>;
    }
  ): Promise<boolean> {
    try {
      const apiUrl = config.apiUrl || 'https://events.pagerduty.com/v2/enqueue';
      
      const payload = {
        routing_key: config.integrationKey,
        event_action: 'trigger',
        dedup_key: `fieldsync-${alert.source}-${Date.now()}`,
        payload: {
          summary: alert.summary,
          severity: alert.severity,
          source: alert.source,
          component: alert.component,
          group: alert.group,
          class: alert.class,
          custom_details: alert.customDetails
        },
        client: 'FieldSync Alert System',
        client_url: process.env.FRONTEND_URL || 'http://localhost:3000'
      };

      const response = await axios.post(apiUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.pagerduty+json;version=2'
        }
      });

      if (response.status === 202) {
        loggingService.info('PagerDuty alert sent successfully', {
          dedupKey: payload.dedup_key,
          severity: alert.severity,
          summary: alert.summary
        });
        return true;
      } else {
        throw new Error(`PagerDuty API returned status ${response.status}`);
      }
    } catch (error) {
      loggingService.error('Failed to send PagerDuty alert', error, {
        severity: alert.severity,
        summary: alert.summary
      });
      return false;
    }
  }

  /**
   * Send multi-channel alert
   */
  async sendMultiChannelAlert(
    channels: Array<{
      type: 'email' | 'slack' | 'webhook' | 'pagerduty';
      config: any;
      data: any;
    }>,
    alertInfo: {
      title: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      source: string;
      errorContext?: any;
    }
  ): Promise<{
    success: boolean;
    results: Array<{
      type: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results: Array<{
      type: string;
      success: boolean;
      error?: string;
    }> = [];

    let overallSuccess = false;

    for (const channel of channels) {
      try {
        let success = false;

        switch (channel.type) {
          case 'email':
            success = await this.sendEmailAlert(
              channel.config,
              channel.data.recipients,
              `[${alertInfo.severity.toUpperCase()}] ${alertInfo.title}`,
              {
                text: alertInfo.message,
                html: this.generateAlertEmailHtml(alertInfo)
              },
              alertInfo.errorContext
            );
            break;

          case 'slack':
            success = await this.sendSlackAlert(
              channel.config,
              `*${alertInfo.title}*\n${alertInfo.message}`,
              {
                color: this.getSeverityColor(alertInfo.severity),
                fields: [
                  {
                    title: 'Severity',
                    value: alertInfo.severity.toUpperCase(),
                    short: true
                  },
                  {
                    title: 'Source',
                    value: alertInfo.source,
                    short: true
                  },
                  {
                    title: 'Timestamp',
                    value: new Date().toISOString(),
                    short: true
                  }
                ]
              }
            );
            break;

          case 'webhook':
            success = await this.sendWebhookAlert(
              channel.config,
              {
                alert: alertInfo,
                timestamp: new Date().toISOString(),
                source: 'fieldsync-alert-system'
              }
            );
            break;

          case 'pagerduty':
            success = await this.sendPagerDutyAlert(
              channel.config,
              {
                summary: `${alertInfo.title}: ${alertInfo.message}`,
                severity: this.mapSeverityToPagerDuty(alertInfo.severity),
                source: alertInfo.source,
                customDetails: alertInfo.errorContext
              }
            );
            break;
        }

        results.push({
          type: channel.type,
          success
        });

        if (success) {
          overallSuccess = true;
        }
      } catch (error) {
        results.push({
          type: channel.type,
          success: false,
          error: error.message
        });

        loggingService.error(`Failed to send ${channel.type} alert`, error);
      }
    }

    return {
      success: overallSuccess,
      results
    };
  }

  /**
   * Test notification channel
   */
  async testNotificationChannel(
    type: 'email' | 'slack' | 'webhook' | 'pagerduty',
    config: any
  ): Promise<boolean> {
    const testAlert = {
      title: 'Test Alert',
      message: 'This is a test alert from FieldSync monitoring system.',
      severity: 'medium' as const,
      source: 'test-system'
    };

    try {
      switch (type) {
        case 'email':
          return await this.sendEmailAlert(
            config,
            config.recipients || ['test@example.com'],
            'FieldSync Test Alert',
            {
              text: testAlert.message,
              html: this.generateAlertEmailHtml(testAlert)
            }
          );

        case 'slack':
          return await this.sendSlackAlert(
            config,
            `*${testAlert.title}*\n${testAlert.message}`,
            {
              color: 'good',
              fields: [
                {
                  title: 'Type',
                  value: 'Test Alert',
                  short: true
                },
                {
                  title: 'Status',
                  value: 'Success',
                  short: true
                }
              ]
            }
          );

        case 'webhook':
          return await this.sendWebhookAlert(
            config,
            {
              alert: testAlert,
              test: true,
              timestamp: new Date().toISOString()
            }
          );

        case 'pagerduty':
          return await this.sendPagerDutyAlert(
            config,
            {
              summary: 'FieldSync Test Alert',
              severity: 'info',
              source: 'test-system',
              customDetails: { test: true }
            }
          );

        default:
          return false;
      }
    } catch (error) {
      loggingService.error(`Failed to test ${type} channel`, error);
      return false;
    }
  }

  /**
   * Generate default email HTML
   */
  private generateDefaultEmailHtml(subject: string, content: string, context?: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { border-bottom: 2px solid #e1e1e1; padding-bottom: 20px; margin-bottom: 20px; }
            .title { color: #333; font-size: 24px; margin: 0; }
            .content { line-height: 1.6; color: #555; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">FieldSync Alert</h1>
            </div>
            <div class="content">
              <p><strong>Subject:</strong> ${subject}</p>
              <p>${content.replace(/\n/g, '<br>')}</p>
              ${context ? `
                <h3>Additional Details:</h3>
                <pre style="background: #f8f8f8; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(context, null, 2)}</pre>
              ` : ''}
            </div>
            <div class="footer">
              <p>This alert was generated by FieldSync monitoring system at ${new Date().toISOString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate alert-specific email HTML
   */
  private generateAlertEmailHtml(alertInfo: any): string {
    const severityColors = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545'
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>FieldSync Alert: ${alertInfo.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; background-color: ${severityColors[alertInfo.severity] || '#6c757d'}; color: white; margin-bottom: 10px; }
            .title { font-size: 24px; margin: 10px 0 0; font-weight: 300; }
            .content { padding: 30px 20px; }
            .message { font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 25px; }
            .details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #e9ecef; padding-bottom: 8px; }
            .detail-label { font-weight: 600; color: #495057; }
            .detail-value { color: #6c757d; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="severity-badge">${alertInfo.severity}</div>
              <h1 class="title">${alertInfo.title}</h1>
            </div>
            <div class="content">
              <div class="message">${alertInfo.message}</div>
              
              <div class="details">
                <div class="detail-row">
                  <span class="detail-label">Severity:</span>
                  <span class="detail-value">${alertInfo.severity.toUpperCase()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Source:</span>
                  <span class="detail-value">${alertInfo.source}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Timestamp:</span>
                  <span class="detail-value">${new Date().toISOString()}</span>
                </div>
                ${alertInfo.errorContext?.errorId ? `
                <div class="detail-row">
                  <span class="detail-label">Error ID:</span>
                  <span class="detail-value">${alertInfo.errorContext.errorId}</span>
                </div>
                ` : ''}
              </div>
              
              ${process.env.FRONTEND_URL ? `
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL}/admin/errors" class="button">View in Dashboard</a>
                </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>This alert was generated by the FieldSync monitoring system.</p>
              <p>If you believe this is a false alarm, please contact your system administrator.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get severity color for Slack
   */
  private getSeverityColor(severity: string): string {
    const colors = {
      low: 'good',
      medium: 'warning',
      high: 'danger',
      critical: 'danger'
    };
    return colors[severity] || 'warning';
  }

  /**
   * Map severity to PagerDuty severity
   */
  private mapSeverityToPagerDuty(severity: string): 'critical' | 'error' | 'warning' | 'info' {
    const mapping = {
      low: 'info' as const,
      medium: 'warning' as const,
      high: 'error' as const,
      critical: 'critical' as const
    };
    return mapping[severity] || 'warning';
  }
}

export default new AlertNotificationService();