/**
 * Error Handler Hook
 * React hook for error handling and reporting
 */

import { useCallback, useContext, createContext, useState, ReactNode } from 'react';

interface ErrorContextType {
  reportError: (error: Error, context?: Record<string, any>) => void;
  clearError: () => void;
  errors: ErrorReport[];
}

interface ErrorReport {
  id: string;
  error: Error;
  timestamp: Date;
  context?: Record<string, any>;
  resolved: boolean;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export const useErrorHandler = () => {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useErrorHandler must be used within an ErrorProvider');
  }
  
  return context;
};

// Error Handler Hook
export const useAsyncError = () => {
  const { reportError } = useErrorHandler();
  
  return useCallback((error: Error) => {
    reportError(error, { type: 'async' });
  }, [reportError]);
};

// API Error Handler Hook
export const useApiError = () => {
  const { reportError } = useErrorHandler();
  
  const handleApiError = useCallback((error: any, endpoint?: string, method?: string) => {
    const context = {
      type: 'api',
      endpoint,
      method,
      status: error?.status || error?.response?.status,
      statusText: error?.statusText || error?.response?.statusText,
    };
    
    const formattedError = new Error(
      error?.message || 
      error?.response?.data?.message || 
      `API Error: ${error?.status || 'Unknown'}`
    );
    
    reportError(formattedError, context);
  }, [reportError]);
  
  return handleApiError;
};

// Error Provider Component
export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  
  const reportError = useCallback((error: Error, context?: Record<string, any>) => {
    const errorReport: ErrorReport = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      error,
      timestamp: new Date(),
      context,
      resolved: false
    };
    
    setErrors(prev => [...prev, errorReport]);
    
    // Send to error service
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: errorReport.id,
          message: error.message,
          stack: error.stack,
          timestamp: errorReport.timestamp,
          context,
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(console.error);
    } else {
      console.error('Error reported:', errorReport);
    }
  }, []);
  
  const clearError = useCallback(() => {
    setErrors([]);
  }, []);
  
  const value = { reportError, clearError, errors };
  
  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

// Error Boundary Hook (for functional components)
export const useErrorBoundary = () => {
  const { reportError } = useErrorHandler();
  
  const captureError = useCallback((error: Error, errorInfo?: Record<string, any>) => {
    reportError(error, { type: 'boundary', ...errorInfo });
  }, [reportError]);
  
  return { captureError };
};

export default useErrorHandler;