import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from './apiService';
import OfflineService from './offlineService';

export interface AnalyticsEvent {
  id: string;
  eventType: string;
  eventName: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  properties: Record<string, any>;
  metadata: {
    appVersion: string;
    platform: string;
    deviceId: string;
    networkType: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}

export interface OnboardingMetrics {
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  timeSpent: number; // in seconds
  validationErrors: number;
  retryAttempts: number;
  completionPercentage: number;
  stepTimings: Record<string, number>;
  dropoffStep?: string;
  completedAt?: Date;
}

export interface UserEngagementMetrics {
  sessionDuration: number;
  screenViews: Record<string, number>;
  interactions: Record<string, number>;
  formCompletions: Record<string, number>;
  errorEncounters: Record<string, number>;
  featureUsage: Record<string, number>;
  lastActiveDate: Date;
  totalSessions: number;
}

export interface PerformanceMetrics {
  appStartTime: number;
  screenLoadTimes: Record<string, number>;
  apiResponseTimes: Record<string, number>;
  syncDuration: number;
  offlineEvents: number;
  crashCount: number;
  memoryUsage: Record<string, number>;
  networkErrors: Record<string, number>;
}

export interface ComplianceMetrics {
  documentsUploaded: Record<string, number>;
  verificationsCompleted: Record<string, number>;
  complianceSteps: Record<string, 'completed' | 'pending' | 'failed'>;
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    userId: string;
    details: Record<string, any>;
  }>;
}

export interface AnalyticsReport {
  id: string;
  reportType: 'onboarding' | 'engagement' | 'performance' | 'compliance' | 'custom';
  title: string;
  description: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  data: any;
  charts: Array<{
    type: 'line' | 'bar' | 'pie' | 'area' | 'gauge';
    title: string;
    data: any;
    config: Record<string, any>;
  }>;
  summary: Record<string, any>;
  generatedAt: Date;
}

export interface AnalyticsConfig {
  enableTracking: boolean;
  enableCrashReporting: boolean;
  enablePerformanceTracking: boolean;
  enableUserTracking: boolean;
  batchSize: number;
  uploadInterval: number; // in milliseconds
  retentionDays: number;
  enableDebugMode: boolean;
  excludeEvents: string[];
  customProperties: Record<string, any>;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private sessionId: string = '';
  private userId?: string;
  private eventQueue: AnalyticsEvent[] = [];
  private config: AnalyticsConfig = {
    enableTracking: true,
    enableCrashReporting: true,
    enablePerformanceTracking: true,
    enableUserTracking: true,
    batchSize: 50,
    uploadInterval: 60000, // 1 minute
    retentionDays: 90,
    enableDebugMode: __DEV__,
    excludeEvents: [],
    customProperties: {}
  };
  private uploadTimer?: NodeJS.Timeout;
  private sessionStartTime: Date = new Date();

  private constructor() {
    this.initializeSession();
    this.startPeriodicUpload();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private initializeSession() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStartTime = new Date();
    
    this.trackEvent('session_start', {
      sessionId: this.sessionId,
      timestamp: this.sessionStartTime
    });
  }

  private startPeriodicUpload() {
    this.uploadTimer = setInterval(() => {
      this.uploadEvents();
    }, this.config.uploadInterval);
  }

  // Core Analytics Methods

  setUserId(userId: string) {
    this.userId = userId;
    this.trackEvent('user_identified', { userId });
  }

  trackEvent(eventName: string, properties: Record<string, any> = {}) {
    if (!this.config.enableTracking || this.config.excludeEvents.includes(eventName)) {
      return;
    }

    const event: AnalyticsEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: this.getEventType(eventName),
      eventName,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      properties: {
        ...this.config.customProperties,
        ...properties
      },
      metadata: this.getEventMetadata()
    };

    this.eventQueue.push(event);

    if (this.config.enableDebugMode) {
      console.log('Analytics Event:', event);
    }

    // Store locally for offline scenarios
    this.storeEventLocally(event);

