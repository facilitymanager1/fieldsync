import { useState, useEffect, useCallback } from 'react';
import AnalyticsService, { 
  AnalyticsReport, 
  OnboardingMetrics, 
  AnalyticsConfig,
  AnalyticsEvent 
} from '../services/analyticsService';

export interface AnalyticsState {
  isInitialized: boolean;
  currentSessionId: string;
  userId?: string;
  config: AnalyticsConfig;
  loading: boolean;
  error?: string;
}

export interface AnalyticsActions {
  // Core tracking
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackScreenView: (screenName: string, loadTime?: number) => void;
  trackUserAction: (action: string, element: string, context?: Record<string, any>) => void;
  trackFormInteraction: (formName: string, action: 'start' | 'submit' | 'error', data?: Record<string, any>) => void;
  
  // Onboarding specific
  startOnboardingTracking: (userId: string) => void;
  trackOnboardingStep: (stepName: string, stepData?: Record<string, any>) => void;
  trackOnboardingError: (stepName: string, errorType: string, errorDetails?: Record<string, any>) => void;
  completeOnboarding: (finalData?: Record<string, any>) => void;
  
  // Performance tracking
  trackPerformance: (metric: string, value: number, context?: Record<string, any>) => void;
  trackApiCall: (endpoint: string, method: string, responseTime: number, success: boolean) => void;
  trackError: (error: Error, context?: Record<string, any>) => void;
  
  // Reports
  generateOnboardingReport: (dateRange: { start: Date; end: Date }) => Promise<AnalyticsReport>;
  generateEngagementReport: (dateRange: { start: Date; end: Date }) => Promise<AnalyticsReport>;
  generatePerformanceReport: (dateRange: { start: Date; end: Date }) => Promise<AnalyticsReport>;
  
  // Configuration
  updateConfig: (config: Partial<AnalyticsConfig>) => void;
  setUserId: (userId: string) => void;
}

export function useAnalytics(): AnalyticsState & AnalyticsActions {
  const [state, setState] = useState<AnalyticsState>({
    isInitialized: false,
    currentSessionId: '',
    userId: undefined,
    config: AnalyticsService.getConfig(),
    loading: false
  });

  useEffect(() => {
    initializeAnalytics();
  }, []);

  const initializeAnalytics = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Analytics service is already initialized as singleton
      const config = AnalyticsService.getConfig();
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        currentSessionId: `session_${Date.now()}`,
        config,
        loading: false,
        error: undefined
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to initialize analytics: ${error}`
      }));
    }
  }, []);

  // Core tracking methods
  const trackEvent = useCallback((eventName: string, properties: Record<string, any> = {}) => {
    try {
      AnalyticsService.trackEvent(eventName, properties);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }, []);

  const trackScreenView = useCallback((screenName: string, loadTime?: number) => {
    trackEvent('screen_view', {
      screen: screenName,
      loadTime: loadTime || 0,
      timestamp: new Date()
    });
    
    if (loadTime) {
      AnalyticsService.trackScreenLoad(screenName, loadTime);
    }
  }, [trackEvent]);

  const trackUserAction = useCallback((action: string, element: string, context: Record<string, any> = {}) => {
    AnalyticsService.trackUserInteraction('button', element, action, context);
  }, []);

  const trackFormInteraction = useCallback((
    formName: string, 
    action: 'start' | 'submit' | 'error', 
    data: Record<string, any> = {}
  ) => {
    trackEvent(`form_${action}`, {
      formName,
      ...data,
      timestamp: new Date()
    });

    if (action === 'submit') {
      const validationErrors = data.validationErrors || [];
      AnalyticsService.trackFormSubmission(
        formName, 
        validationErrors.length === 0, 
        validationErrors, 
        data
      );
    }
  }, [trackEvent]);

  // Onboarding specific methods
  const startOnboardingTracking = useCallback((userId: string) => {
    try {
      AnalyticsService.startOnboardingTracking(userId);
      setState(prev => ({ ...prev, userId }));
    } catch (error) {
      console.error('Error starting onboarding tracking:', error);
    }
  }, []);

  const trackOnboardingStep = useCallback((stepName: string, stepData: Record<string, any> = {}) => {
    if (!state.userId) {
      console.warn('Cannot track onboarding step without userId');
      return;
    }

    try {
      AnalyticsService.trackOnboardingStep(state.userId, stepName, stepData);
    } catch (error) {
      console.error('Error tracking onboarding step:', error);
    }
  }, [state.userId]);

  const trackOnboardingError = useCallback((
    stepName: string, 
    errorType: string, 
    errorDetails: Record<string, any> = {}
  ) => {
    if (!state.userId) {
      console.warn('Cannot track onboarding error without userId');
      return;
    }

    try {
      AnalyticsService.trackOnboardingError(state.userId, stepName, errorType, errorDetails);
    } catch (error) {
      console.error('Error tracking onboarding error:', error);
    }
  }, [state.userId]);

  const completeOnboarding = useCallback((finalData: Record<string, any> = {}) => {
    if (!state.userId) {
      console.warn('Cannot complete onboarding tracking without userId');
      return;
    }

    try {
      AnalyticsService.completeOnboarding(state.userId, finalData);
    } catch (error) {
      console.error('Error completing onboarding tracking:', error);
    }
  }, [state.userId]);

  // Performance tracking methods
  const trackPerformance = useCallback((metric: string, value: number, context: Record<string, any> = {}) => {
    trackEvent('performance_metric', {
      metric,
      value,
      ...context,
      timestamp: new Date()
    });
  }, [trackEvent]);

  const trackApiCall = useCallback((
    endpoint: string, 
    method: string, 
    responseTime: number, 
    success: boolean
  ) => {
    try {
      AnalyticsService.trackApiCall(endpoint, method, responseTime, success);
    } catch (error) {
      console.error('Error tracking API call:', error);
    }
  }, []);

  const trackError = useCallback((error: Error, context: Record<string, any> = {}) => {
    try {
      AnalyticsService.trackAppCrash(error, context);
    } catch (err) {
      console.error('Error tracking error:', err);
    }
  }, []);

  // Report generation methods
  const generateOnboardingReport = useCallback(async (dateRange: { start: Date; end: Date }) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const report = await AnalyticsService.generateOnboardingReport(dateRange);
      setState(prev => ({ ...prev, loading: false }));
      return report;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to generate onboarding report: ${error}`
      }));
      throw error;
    }
  }, []);

  const generateEngagementReport = useCallback(async (dateRange: { start: Date; end: Date }) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const report = await AnalyticsService.generateEngagementReport(dateRange);
      setState(prev => ({ ...prev, loading: false }));
      return report;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to generate engagement report: ${error}`
      }));
      throw error;
    }
  }, []);

  const generatePerformanceReport = useCallback(async (dateRange: { start: Date; end: Date }) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const report = await AnalyticsService.generatePerformanceReport(dateRange);
      setState(prev => ({ ...prev, loading: false }));
      return report;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to generate performance report: ${error}`
      }));
      throw error;
    }
  }, []);

  // Configuration methods
  const updateConfig = useCallback((config: Partial<AnalyticsConfig>) => {
    try {
      AnalyticsService.setConfig(config);
      setState(prev => ({
        ...prev,
        config: AnalyticsService.getConfig()
      }));
    } catch (error) {
      console.error('Error updating analytics config:', error);
    }
  }, []);

  const setUserId = useCallback((userId: string) => {
    try {
      AnalyticsService.setUserId(userId);
      setState(prev => ({ ...prev, userId }));
    } catch (error) {
      console.error('Error setting user ID:', error);
    }
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    trackEvent,
    trackScreenView,
    trackUserAction,
    trackFormInteraction,
    startOnboardingTracking,
    trackOnboardingStep,
    trackOnboardingError,
    completeOnboarding,
    trackPerformance,
    trackApiCall,
    trackError,
    generateOnboardingReport,
    generateEngagementReport,
    generatePerformanceReport,
    updateConfig,
    setUserId
  };
}

