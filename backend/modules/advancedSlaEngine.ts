// Advanced SLA Engine Core Service
// Real-time SLA monitoring, breach detection, and intelligent escalation
import { 
  AdvancedSlaTemplate, 
  SlaTracker, 
  SlaContext,
  EscalationRule,
  EscalationAction,
  EscalationEvent,
  SlaCondition,
  AdvancedSlaTemplateModel,
  SlaTrackerModel
} from '../models/advancedSla';
import { BusinessHoursCalculator } from './businessHoursCalculator';
import { SlaTimerScheduler } from './slaTimerScheduler';
import { NotificationService } from './notification';
import { MetricsCollector } from './metricsCollector';
import { PredictiveAnalytics } from './predictiveAnalytics';
import { WorkloadAnalyzer } from './workloadAnalyzer';
import { AuditLogger } from '../middleware/auditLogger';
import { Engine } from 'json-rules-engine';

export class AdvancedSlaEngine {
  private businessHoursCalc: BusinessHoursCalculator;
  private timerScheduler: SlaTimerScheduler;
  private notificationService: NotificationService;
  private metricsCollector: MetricsCollector;
  private predictiveAnalytics: PredictiveAnalytics;
  private workloadAnalyzer: WorkloadAnalyzer;
  private auditLogger: AuditLogger;
  
  constructor() {
    this.businessHoursCalc = new BusinessHoursCalculator();
    this.timerScheduler = new SlaTimerScheduler();
    this.notificationService = new NotificationService();
    this.metricsCollector = new MetricsCollector();
    this.predictiveAnalytics = new PredictiveAnalytics();
    this.workloadAnalyzer = new WorkloadAnalyzer();
    this.auditLogger = new AuditLogger();
  }

  // Core SLA Management Functions
  
  /**
   * Create SLA tracker for a new entity (ticket, leave request, etc.)
   */
  async createSlaTracker(
    entityId: string,
    entityType: string,
    context: SlaContext
  ): Promise<SlaTracker> {
    try {
      // Find matching SLA template
      const template = await this.findMatchingTemplate(entityType, context);
      if (!template) {
        throw new Error(`No SLA template found for ${entityType}`);
      }

      // Calculate deadlines using business hours
      const now = new Date();
      const responseDeadline = template.responseTime.hours > 0 
        ? this.businessHoursCalc.addBusinessMinutes(now, template.responseTime.hours * 60, template.responseTime.businessHoursOnly)
        : now;
      
      const resolutionDeadline = template.resolutionTime.hours > 0
        ? this.businessHoursCalc.addBusinessMinutes(now, template.resolutionTime.hours * 60, template.resolutionTime.businessHoursOnly)
        : now;

      // Determine optimal assignee using workload analysis
      let assignedTo = context.assignedTo;
      if (!assignedTo && template.autoAssignment.enabled) {
        assignedTo = await this.findOptimalAssignee(template, context);
      }

      // Calculate initial risk score
      const riskScore = await this.predictiveAnalytics.calculateBreachRisk(
        context.priority || 'medium',
        template.responseTime.hours * 60,
        template.resolutionTime.hours * 60,
        assignedTo,
        context.department
      );

      // Create SLA tracker
      const tracker = new SlaTrackerModel({
        entityId,
        entityType,
        slaTemplateId: template.id,
        startTime: now,
        responseDeadline,
        resolutionDeadline,
        status: 'active',
        currentStage: 'awaiting_response',
        isBreached: false,
        escalationLevel: 0,
        escalationHistory: [],
        assignedTo,
        assignedAt: assignedTo ? now : undefined,
        assignmentHistory: assignedTo ? [{
          assignedTo,
          assignedAt: now,
          assignedBy: context.createdBy || 'system',
          reason: 'initial_assignment'
        }] : [],
        pausedDuration: 0,
        pauseReasons: [],
        createdAt: now,
        updatedAt: now,
      });

      await tracker.save();

      // Schedule timers for deadlines and escalations
      await this.timerScheduler.scheduleTimer(
        `response_${entityId}`,
        responseDeadline,
        { type: 'response_deadline', entityId, trackerId: tracker.id }
      );

      await this.timerScheduler.scheduleTimer(
        `resolution_${entityId}`,
        resolutionDeadline,
        { type: 'resolution_deadline', entityId, trackerId: tracker.id }
      );

      // Schedule first escalation
      await this.scheduleNextEscalation(tracker, template);

      // Update workload if assigned
      if (assignedTo) {
        await this.workloadAnalyzer.incrementTicketCount(assignedTo);
      }

      // Record metrics
      await this.metricsCollector.recordSlaStart(entityId, context.priority || 'medium');

      // Log audit event
      await this.auditLogger.log({
        entityType: 'sla',
        entityId: tracker.id,
        action: 'create',
        userId: context.createdBy || 'system',
        details: {
          entityId,
          entityType,
          templateId: template.id,
          responseDeadline,
          resolutionDeadline,
          assignedTo,
          riskScore,
        },
      });

      return tracker;
    } catch (error) {
      console.error('Error creating SLA tracker:', error);
      throw error;
    }
  }

