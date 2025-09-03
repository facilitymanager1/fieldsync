/**
 * SLA System Type Definitions
 */

export interface BusinessHoursCalculator {
  addMinutes(date: Date, minutes: number, businessHoursOnly?: boolean): Date;
  getMinutesBetween(startDate: Date, endDate: Date, businessHoursOnly?: boolean): number;
  isBusinessHour(date: Date): boolean;
  getNextBusinessDay(date: Date): Date;
}

export interface SlaTimerScheduler {
  scheduleSlaTimers(tracker: SlaTracker): Promise<void>;
  cancelTimer(timerId: string): Promise<void>;
  pauseAllTimers(entityId: string): Promise<void>;
  resumeAllTimers(entityId: string): Promise<void>;
}

export interface MetricsCollector {
  recordSlaUpdate(tracker: SlaTracker, updates?: Partial<SlaTracker>): Promise<void>;
  recordSlaResolved(tracker: SlaTracker): Promise<void>;
  recordSlaViolation(tracker: SlaTracker, violationType: string): Promise<void>;
  getSlaMetrics(entityId: string): Promise<SlaMetrics>;
}

export interface SlaTracker {
  id: string;
  entityId: string;
  entityType: string;
  templateId: string;
  status: 'active' | 'paused' | 'resolved' | 'violated' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
  responseDeadline?: Date;
  resolutionDeadline?: Date;
  actualResponseHours?: number;
  actualResolutionHours?: number;
  escalationLevel: number;
  violations: SlaViolation[];
}

export interface SlaMetrics {
  totalTickets: number;
  resolvedWithinSla: number;
  violatedSla: number;
  averageResponseTime: number;
  averageResolutionTime: number;
}

export interface SlaViolation {
  type: 'response' | 'resolution' | 'escalation';
  violatedAt: Date;
  targetTime: Date;
  actualTime: Date;
  severity: 'minor' | 'major' | 'critical';
}

export interface EscalationRule {
  level: number;
  triggerAfterHours: number;
  triggerConditions: Record<string, any>;
  actions: EscalationAction[];
}

export interface EscalationAction {
  type: 'email' | 'sms' | 'ticket_update' | 'reassign';
  target: string;
  template: string;
  delay?: number;
}