// Simplified hooks for specific use cases

export function useOnboardingAnalytics(userId?: string) {
  const {
    startOnboardingTracking,
    trackOnboardingStep,
    trackOnboardingError,
    completeOnboarding,
    generateOnboardingReport
  } = useAnalytics();

  const startTracking = useCallback(() => {
    if (userId) {
      startOnboardingTracking(userId);
    }
  }, [userId, startOnboardingTracking]);

  return {
    startTracking,
    trackStep: trackOnboardingStep,
    trackError: trackOnboardingError,
    complete: completeOnboarding,
    generateReport: generateOnboardingReport
  };
}

export function useScreenAnalytics(screenName: string) {
  const { trackScreenView, trackUserAction, trackEvent } = useAnalytics();

  useEffect(() => {
    const startTime = Date.now();
    
    return () => {
      const loadTime = Date.now() - startTime;
      trackScreenView(screenName, loadTime);
    };
  }, [screenName, trackScreenView]);

  const trackAction = useCallback((action: string, element: string, context?: Record<string, any>) => {
    trackUserAction(action, element, { screen: screenName, ...context });
  }, [trackUserAction, screenName]);

  const trackScreenEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    trackEvent(eventName, { screen: screenName, ...properties });
  }, [trackEvent, screenName]);

  return {
    trackAction,
    trackEvent: trackScreenEvent
  };
}

export function useFormAnalytics(formName: string) {
  const { trackFormInteraction, trackEvent } = useAnalytics();

  const trackFormStart = useCallback((initialData?: Record<string, any>) => {
    trackFormInteraction(formName, 'start', initialData);
  }, [formName, trackFormInteraction]);

  const trackFormSubmit = useCallback((success: boolean, data?: Record<string, any>) => {
    trackFormInteraction(formName, success ? 'submit' : 'error', data);
  }, [formName, trackFormInteraction]);

  const trackFieldInteraction = useCallback((fieldName: string, action: string, value?: any) => {
    trackEvent('form_field_interaction', {
      formName,
      fieldName,
      action,
      value,
      timestamp: new Date()
    });
  }, [formName, trackEvent]);

  const trackValidationError = useCallback((fieldName: string, errorType: string, errorMessage: string) => {
    trackEvent('form_validation_error', {
      formName,
      fieldName,
      errorType,
      errorMessage,
      timestamp: new Date()
    });
  }, [formName, trackEvent]);

  return {
    trackStart: trackFormStart,
    trackSubmit: trackFormSubmit,
    trackFieldInteraction,
    trackValidationError
  };
}

export function usePerformanceAnalytics() {
  const { trackPerformance, trackApiCall, trackError } = useAnalytics();

  const trackRenderTime = useCallback((componentName: string, renderTime: number) => {
    trackPerformance('render_time', renderTime, { component: componentName });
  }, [trackPerformance]);

  const trackMemoryUsage = useCallback((usage: number, context?: Record<string, any>) => {
    trackPerformance('memory_usage', usage, context);
  }, [trackPerformance]);

  const trackNetworkRequest = useCallback((
    url: string, 
    method: string, 
    duration: number, 
    success: boolean,
    statusCode?: number
  ) => {
    trackApiCall(url, method, duration, success);
    if (statusCode) {
      trackPerformance('api_status_code', statusCode, { url, method });
    }
  }, [trackApiCall, trackPerformance]);

  return {
    trackRenderTime,
    trackMemoryUsage,
    trackNetworkRequest,
    trackError
  };
}