  /**
   * Pause SLA tracking (e.g., waiting for customer response)
   */
  async pauseSlaTracker(
    trackerId: string,
    reason: string,
    category: 'waiting_for_client' | 'waiting_for_approval' | 'technical_issue' | 'other' = 'other',
    userId?: string
  ): Promise<boolean> {
    try {
      const tracker = await SlaTrackerModel.findById(trackerId);
      if (!tracker || tracker.status !== 'active') return false;

      const now = new Date();
      tracker.status = 'paused';
      
      // Add pause reason
      tracker.pauseReasons.push({
        pausedAt: now,
        reason,
        pausedBy: userId || 'system',
        category
      });

      tracker.updatedAt = now;
      await tracker.save();

      // Pause timers
      await this.timerScheduler.pauseTimer(`response_${tracker.entityId}`);
      await this.timerScheduler.pauseTimer(`resolution_${tracker.entityId}`);
      await this.timerScheduler.pauseTimer(`escalation_${tracker.entityId}`);

      // Record metrics
      await this.metricsCollector.recordSlaPause(tracker.entityId, reason);

      // Log audit event
      await this.auditLogger.log({
        entityType: 'sla',
        entityId: trackerId,
        action: 'pause',
        userId: userId || 'system',
        details: { reason, category, pausedAt: now },
      });

      return true;
    } catch (error) {
      console.error('Error pausing SLA tracker:', error);
      return false;
    }
  }

