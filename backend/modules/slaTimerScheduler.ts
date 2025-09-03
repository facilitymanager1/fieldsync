// SLA Timer Scheduler using Redis and Bull Queue
// Handles scheduling and management of SLA-related timers
import { Queue, Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { SlaTracker, AdvancedSlaTemplate } from '../models/advancedSla';

export interface SlaTimerJob {
  type: 'response-deadline' | 'resolution-deadline' | 'escalation-trigger' | 'predictive-alert';
  trackerId: string;
  escalationRuleId?: string;
  escalationLevel?: number;
  data?: any;
}

export class SlaTimerScheduler {
  private redis: Redis;
  private slaQueue: Queue;
  private worker: Worker;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    // Initialize Bull queue
    this.slaQueue = new Queue('sla-timers', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Initialize worker
    this.worker = new Worker('sla-timers', this.processJob.bind(this), {
      connection: this.redis,
      concurrency: 10,
    });

    this.setupEventHandlers();
  }

  /**
   * Schedule all SLA timers for a tracker
   */
  async scheduleSlaTimers(tracker: SlaTracker): Promise<void> {
    try {
      // Schedule response deadline timer
      await this.scheduleResponseDeadline(tracker);

      // Schedule resolution deadline timer
      await this.scheduleResolutionDeadline(tracker);

      // Schedule escalation timers
      await this.scheduleEscalationTimers(tracker);

      // Schedule predictive alerts
      await this.schedulePredictiveAlerts(tracker);

      console.log(`SLA timers scheduled for tracker ${tracker.id}`);
    } catch (error) {
      console.error(`Error scheduling SLA timers for tracker ${tracker.id}:`, error);
      throw error;
    }
  }

  /**
   * Schedule response deadline timer
   */
  private async scheduleResponseDeadline(tracker: SlaTracker): Promise<void> {
    const delay = this.calculateDelay(tracker.responseDeadline);
    
    if (delay > 0) {
      await this.slaQueue.add(
        'response-deadline',
        {
          type: 'response-deadline',
          trackerId: tracker.id,
        } as SlaTimerJob,
        {
          delay,
          jobId: `response-${tracker.id}`,
        }
      );
    }
  }

  /**
   * Schedule resolution deadline timer
   */
  private async scheduleResolutionDeadline(tracker: SlaTracker): Promise<void> {
    const delay = this.calculateDelay(tracker.resolutionDeadline);
    
    if (delay > 0) {
      await this.slaQueue.add(
        'resolution-deadline',
        {
          type: 'resolution-deadline',
          trackerId: tracker.id,
        } as SlaTimerJob,
        {
          delay,
          jobId: `resolution-${tracker.id}`,
        }
      );
    }
  }

  /**
   * Schedule escalation timers based on SLA template
   */
  private async scheduleEscalationTimers(tracker: SlaTracker): Promise<void> {
    // This would typically fetch the template from database
    // For now, using placeholder logic
    const escalationRules = await this.getEscalationRules(tracker.slaTemplateId);
    
    for (const rule of escalationRules) {
      const escalationTime = new Date(
        tracker.startTime.getTime() + rule.triggerAfterHours * 60 * 60 * 1000
      );
      
      const delay = this.calculateDelay(escalationTime);
      
      if (delay > 0) {
        await this.slaQueue.add(
          'escalation-trigger',
          {
            type: 'escalation-trigger',
            trackerId: tracker.id,
            escalationRuleId: rule.id,
            escalationLevel: rule.level,
          } as SlaTimerJob,
          {
            delay,
            jobId: `escalation-${tracker.id}-${rule.id}`,
          }
        );
      }
    }
  }

  /**
   * Schedule predictive alerts (warning before deadline)
   */
  private async schedulePredictiveAlerts(tracker: SlaTracker): Promise<void> {
    const warningMinutes = 30; // Alert 30 minutes before deadline
    
    // Response warning
    const responseWarningTime = new Date(
      tracker.responseDeadline.getTime() - warningMinutes * 60 * 1000
    );
    
    const responseDelay = this.calculateDelay(responseWarningTime);
    if (responseDelay > 0) {
      await this.slaQueue.add(
        'predictive-alert',
        {
          type: 'predictive-alert',
          trackerId: tracker.id,
          data: { alertType: 'response_warning', minutesToDeadline: warningMinutes },
        } as SlaTimerJob,
        {
          delay: responseDelay,
          jobId: `response-warning-${tracker.id}`,
        }
      );
    }

    // Resolution warning
    const resolutionWarningTime = new Date(
      tracker.resolutionDeadline.getTime() - warningMinutes * 60 * 1000
    );
    
    const resolutionDelay = this.calculateDelay(resolutionWarningTime);
    if (resolutionDelay > 0) {
      await this.slaQueue.add(
        'predictive-alert',
        {
          type: 'predictive-alert',
          trackerId: tracker.id,
          data: { alertType: 'resolution_warning', minutesToDeadline: warningMinutes },
        } as SlaTimerJob,
        {
          delay: resolutionDelay,
          jobId: `resolution-warning-${tracker.id}`,
        }
      );
    }
  }

  /**
   * Cancel all timers for a tracker
   */
  async cancelSlaTimers(trackerId: string): Promise<void> {
    try {
      const jobs = await this.slaQueue.getJobs(['delayed', 'waiting']);
      const relevantJobs = jobs.filter(job => 
        job.data.trackerId === trackerId
      );

      for (const job of relevantJobs) {
        await job.remove();
      }

      console.log(`Cancelled ${relevantJobs.length} timers for tracker ${trackerId}`);
    } catch (error) {
      console.error(`Error cancelling SLA timers for tracker ${trackerId}:`, error);
      throw error;
    }
  }

  /**
   * Pause timers by removing them and storing state
   */
  async pauseSlaTimers(trackerId: string, reason: string): Promise<void> {
    try {
      const jobs = await this.slaQueue.getJobs(['delayed', 'waiting']);
      const relevantJobs = jobs.filter(job => 
        job.data.trackerId === trackerId
      );

      // Store timer states before cancelling
      const timerStates = [];
      for (const job of relevantJobs) {
        timerStates.push({
          jobId: job.id,
          name: job.name,
          data: job.data,
          delay: job.opts.delay,
          remainingTime: (job.opts.delay || 0) - (Date.now() - job.timestamp)
        });
        
        await job.remove();
      }

      // Store pause state in Redis
      await this.redis.setex(
        `sla:paused:${trackerId}`,
        86400, // 24 hours TTL
        JSON.stringify({
          reason,
          pausedAt: new Date().toISOString(),
          timerStates
        })
      );

      console.log(`Paused ${relevantJobs.length} timers for tracker ${trackerId}`);
    } catch (error) {
      console.error(`Error pausing SLA timers for tracker ${trackerId}:`, error);
      throw error;
    }
  }

  /**
   * Resume timers with adjusted deadlines
   */
  async resumeSlaTimers(trackerId: string): Promise<void> {
    try {
      // Retrieve pause state
      const pauseStateJson = await this.redis.get(`sla:paused:${trackerId}`);
      if (!pauseStateJson) {
        console.warn(`No pause state found for tracker ${trackerId}`);
        return;
      }

      const pauseState = JSON.parse(pauseStateJson);
      const pausedDuration = Date.now() - new Date(pauseState.pausedAt).getTime();

      // Reschedule timers with adjusted delays
      for (const timerState of pauseState.timerStates) {
        const adjustedDelay = Math.max(0, timerState.remainingTime + pausedDuration);
        
        await this.slaQueue.add(
          timerState.name,
          timerState.data,
          {
            delay: adjustedDelay,
            jobId: timerState.jobId,
          }
        );
      }

      // Clean up pause state
      await this.redis.del(`sla:paused:${trackerId}`);

      console.log(`Resumed ${pauseState.timerStates.length} timers for tracker ${trackerId}`);
    } catch (error) {
      console.error(`Error resuming SLA timers for tracker ${trackerId}:`, error);
      throw error;
    }
  }

  /**
   * Process timer jobs
   */
  private async processJob(job: Job<SlaTimerJob>): Promise<void> {
    const { data } = job;
    
    try {
      switch (data.type) {
        case 'response-deadline':
          await this.handleResponseDeadline(data.trackerId);
          break;
          
        case 'resolution-deadline':
          await this.handleResolutionDeadline(data.trackerId);
          break;
          
        case 'escalation-trigger':
          await this.handleEscalationTrigger(data);
          break;
          
        case 'predictive-alert':
          await this.handlePredictiveAlert(data);
          break;
          
        default:
          console.warn(`Unknown SLA timer job type: ${data.type}`);
      }
    } catch (error) {
      console.error(`Error processing SLA timer job:`, error);
      throw error;
    }
  }

  /**
   * Handle response deadline reached
   */
  private async handleResponseDeadline(trackerId: string): Promise<void> {
    console.log(`Response deadline reached for tracker ${trackerId}`);
    
    // Import here to avoid circular dependency
    const { AdvancedSlaEngine } = await import('./advancedSlaEngine');
    const slaEngine = new AdvancedSlaEngine();
    
    // Trigger breach detection
    // This would be implemented in the SLA engine
    console.log(`Triggering response breach handling for tracker ${trackerId}`);
  }

  /**
   * Handle resolution deadline reached
   */
  private async handleResolutionDeadline(trackerId: string): Promise<void> {
    console.log(`Resolution deadline reached for tracker ${trackerId}`);
    
    // Import here to avoid circular dependency
    const { AdvancedSlaEngine } = await import('./advancedSlaEngine');
    const slaEngine = new AdvancedSlaEngine();
    
    // Trigger breach detection
    console.log(`Triggering resolution breach handling for tracker ${trackerId}`);
  }

  /**
   * Handle escalation trigger
   */
  private async handleEscalationTrigger(data: SlaTimerJob): Promise<void> {
    console.log(`Escalation triggered for tracker ${data.trackerId}, level ${data.escalationLevel}`);
    
    // Import here to avoid circular dependency
    const { AdvancedSlaEngine } = await import('./advancedSlaEngine');
    const slaEngine = new AdvancedSlaEngine();
    
    // Trigger escalation
    console.log(`Triggering escalation for tracker ${data.trackerId}`);
  }

  /**
   * Handle predictive alert
   */
  private async handlePredictiveAlert(data: SlaTimerJob): Promise<void> {
    console.log(`Predictive alert triggered for tracker ${data.trackerId}:`, data.data);
    
    // Import here to avoid circular dependency
    const { AdvancedSlaEngine } = await import('./advancedSlaEngine');
    const slaEngine = new AdvancedSlaEngine();
    
    // Trigger predictive alert handling
    console.log(`Sending predictive alert for tracker ${data.trackerId}`);
  }

  /**
   * Setup event handlers for queue monitoring
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`SLA timer job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`SLA timer job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('SLA timer worker error:', err);
    });

    this.slaQueue.on('error', (err) => {
      console.error('SLA timer queue error:', err);
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return {
      waiting: await this.slaQueue.getWaiting().then(jobs => jobs.length),
      active: await this.slaQueue.getActive().then(jobs => jobs.length),
      completed: await this.slaQueue.getCompleted().then(jobs => jobs.length),
      failed: await this.slaQueue.getFailed().then(jobs => jobs.length),
      delayed: await this.slaQueue.getDelayed().then(jobs => jobs.length),
    };
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanQueue(): Promise<void> {
    await this.slaQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // Keep 100 completed jobs for 24 hours
    await this.slaQueue.clean(24 * 60 * 60 * 1000, 50, 'failed'); // Keep 50 failed jobs for 24 hours
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.slaQueue.close();
    await this.redis.quit();
  }

  // Helper methods

  private calculateDelay(targetTime: Date): number {
    return Math.max(0, targetTime.getTime() - Date.now());
  }

  private async getEscalationRules(templateId: string): Promise<any[]> {
    // Placeholder - would fetch from database
    return [
      { id: '1', level: 1, triggerAfterHours: 2 },
      { id: '2', level: 2, triggerAfterHours: 4 },
      { id: '3', level: 3, triggerAfterHours: 8 },
    ];
  }
}