    // Upload if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.uploadEvents();
    }
  }

  private getEventType(eventName: string): string {
    if (eventName.includes('screen_')) return 'navigation';
    if (eventName.includes('form_')) return 'form';
    if (eventName.includes('button_')) return 'interaction';
    if (eventName.includes('error_')) return 'error';
    if (eventName.includes('performance_')) return 'performance';
    return 'custom';
  }

  private getEventMetadata() {
    return {
      appVersion: '1.0.0', // Should come from app config
      platform: 'react-native',
      deviceId: this.getDeviceId(),
      networkType: this.getNetworkType(),
      location: this.getCurrentLocation()
    };
  }

  private getDeviceId(): string {
    // In production, use a proper device ID library
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }

  private getNetworkType(): string {
    return OfflineService.isDeviceOnline() ? 'online' : 'offline';
  }

  private getCurrentLocation() {
    // In production, integrate with location services
    return undefined;
  }

  // Onboarding Analytics

  startOnboardingTracking(userId: string) {
    this.setUserId(userId);
    
    const metrics: OnboardingMetrics = {
      totalSteps: 8, // Based on your onboarding flow
      completedSteps: 0,
      currentStep: 'basic_details',
      timeSpent: 0,
      validationErrors: 0,
      retryAttempts: 0,
      completionPercentage: 0,
      stepTimings: {}
    };

    this.storeOnboardingMetrics(userId, metrics);
    this.trackEvent('onboarding_started', { userId, totalSteps: metrics.totalSteps });
  }

  trackOnboardingStep(userId: string, stepName: string, stepData: Record<string, any>) {
    const metrics = this.getOnboardingMetrics(userId);
    if (!metrics) return;

    const stepStartTime = Date.now();
    const previousStep = metrics.currentStep;
    
    // Update metrics
    if (previousStep && previousStep !== stepName) {
      metrics.completedSteps++;
      metrics.stepTimings[previousStep] = stepStartTime - (metrics.stepTimings[previousStep] || Date.now());
    }
    
    metrics.currentStep = stepName;
    metrics.completionPercentage = (metrics.completedSteps / metrics.totalSteps) * 100;
    metrics.stepTimings[stepName] = stepStartTime;

    this.storeOnboardingMetrics(userId, metrics);
    
    this.trackEvent('onboarding_step_completed', {
      userId,
      stepName,
      completedSteps: metrics.completedSteps,
      completionPercentage: metrics.completionPercentage,
      stepData
    });
  }

  trackOnboardingError(userId: string, stepName: string, errorType: string, errorDetails: Record<string, any>) {
    const metrics = this.getOnboardingMetrics(userId);
    if (metrics) {
      metrics.validationErrors++;
      this.storeOnboardingMetrics(userId, metrics);
    }

    this.trackEvent('onboarding_error', {
      userId,
      stepName,
      errorType,
      errorDetails,
      totalErrors: metrics?.validationErrors || 1
    });
  }

  completeOnboarding(userId: string, finalData: Record<string, any>) {
    const metrics = this.getOnboardingMetrics(userId);
    if (!metrics) return;

    metrics.completedSteps = metrics.totalSteps;
    metrics.completionPercentage = 100;
    metrics.completedAt = new Date();
    metrics.timeSpent = Date.now() - this.sessionStartTime.getTime();

    this.storeOnboardingMetrics(userId, metrics);
    
    this.trackEvent('onboarding_completed', {
      userId,
      totalTimeSpent: metrics.timeSpent,
      validationErrors: metrics.validationErrors,
      retryAttempts: metrics.retryAttempts,
      stepTimings: metrics.stepTimings,
      finalData
    });
  }

  // Performance Analytics

  trackScreenLoad(screenName: string, loadTime: number) {
    if (!this.config.enablePerformanceTracking) return;

    this.trackEvent('screen_load', {
      screenName,
      loadTime,
      performance: {
        navigation: loadTime,
        render: loadTime
      }
    });
  }

  trackApiCall(endpoint: string, method: string, responseTime: number, success: boolean) {
    if (!this.config.enablePerformanceTracking) return;

    this.trackEvent('api_call', {
      endpoint,
      method,
      responseTime,
      success,
      performance: {
        network: responseTime
      }
    });
  }

  trackAppCrash(error: Error, errorInfo: Record<string, any>) {
    if (!this.config.enableCrashReporting) return;

    this.trackEvent('app_crash', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo,
      timestamp: new Date(),
      severity: 'critical'
    });

    // Immediately upload crash events
    this.uploadEvents();
  }

  // User Engagement Analytics

  trackUserInteraction(elementType: string, elementId: string, action: string, context: Record<string, any> = {}) {
    this.trackEvent('user_interaction', {
      elementType,
      elementId,
      action,
      context,
      sessionId: this.sessionId
    });
  }

  trackFormSubmission(formName: string, success: boolean, validationErrors: string[] = [], formData: Record<string, any> = {}) {
    this.trackEvent('form_submission', {
      formName,
      success,
      validationErrors,
      errorCount: validationErrors.length,
      formFields: Object.keys(formData),
      submissionTime: new Date()
    });
  }

  trackFeatureUsage(featureName: string, usage: Record<string, any>) {
    this.trackEvent('feature_usage', {
      featureName,
      usage,
      timestamp: new Date()
    });
  }

  // Analytics Reports

  async generateOnboardingReport(dateRange: { start: Date; end: Date }): Promise<AnalyticsReport> {
    const events = await this.getEventsInRange(dateRange, ['onboarding_started', 'onboarding_step_completed', 'onboarding_completed', 'onboarding_error']);
    
    const report: AnalyticsReport = {
      id: `report_${Date.now()}`,
      reportType: 'onboarding',
      title: 'Onboarding Analytics Report',
      description: 'Comprehensive analysis of employee onboarding process',
      dateRange,
      data: this.analyzeOnboardingData(events),
      charts: this.generateOnboardingCharts(events),
      summary: this.generateOnboardingSummary(events),
      generatedAt: new Date()
    };

    return report;
  }

  async generateEngagementReport(dateRange: { start: Date; end: Date }): Promise<AnalyticsReport> {
    const events = await this.getEventsInRange(dateRange, ['user_interaction', 'form_submission', 'feature_usage', 'screen_load']);
    
    return {
      id: `report_${Date.now()}`,
      reportType: 'engagement',
      title: 'User Engagement Report',
      description: 'Analysis of user interactions and engagement patterns',
      dateRange,
      data: this.analyzeEngagementData(events),
      charts: this.generateEngagementCharts(events),
      summary: this.generateEngagementSummary(events),
      generatedAt: new Date()
    };
  }

  async generatePerformanceReport(dateRange: { start: Date; end: Date }): Promise<AnalyticsReport> {
    const events = await this.getEventsInRange(dateRange, ['screen_load', 'api_call', 'app_crash', 'performance_']);
    
    return {
      id: `report_${Date.now()}`,
      reportType: 'performance',
      title: 'Performance Analytics Report',
      description: 'Application performance metrics and optimization insights',
      dateRange,
      data: this.analyzePerformanceData(events),
      charts: this.generatePerformanceCharts(events),
      summary: this.generatePerformanceSummary(events),
      generatedAt: new Date()
    };
  }

  // Data Analysis Methods

  private analyzeOnboardingData(events: AnalyticsEvent[]) {
    const startedEvents = events.filter(e => e.eventName === 'onboarding_started');
    const completedEvents = events.filter(e => e.eventName === 'onboarding_completed');
    const errorEvents = events.filter(e => e.eventName === 'onboarding_error');
    const stepEvents = events.filter(e => e.eventName === 'onboarding_step_completed');

    const completionRate = startedEvents.length > 0 ? (completedEvents.length / startedEvents.length) * 100 : 0;
    const averageTimeToComplete = this.calculateAverageTimeToComplete(completedEvents);
    const dropoffAnalysis = this.analyzeDropoffPoints(stepEvents);
    const errorAnalysis = this.analyzeErrors(errorEvents);

    return {
      totalStarted: startedEvents.length,
      totalCompleted: completedEvents.length,
      completionRate,
      averageTimeToComplete,
      dropoffAnalysis,
      errorAnalysis,
      stepCompletionRates: this.calculateStepCompletionRates(stepEvents)
    };
  }

  private analyzeEngagementData(events: AnalyticsEvent[]) {
    const interactionEvents = events.filter(e => e.eventName === 'user_interaction');
    const formEvents = events.filter(e => e.eventName === 'form_submission');
    const featureEvents = events.filter(e => e.eventName === 'feature_usage');

    return {
      totalInteractions: interactionEvents.length,
      uniqueUsers: new Set(events.map(e => e.userId).filter(Boolean)).size,
      averageSessionDuration: this.calculateAverageSessionDuration(events),
      mostUsedFeatures: this.getMostUsedFeatures(featureEvents),
      formCompletionRates: this.calculateFormCompletionRates(formEvents),
      userRetention: this.calculateUserRetention(events)
    };
  }

  private analyzePerformanceData(events: AnalyticsEvent[]) {
    const screenLoadEvents = events.filter(e => e.eventName === 'screen_load');
    const apiEvents = events.filter(e => e.eventName === 'api_call');
    const crashEvents = events.filter(e => e.eventName === 'app_crash');

    return {
      averageScreenLoadTime: this.calculateAverageScreenLoadTime(screenLoadEvents),
      averageApiResponseTime: this.calculateAverageApiResponseTime(apiEvents),
      crashRate: this.calculateCrashRate(crashEvents, events),
      slowestScreens: this.getSlowestScreens(screenLoadEvents),
      slowestApis: this.getSlowestApis(apiEvents),
      errorRate: this.calculateErrorRate(events)
    };
  }

  // Chart Generation Methods

  private generateOnboardingCharts(events: AnalyticsEvent[]) {
    return [
      {
        type: 'line' as const,
        title: 'Onboarding Completion Over Time',
        data: this.getCompletionOverTime(events),
        config: { xAxis: 'date', yAxis: 'completions' }
      },
      {
        type: 'bar' as const,
        title: 'Step Completion Rates',
        data: this.getStepCompletionData(events),
        config: { xAxis: 'step', yAxis: 'completion_rate' }
      },
      {
        type: 'pie' as const,
        title: 'Dropoff Points',
        data: this.getDropoffData(events),
        config: { valueField: 'count', categoryField: 'step' }
      }
    ];
  }

  private generateEngagementCharts(events: AnalyticsEvent[]) {
    return [
      {
        type: 'area' as const,
        title: 'User Activity Over Time',
        data: this.getUserActivityOverTime(events),
        config: { xAxis: 'date', yAxis: 'activity' }
      },
      {
        type: 'bar' as const,
        title: 'Feature Usage',
        data: this.getFeatureUsageData(events),
        config: { xAxis: 'feature', yAxis: 'usage_count' }
      }
    ];
  }

  private generatePerformanceCharts(events: AnalyticsEvent[]) {
    return [
      {
        type: 'line' as const,
        title: 'Screen Load Times',
        data: this.getScreenLoadTimeData(events),
        config: { xAxis: 'screen', yAxis: 'load_time' }
      },
      {
        type: 'gauge' as const,
        title: 'Overall Performance Score',
        data: this.getPerformanceScore(events),
        config: { min: 0, max: 100, target: 80 }
      }
    ];
  }

  // Helper Methods for Calculations

  private calculateAverageTimeToComplete(events: AnalyticsEvent[]): number {
    if (events.length === 0) return 0;
    
    const times = events.map(e => e.properties.totalTimeSpent || 0);
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  private analyzeDropoffPoints(events: AnalyticsEvent[]) {
    const stepCounts: Record<string, number> = {};
    
    events.forEach(event => {
      const stepName = event.properties.stepName;
      stepCounts[stepName] = (stepCounts[stepName] || 0) + 1;
    });

    return Object.entries(stepCounts)
      .map(([step, count]) => ({ step, count }))
      .sort((a, b) => a.count - b.count);
  }

  private analyzeErrors(events: AnalyticsEvent[]) {
    const errorTypes: Record<string, number> = {};
    
    events.forEach(event => {
      const errorType = event.properties.errorType;
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    return Object.entries(errorTypes)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Storage Methods

  private async storeEventLocally(event: AnalyticsEvent) {
    try {
      const existingEvents = await AsyncStorage.getItem('analytics_events') || '[]';
      const events = JSON.parse(existingEvents);
      events.push(event);
      
      // Keep only recent events to manage storage
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      const filteredEvents = events.filter((e: AnalyticsEvent) => new Date(e.timestamp) > cutoffDate);
      
      await AsyncStorage.setItem('analytics_events', JSON.stringify(filteredEvents));
    } catch (error) {
      console.error('Error storing analytics event:', error);
    }
  }

  private async storeOnboardingMetrics(userId: string, metrics: OnboardingMetrics) {
    try {
      await AsyncStorage.setItem(`onboarding_metrics_${userId}`, JSON.stringify(metrics));
    } catch (error) {
      console.error('Error storing onboarding metrics:', error);
    }
  }

  private getOnboardingMetrics(userId: string): OnboardingMetrics | null {
    try {
      const stored = AsyncStorage.getItem(`onboarding_metrics_${userId}`);
      return stored ? JSON.parse(stored as string) : null;
    } catch (error) {
      console.error('Error getting onboarding metrics:', error);
      return null;
    }
  }

  // Upload and Sync Methods

  private async uploadEvents() {
    if (this.eventQueue.length === 0 || !OfflineService.isDeviceOnline()) {
      return;
    }

    try {
      const eventsToUpload = [...this.eventQueue];
      this.eventQueue = [];

      const response = await ApiService.post('/analytics/events', {
        events: eventsToUpload,
        sessionId: this.sessionId,
        userId: this.userId
      });

      if (response.success) {
        if (this.config.enableDebugMode) {
          console.log(`Uploaded ${eventsToUpload.length} analytics events`);
        }
      } else {
        // Re-queue events on failure
        this.eventQueue.unshift(...eventsToUpload);
      }
    } catch (error) {
      console.error('Error uploading analytics events:', error);
      // Re-queue events on error
      this.eventQueue.unshift(...this.eventQueue);
    }
  }

  private async getEventsInRange(dateRange: { start: Date; end: Date }, eventTypes?: string[]): Promise<AnalyticsEvent[]> {
    try {
      const allEvents = await AsyncStorage.getItem('analytics_events') || '[]';
      const events: AnalyticsEvent[] = JSON.parse(allEvents);
      
      return events.filter(event => {
        const eventDate = new Date(event.timestamp);
        const inRange = eventDate >= dateRange.start && eventDate <= dateRange.end;
        const typeMatch = !eventTypes || eventTypes.some(type => event.eventName.includes(type));
        return inRange && typeMatch;
      });
    } catch (error) {
      console.error('Error getting events in range:', error);
      return [];
    }
  }

  // Placeholder methods for chart data generation
  private getCompletionOverTime(events: AnalyticsEvent[]) { return []; }
  private getStepCompletionData(events: AnalyticsEvent[]) { return []; }
  private getDropoffData(events: AnalyticsEvent[]) { return []; }
  private getUserActivityOverTime(events: AnalyticsEvent[]) { return []; }
  private getFeatureUsageData(events: AnalyticsEvent[]) { return []; }
  private getScreenLoadTimeData(events: AnalyticsEvent[]) { return []; }
  private getPerformanceScore(events: AnalyticsEvent[]) { return { value: 85 }; }
  private calculateStepCompletionRates(events: AnalyticsEvent[]) { return {}; }
  private calculateAverageSessionDuration(events: AnalyticsEvent[]) { return 0; }
  private getMostUsedFeatures(events: AnalyticsEvent[]) { return []; }
  private calculateFormCompletionRates(events: AnalyticsEvent[]) { return {}; }
  private calculateUserRetention(events: AnalyticsEvent[]) { return 0; }
  private calculateAverageScreenLoadTime(events: AnalyticsEvent[]) { return 0; }
  private calculateAverageApiResponseTime(events: AnalyticsEvent[]) { return 0; }
  private calculateCrashRate(crashEvents: AnalyticsEvent[], allEvents: AnalyticsEvent[]) { return 0; }
  private getSlowestScreens(events: AnalyticsEvent[]) { return []; }
  private getSlowestApis(events: AnalyticsEvent[]) { return []; }
  private calculateErrorRate(events: AnalyticsEvent[]) { return 0; }
  private generateOnboardingSummary(events: AnalyticsEvent[]) { return {}; }
  private generateEngagementSummary(events: AnalyticsEvent[]) { return {}; }
  private generatePerformanceSummary(events: AnalyticsEvent[]) { return {}; }

  // Configuration Methods

  setConfig(config: Partial<AnalyticsConfig>) {
    this.config = { ...this.config, ...config };
    
    if (config.uploadInterval) {
      if (this.uploadTimer) {
        clearInterval(this.uploadTimer);
      }
      this.startPeriodicUpload();
    }
  }

  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  // Cleanup Methods

  async cleanup() {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }
    
    await this.uploadEvents();
    
    this.trackEvent('session_end', {
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.sessionStartTime.getTime()
    });
  }
}

export default AnalyticsService.getInstance();