  /**
   * Resume SLA tracking
   */
  async resumeSlaTracker(
    trackerId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      const tracker = await SlaTrackerModel.findById(trackerId);
      if (!tracker || tracker.status !== 'paused') return false;

      const now = new Date();
      
      // Find the most recent pause reason and mark it as resumed
      const lastPauseIndex = tracker.pauseReasons.length - 1;
      if (lastPauseIndex >= 0 && !tracker.pauseReasons[lastPauseIndex].resumedAt) {
        tracker.pauseReasons[lastPauseIndex].resumedAt = now;
        
        // Calculate pause duration
        const pauseDuration = now.getTime() - tracker.pauseReasons[lastPauseIndex].pausedAt.getTime();
        tracker.pausedDuration += Math.floor(pauseDuration / (1000 * 60)); // Add minutes
        
        // Extend deadlines by pause duration
        tracker.responseDeadline = new Date(tracker.responseDeadline.getTime() + pauseDuration);
        tracker.resolutionDeadline = new Date(tracker.resolutionDeadline.getTime() + pauseDuration);
      }

      tracker.status = 'active';
      tracker.updatedAt = now;
      await tracker.save();

      // Resume timers with updated deadlines
      await this.timerScheduler.resumeTimer(`response_${tracker.entityId}`, tracker.responseDeadline);
      await this.timerScheduler.resumeTimer(`resolution_${tracker.entityId}`, tracker.resolutionDeadline);

      // Record metrics
      await this.metricsCollector.recordSlaResume(tracker.entityId);

      // Log audit event
      await this.auditLogger.log({
        entityType: 'sla',
        entityId: trackerId,
        action: 'resume',
        userId: userId || 'system',
        details: { resumedAt: now, pauseDuration: tracker.pausedDuration },
      });

      return true;
    } catch (error) {
      console.error('Error resuming SLA tracker:', error);
      return false;
    }
  }

  /**
   * Complete SLA tracking (e.g., ticket resolved)
   */
  async completeSlaTracker(
    trackerId: string,
    completionType: 'response' | 'resolution' | 'both',
    userId?: string
  ): Promise<boolean> {
    try {
      const tracker = await SlaTrackerModel.findById(trackerId);
      if (!tracker) return false;

      const now = new Date();
      const template = await AdvancedSlaTemplateModel.findOne({ id: tracker.slaTemplateId });

      // Calculate actual times
      if (completionType === 'response' || completionType === 'both') {
        tracker.responseTime = now;
        tracker.actualResponseHours = this.businessHoursCalc.getBusinessMinutesBetween(
          tracker.startTime,
          now,
          template?.responseTime.businessHoursOnly || false
        ) / 60;
      }

      if (completionType === 'resolution' || completionType === 'both') {
        tracker.resolutionTime = now;
        tracker.actualResolutionHours = this.businessHoursCalc.getBusinessMinutesBetween(
          tracker.startTime,
          now,
          template?.resolutionTime.businessHoursOnly || false
        ) / 60;
        tracker.status = 'resolved';
        tracker.currentStage = 'resolved';
      }

      tracker.updatedAt = now;
      await tracker.save();

      // Cancel remaining timers
      await this.timerScheduler.cancelTimer(`response_${tracker.entityId}`);
      await this.timerScheduler.cancelTimer(`resolution_${tracker.entityId}`);
      await this.timerScheduler.cancelTimer(`escalation_${tracker.entityId}`);

      // Update workload
      if (tracker.assignedTo) {
        await this.workloadAnalyzer.decrementTicketCount(tracker.assignedTo);
        
        // Update user's average resolution time
        if (tracker.actualResolutionHours && tracker.actualResolutionHours > 0) {
          const currentWorkload = await this.workloadAnalyzer.getCurrentWorkload(tracker.assignedTo);
          const newAverage = (currentWorkload.averageResolutionTime + tracker.actualResolutionHours) / 2;
          await this.workloadAnalyzer.updateWorkload(tracker.assignedTo, {
            averageResolutionTime: newAverage
          });
        }
      }

      // Record metrics
      const responseCompliant = !tracker.responseTime || tracker.responseTime <= tracker.responseDeadline;
      const resolutionCompliant = !tracker.resolutionTime || tracker.resolutionTime <= tracker.resolutionDeadline;
      
      await this.metricsCollector.recordSlaCompletion(
        tracker.entityId,
        responseCompliant,
        resolutionCompliant,
        tracker.actualResolutionHours || 0
      );

      // Log audit event
      await this.auditLogger.log({
        entityType: 'sla',
        entityId: trackerId,
        action: 'complete',
        userId: userId || 'system',
        details: {
          completionType,
          responseTime: tracker.actualResponseHours,
          resolutionTime: tracker.actualResolutionHours,
          responseCompliant,
          resolutionCompliant,
        },
      });

      return true;
    } catch (error) {
      console.error('Error completing SLA tracker:', error);
      return false;
    }
  }

  // Helper Methods

  private async findMatchingTemplate(
    entityType: string,
    context: SlaContext
  ): Promise<AdvancedSlaTemplate | null> {
    try {
      // Simple template matching - can be enhanced with complex rule engine
      const templates = await AdvancedSlaTemplateModel.find({
        category: entityType,
        isActive: true,
        effectiveFrom: { $lte: new Date() },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: { $gte: new Date() } }
        ]
      });

      if (templates.length === 0) return null;

      // Apply condition matching using simple logic for now
      for (const template of templates) {
        if (this.matchesConditions(template.conditions, context)) {
          return template;
        }
      }

      // Return first template if no specific conditions match
      return templates[0];
    } catch (error) {
      console.error('Error finding matching template:', error);
      return null;
    }
  }

  private matchesConditions(conditions: SlaCondition[], context: SlaContext): boolean {
    if (!conditions || conditions.length === 0) return true;

    // Simple condition matching - can be enhanced with JSON rules engine
    return conditions.every(condition => {
      const contextValue = (context as any)[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return contextValue === condition.value;
        case 'contains':
          return typeof contextValue === 'string' && contextValue.includes(condition.value);
        case 'greater_than':
          return contextValue > condition.value;
        case 'less_than':
          return contextValue < condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(contextValue);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(contextValue);
        default:
          return true;
      }
    });
  }

  private async findOptimalAssignee(
    template: AdvancedSlaTemplate,
    context: SlaContext
  ): Promise<string | null> {
    try {
      const availableUsers = await this.workloadAnalyzer.getAvailableUsers(60);
      if (availableUsers.length === 0) return null;

      // Apply auto-assignment rules
      for (const rule of template.autoAssignment.rules) {
        if (this.matchesConditions(rule.conditions, context)) {
          
          switch (rule.assignmentType) {
            case 'round_robin':
              return this.getNextRoundRobinAssignee(rule.targetPool, availableUsers);
              
            case 'skill_based':
              return await this.getSkillBasedAssignee(rule.targetPool, availableUsers, context);
              
            case 'workload_based':
              return await this.getWorkloadBasedAssignee(rule.targetPool, availableUsers);
              
            case 'location_based':
              return this.getLocationBasedAssignee(rule.targetPool, availableUsers, context);
              
            default:
              return availableUsers[0];
          }
        }
      }

      return availableUsers[0];
    } catch (error) {
      console.error('Error finding optimal assignee:', error);
      return null;
    }
  }

  private getNextRoundRobinAssignee(targetPool: string[], availableUsers: string[]): string | null {
    const intersection = targetPool.filter(user => availableUsers.includes(user));
    if (intersection.length === 0) return availableUsers[0];
    
    // Simple round-robin implementation - can be enhanced with persistent state
    const randomIndex = Math.floor(Math.random() * intersection.length);
    return intersection[randomIndex];
  }

  private async getSkillBasedAssignee(
    targetPool: string[], 
    availableUsers: string[], 
    context: SlaContext
  ): Promise<string | null> {
    const intersection = targetPool.filter(user => availableUsers.includes(user));
    if (intersection.length === 0) return availableUsers[0];

    const requiredSkills = context.requiredSkills || [];
    let bestMatch = '';
    let bestScore = 0;

    for (const userId of intersection) {
      const skillMatch = await this.workloadAnalyzer.getSkillMatch(userId, requiredSkills);
      if (skillMatch > bestScore) {
        bestScore = skillMatch;
        bestMatch = userId;
      }
    }

    return bestMatch || intersection[0];
  }

  private async getWorkloadBasedAssignee(targetPool: string[], availableUsers: string[]): Promise<string | null> {
    const intersection = targetPool.filter(user => availableUsers.includes(user));
    if (intersection.length === 0) return availableUsers[0];

    let bestUser = '';
    let lowestWorkload = 100;

    for (const userId of intersection) {
      const workload = await this.workloadAnalyzer.getCurrentWorkload(userId);
      if (workload.currentCapacity < lowestWorkload) {
        lowestWorkload = workload.currentCapacity;
        bestUser = userId;
      }
    }

    return bestUser || intersection[0];
  }

  private getLocationBasedAssignee(
    targetPool: string[], 
    availableUsers: string[], 
    context: SlaContext
  ): string | null {
    const intersection = targetPool.filter(user => availableUsers.includes(user));
    if (intersection.length === 0) return availableUsers[0];

    // Simple location-based assignment - can be enhanced with actual location matching
    return intersection[0];
  }

  /**
   * Create SLA tracker with enhanced context
   */
  async createAdvancedSlaTracker(
    entityId: string,
    entityType: string,
    context: SlaContext
  ): Promise<SlaTracker | null> {
    try {
      // Find matching SLA template
      const template = await this.matchSlaTemplate(entityType, context);
      if (!template) {
        console.warn(`No SLA template found for ${entityType} with context:`, context);
        return null;
      }

      // Calculate deadlines
      const startTime = new Date();
      const responseDeadline = this.businessHoursCalc.calculateBusinessHours(
        startTime,
        template.responseTime.hours,
        template.responseTime.businessHoursOnly,
        template.responseTime.excludeWeekends,
        template.responseTime.excludeHolidays
      );
      
      const resolutionDeadline = this.businessHoursCalc.calculateBusinessHours(
        startTime,
        template.resolutionTime.hours,
        template.resolutionTime.businessHoursOnly,
        template.resolutionTime.excludeWeekends,
        template.resolutionTime.excludeHolidays
      );

      // Create tracker
      const tracker: SlaTracker = {
        id: this.generateId(),
        entityId,
        entityType,
        slaTemplateId: template.id,
        startTime,
        responseDeadline,
        resolutionDeadline,
        status: 'active',
        currentStage: 'awaiting_response',
        isBreached: false,
        escalationLevel: 0,
        escalationHistory: [],
        assignmentHistory: [],
        pausedDuration: 0,
        pauseReasons: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      const savedTracker = await SlaTrackerModel.create(tracker);

      // Schedule timers
      await this.timerScheduler.scheduleSlaTimers(savedTracker.toObject());

      // Auto-assignment if configured
      if (template.autoAssignment.enabled) {
        await this.performAutoAssignment(savedTracker.toObject(), template);
      }

      // Record metrics
      await this.metricsCollector.recordSlaCreated(savedTracker.toObject());

      // Audit log
      await this.auditLogger.log({
        entityId,
        entityType,
        action: 'SLA_TRACKER_CREATED',
        details: {
          slaTemplateId: template.id,
          responseDeadline,
          resolutionDeadline
        }
      });

      return savedTracker.toObject();
    } catch (error) {
      console.error('Error creating SLA tracker:', error);
      throw error;
    }
  }

  /**
   * Update SLA tracker when entity status changes
   */
  async updateSlaTracker(
    entityId: string,
    entityType: string,
    updates: Partial<SlaTracker>
  ): Promise<SlaTracker | null> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker) {
        console.warn(`SLA tracker not found for ${entityType}:${entityId}`);
        return null;
      }

      // Handle status transitions
      if (updates.currentStage && updates.currentStage !== tracker.currentStage) {
        await this.handleStageTransition(tracker, updates.currentStage);
      }

      // Update tracker
      Object.assign(tracker, updates, { updatedAt: new Date() });
      const updatedTracker = await tracker.save();

      // Record metrics
      await this.metricsCollector.recordSlaUpdate(updatedTracker.toObject(), updates);

      return updatedTracker.toObject();
    } catch (error) {
      console.error('Error updating SLA tracker:', error);
      throw error;
    }
  }

  /**
   * Mark SLA as resolved
   */
  async resolveSla(
    entityId: string,
    entityType: string,
    resolutionTime?: Date
  ): Promise<void> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker) return;

      const resolvedAt = resolutionTime || new Date();
      
      // Calculate actual resolution time
      const actualResolutionHours = this.businessHoursCalc.calculateBusinessHoursBetween(
        tracker.startTime,
        resolvedAt,
        true, // Exclude weekends
        true  // Exclude holidays
      );

      // Update tracker
      tracker.status = 'resolved';
      tracker.resolutionTime = resolvedAt;
      tracker.actualResolutionHours = actualResolutionHours;
      tracker.updatedAt = new Date();

      await tracker.save();

      // Cancel pending timers
      await this.timerScheduler.cancelSlaTimers(tracker.id);

      // Record final metrics
      await this.metricsCollector.recordSlaResolved(tracker.toObject());

      // Send resolution notifications
      await this.sendResolutionNotifications(tracker.toObject());

      // Audit log
      await this.auditLogger.log({
        entityId,
        entityType,
        action: 'SLA_RESOLVED',
        details: {
          actualResolutionHours,
          isBreached: tracker.isBreached,
          escalationLevel: tracker.escalationLevel
        }
      });
    } catch (error) {
      console.error('Error resolving SLA:', error);
      throw error;
    }
  }

  /**
   * Pause SLA tracking (e.g., waiting for client response)
   */
  async pauseSla(
    entityId: string,
    entityType: string,
    reason: string,
    category: string,
    pausedBy: string
  ): Promise<void> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker || tracker.status !== 'active') return;

      // Update tracker status
      tracker.status = 'paused';
      tracker.pauseReasons.push({
        pausedAt: new Date(),
        reason,
        pausedBy,
        category: category as any
      });
      tracker.updatedAt = new Date();

      await tracker.save();

      // Pause timers
      await this.timerScheduler.pauseSlaTimers(tracker.id, reason);

      // Audit log
      await this.auditLogger.log({
        entityId,
        entityType,
        action: 'SLA_PAUSED',
        details: { reason, category, pausedBy }
      });
    } catch (error) {
      console.error('Error pausing SLA:', error);
      throw error;
    }
  }

  /**
   * Resume SLA tracking
   */
  async resumeSla(
    entityId: string,
    entityType: string,
    resumedBy: string
  ): Promise<void> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker || tracker.status !== 'paused') return;

      // Update last pause reason
      const lastPause = tracker.pauseReasons[tracker.pauseReasons.length - 1];
      if (lastPause && !lastPause.resumedAt) {
        lastPause.resumedAt = new Date();
        
        // Calculate paused duration
        const pauseDuration = lastPause.resumedAt.getTime() - lastPause.pausedAt.getTime();
        tracker.pausedDuration += Math.floor(pauseDuration / (1000 * 60)); // Convert to minutes
      }

      // Update tracker status
      tracker.status = 'active';
      tracker.updatedAt = new Date();

      await tracker.save();

      // Resume timers with adjusted deadlines
      await this.timerScheduler.resumeSlaTimers(tracker.id);

      // Audit log
      await this.auditLogger.log({
        entityId,
        entityType,
        action: 'SLA_RESUMED',
        details: { resumedBy, totalPausedMinutes: tracker.pausedDuration }
      });
    } catch (error) {
      console.error('Error resuming SLA:', error);
      throw error;
    }
  }

  // Private Helper Methods

  /**
   * Find matching SLA template based on entity type and context
   */
  private async matchSlaTemplate(
    entityType: string,
    context: SlaContext
  ): Promise<AdvancedSlaTemplate | null> {
    try {
      // Get all active templates for this entity type
      const templates = await AdvancedSlaTemplateModel.find({
        category: this.mapEntityTypeToCategory(entityType),
        isActive: true,
        effectiveFrom: { $lte: new Date() },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: { $gte: new Date() } }
        ]
      }).sort({ priority: -1, version: -1 });

      // Evaluate conditions for each template
      for (const template of templates) {
        if (await this.evaluateConditions(template.conditions, context)) {
          return template.toObject();
        }
      }

      // Fallback to default template
      return await this.getDefaultTemplate(entityType);
    } catch (error) {
      console.error('Error matching SLA template:', error);
      return null;
    }
  }

  /**
   * Evaluate SLA conditions against context
   */
  private async evaluateConditions(
    conditions: SlaCondition[],
    context: SlaContext
  ): Promise<boolean> {
    if (!conditions || conditions.length === 0) return true;

    try {
      const engine = new Engine();
      
      // Convert conditions to rules engine format
      const facts = context;
      
      for (const condition of conditions) {
        const rule = {
          conditions: {
            [condition.field]: {
              [condition.operator]: condition.value
            }
          },
          event: {
            type: 'condition_match',
            params: condition
          }
        };
        
        engine.addRule(rule);
      }

      const results = await engine.run(facts);
      return results.events.length > 0;
    } catch (error) {
      console.error('Error evaluating SLA conditions:', error);
      return false;
    }
  }

  /**
   * Handle stage transitions (e.g., from awaiting_response to in_progress)
   */
  private async handleStageTransition(
    tracker: SlaTracker,
    newStage: string
  ): Promise<void> {
    const oldStage = tracker.currentStage;
    
    // Record response time if transitioning from awaiting_response
    if (oldStage === 'awaiting_response' && newStage === 'in_progress' && !tracker.responseTime) {
      const responseTime = new Date();
      const actualResponseHours = this.businessHoursCalc.calculateBusinessHoursBetween(
        tracker.startTime,
        responseTime,
        true, // Exclude weekends
        true  // Exclude holidays
      );

      tracker.responseTime = responseTime;
      tracker.actualResponseHours = actualResponseHours;

      // Check if response was within SLA
      if (responseTime <= tracker.responseDeadline) {
        await this.metricsCollector.recordResponseSlaCompliance(tracker, true);
      } else {
        await this.handleResponseBreach(tracker);
      }
    }

    // Record stage change
    await this.auditLogger.log({
      entityId: tracker.entityId,
      entityType: tracker.entityType,
      action: 'SLA_STAGE_TRANSITION',
      details: {
        oldStage,
        newStage,
        responseTime: tracker.responseTime,
        actualResponseHours: tracker.actualResponseHours
      }
    });
  }

  /**
   * Handle response deadline breach
   */
  private async handleResponseBreach(tracker: SlaTracker): Promise<void> {
    tracker.isBreached = true;
    tracker.breachType = 'response';
    tracker.breachTime = new Date();
    tracker.breachReason = 'Response deadline exceeded';

    await this.metricsCollector.recordResponseSlaCompliance(tracker, false);
    await this.triggerEscalation(tracker, 'breach');
  }

  /**
   * Trigger escalation workflow
   */
  private async triggerEscalation(
    tracker: SlaTracker,
    trigger: 'breach' | 'predictive' | 'manual'
  ): Promise<void> {
    try {
      const template = await AdvancedSlaTemplateModel.findById(tracker.slaTemplateId);
      if (!template) return;

      const nextLevel = tracker.escalationLevel + 1;
      const escalationRule = template.escalationRules.find(rule => rule.level === nextLevel);
      
      if (!escalationRule) {
        // Max escalation reached
        await this.handleMaxEscalation(tracker, template.toObject());
        return;
      }

      // Create escalation event
      const escalationEvent: EscalationEvent = {
        id: this.generateId(),
        level: nextLevel,
        triggeredAt: new Date(),
        triggeredBy: 'system',
        reason: this.getEscalationReason(trigger, tracker),
        actions: escalationRule.actions,
        notificationsSent: []
      };

      // Execute escalation actions
      for (const action of escalationRule.actions) {
        await this.executeEscalationAction(tracker, action, escalationEvent);
      }

      // Update tracker
      tracker.escalationLevel = nextLevel;
      tracker.escalationHistory.push(escalationEvent);

      await SlaTrackerModel.findByIdAndUpdate(tracker.id, tracker);

      // Schedule next escalation if exists
      const nextRule = template.escalationRules.find(rule => rule.level === nextLevel + 1);
      if (nextRule) {
        await this.scheduleNextEscalation(tracker, nextRule);
      }
    } catch (error) {
      console.error('Error triggering escalation:', error);
    }
  }

  /**
   * Execute specific escalation action
   */
  private async executeEscalationAction(
    tracker: SlaTracker,
    action: EscalationAction,
    escalationEvent: EscalationEvent
  ): Promise<void> {
    switch (action.type) {
      case 'notify':
        await this.sendEscalationNotifications(tracker, action, escalationEvent);
        break;
        
      case 'reassign':
        await this.performReassignment(tracker, action);
        break;
        
      case 'escalate':
        await this.escalateToSupervisor(tracker, action);
        break;
        
      case 'auto_resolve':
        await this.performAutoResolution(tracker, action);
        break;
        
      case 'create_ticket':
        await this.createEscalationTicket(tracker, action);
        break;
    }
  }

  /**
   * Perform intelligent auto-assignment
   */
  private async performAutoAssignment(
    tracker: SlaTracker,
    template: AdvancedSlaTemplate
  ): Promise<void> {
    try {
      const assignmentRules = template.autoAssignment.rules;
      
      for (const rule of assignmentRules) {
        // Check if rule conditions match
        const context = await this.buildAssignmentContext(tracker);
        const matches = await this.evaluateConditions(rule.conditions, context);
        
        if (matches) {
          const assignee = await this.selectBestAssignee(rule, tracker);
          if (assignee) {
            await this.assignEntity(tracker, assignee, 'auto_assignment');
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-assignment:', error);
    }
  }

  /**
   * Select best assignee based on workload, skills, and availability
   */
  private async selectBestAssignee(
    rule: any,
    tracker: SlaTracker
  ): Promise<string | null> {
    try {
      const availableUsers = await this.getAvailableUsers(rule.targetPool);
      if (availableUsers.length === 0) return null;

      const scores = await Promise.all(
        availableUsers.map(async (user) => {
          const workload = await this.workloadAnalyzer.getCurrentWorkload(user.id);
          const skillScore = await this.calculateSkillMatch(user.id, tracker);
          const availabilityScore = user.isOnline ? 100 : 50;
          const performanceScore = user.averageSlaCompliance || 75;

          const totalScore = 
            (workload.score * 0.3) +
            (skillScore * 0.25) +
            (availabilityScore * 0.25) +
            (performanceScore * 0.2);

          return {
            userId: user.id,
            score: totalScore,
            details: { workload, skillScore, availabilityScore, performanceScore }
          };
        })
      );

      // Sort by score and return best candidate
      scores.sort((a, b) => b.score - a.score);
      return scores[0].userId;
    } catch (error) {
      console.error('Error selecting assignee:', error);
      return null;
    }
  }

  // Utility Methods

  private mapEntityTypeToCategory(entityType: string): string {
    const mapping: Record<string, string> = {
      'ticket': 'ticket',
      'service_request': 'service_request',
      'leave_request': 'leave',
      'meeting': 'meeting',
      'work_order': 'work_order'
    };
    
    return mapping[entityType] || 'ticket';
  }

  private getEscalationReason(trigger: string, tracker: SlaTracker): string {
    switch (trigger) {
      case 'breach':
        return `SLA breach detected for ${tracker.entityType} ${tracker.entityId}`;
      case 'predictive':
        return `High risk of SLA breach predicted for ${tracker.entityType} ${tracker.entityId}`;
      case 'manual':
        return `Manual escalation triggered for ${tracker.entityType} ${tracker.entityId}`;
      default:
        return `Escalation triggered for ${tracker.entityType} ${tracker.entityId}`;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Placeholder methods for future implementation
  private async getDefaultTemplate(entityType: string): Promise<AdvancedSlaTemplate | null> {
    // TODO: Implement default template logic
    return null;
  }

  private async handleMaxEscalation(tracker: SlaTracker, template: AdvancedSlaTemplate): Promise<void> {
    // TODO: Implement max escalation handling
  }

  private async scheduleNextEscalation(tracker: SlaTracker, rule: EscalationRule): Promise<void> {
    // TODO: Implement next escalation scheduling
  }

  private async sendEscalationNotifications(
    tracker: SlaTracker, 
    action: EscalationAction, 
    escalationEvent: EscalationEvent
  ): Promise<void> {
    // TODO: Implement escalation notifications
  }

  private async performReassignment(tracker: SlaTracker, action: EscalationAction): Promise<void> {
    // TODO: Implement reassignment logic
  }

  private async escalateToSupervisor(tracker: SlaTracker, action: EscalationAction): Promise<void> {
    // TODO: Implement supervisor escalation
  }

  private async performAutoResolution(tracker: SlaTracker, action: EscalationAction): Promise<void> {
    // TODO: Implement auto-resolution logic
  }

  private async createEscalationTicket(tracker: SlaTracker, action: EscalationAction): Promise<void> {
    // TODO: Implement escalation ticket creation
  }

  private async buildAssignmentContext(tracker: SlaTracker): Promise<SlaContext> {
    // TODO: Build context for assignment rules
    return {};
  }

  private async getAvailableUsers(targetPool: string[]): Promise<any[]> {
    // TODO: Get available users from target pool
    return [];
  }

  private async calculateSkillMatch(userId: string, tracker: SlaTracker): Promise<number> {
    // TODO: Calculate skill match score
    return 75;
  }

  private async assignEntity(tracker: SlaTracker, assignee: string, reason: string): Promise<void> {
    // TODO: Assign entity to user
  }

  private async sendResolutionNotifications(tracker: SlaTracker): Promise<void> {
    // TODO: Send resolution notifications
  }
}

export default AdvancedSlaEngine;
