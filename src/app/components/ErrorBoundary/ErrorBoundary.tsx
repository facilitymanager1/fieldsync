/**
 * Comprehensive Error Boundary Component
 * Production-ready error handling with monitoring integration
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Container
} from '@mui/material';
import {
  ErrorOutline,
  Refresh,
  BugReport,
  ExpandMore,
  ContentCopy,
  Send,
  Home,
  Warning,
  Info
} from '@mui/icons-material';
import { useErrorHandler } from './useErrorHandler';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  userId?: string;
  reportDialogOpen: boolean;
  reportDescription: string;
  includePersonalInfo: boolean;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showReportDialog?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  level?: 'page' | 'component' | 'section';
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  resetError: () => void;
  reportError: () => void;
  retryCount: number;
  errorId: string;
}

interface ComponentType<P = Record<string, any>> {
  (props: P): ReactNode;
  displayName?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      userId: this.getCurrentUserId(),
      reportDialogOpen: false,
      reportDescription: '',
      includePersonalInfo: false,
      retryCount: 0
    };
  }

  private getCurrentUserId(): string | undefined {
    // In a real app, get this from your auth context/store
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user).id : undefined;
    } catch {
      return undefined;
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    return {
      hasError: true,
      error,
      errorId,
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo,
      userId: this.getCurrentUserId()
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);

    // Auto-retry for component-level errors
    if (this.props.level === 'component' && this.props.enableRetry && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleRetry();
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: this.state.timestamp.toISOString(),
      url: this.state.url,
      userAgent: this.state.userAgent,
      userId: this.state.userId,
      level: this.props.level || 'component',
      retryCount: this.state.retryCount,
      props: this.props.level === 'component' ? 'redacted' : undefined
    };

    // In production, send to your error monitoring service (Sentry, LogRocket, etc.)
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(errorData);
    } else {
      console.error('Error logged:', errorData);
    }
  };

  private sendToErrorService = async (errorData: any) => {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      });
    } catch (err) {
      console.error('Failed to send error to monitoring service:', err);
    }
  };

  private scheduleRetry = () => {
    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }, Math.min(1000 * Math.pow(2, this.state.retryCount), 10000)); // Exponential backoff, max 10s
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: this.state.retryCount + 1
    });
  };

  private handleReportError = () => {
    this.setState({ reportDialogOpen: true });
  };

  private handleSubmitReport = async () => {
    const report = {
      errorId: this.state.errorId,
      userDescription: this.state.reportDescription,
      includePersonalInfo: this.state.includePersonalInfo,
      timestamp: new Date().toISOString(),
      additionalContext: {
        retryCount: this.state.retryCount,
        userActions: 'User submitted error report'
      }
    };

    try {
      await fetch('/api/errors/user-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
      
      this.setState({ 
        reportDialogOpen: false, 
        reportDescription: '', 
        includePersonalInfo: false 
      });
    } catch (err) {
      console.error('Failed to submit user report:', err);
    }
  };

  private copyErrorDetails = () => {
    const errorDetails = JSON.stringify({
      errorId: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      timestamp: this.state.timestamp,
      url: this.state.url,
      componentStack: this.state.errorInfo?.componentStack
    }, null, 2);

    navigator.clipboard.writeText(errorDetails);
  };

  private getErrorSeverity = (): 'error' | 'warning' | 'info' => {
    const { level } = this.props;
    
    if (level === 'page') return 'error';
    if (this.state.error?.message.toLowerCase().includes('chunk')) return 'warning';
    if (this.state.retryCount > 0) return 'warning';
    
    return 'error';
  };

  private getErrorTitle = (): string => {
    const { level } = this.props;
    const severity = this.getErrorSeverity();
    
    if (level === 'page') return 'Application Error';
    if (severity === 'warning') return 'Component Issue';
    
    return 'Something went wrong';
  };

  private getErrorIcon = () => {
    const severity = this.getErrorSeverity();
    
    switch (severity) {
      case 'error': return <ErrorOutline color="error" sx={{ fontSize: 48 }} />;
      case 'warning': return <Warning color="warning" sx={{ fontSize: 48 }} />;
      case 'info': return <Info color="info" sx={{ fontSize: 48 }} />;
    }
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    const { hasError, error, errorInfo, errorId, timestamp, retryCount } = this.state;
    const { children, fallback: CustomFallback, level = 'component', enableRetry = true, maxRetries = 3 } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (CustomFallback) {
      return (
        <CustomFallback
          error={error!}
          errorInfo={errorInfo!}
          resetError={this.handleRetry}
          reportError={this.handleReportError}
          retryCount={retryCount}
          errorId={errorId}
        />
      );
    }

    // Default error UI
    return (
      <Container maxWidth={level === 'page' ? 'md' : false} sx={{ py: level === 'page' ? 8 : 2 }}>
        <Paper 
          elevation={level === 'page' ? 3 : 1} 
          sx={{ 
            p: level === 'page' ? 4 : 3, 
            textAlign: 'center',
            border: level !== 'page' ? `1px solid ${this.getErrorSeverity() === 'error' ? '#f44336' : '#ff9800'}` : undefined
          }}
        >
          {/* Error Icon and Title */}
          <Box sx={{ mb: 3 }}>
            {this.getErrorIcon()}
            <Typography variant={level === 'page' ? 'h4' : 'h6'} component="h1" gutterBottom sx={{ mt: 2 }}>
              {this.getErrorTitle()}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {level === 'page' 
                ? 'We encountered an unexpected error while loading this page.'
                : 'This component failed to load properly.'}
            </Typography>
          </Box>

          {/* Error ID and Timestamp */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" flexWrap="wrap">
              <Chip 
                label={`Error ID: ${errorId}`} 
                size="small" 
                variant="outlined" 
                color="error"
              />
              <Chip 
                label={`Time: ${timestamp.toLocaleString()}`} 
                size="small" 
                variant="outlined"
              />
              {retryCount > 0 && (
                <Chip 
                  label={`Attempt: ${retryCount + 1}`} 
                  size="small" 
                  variant="outlined" 
                  color="warning"
                />
              )}
            </Stack>
          </Box>

          {/* Action Buttons */}
          <Stack 
            direction={level === 'page' ? 'row' : 'column'} 
            spacing={2} 
            justifyContent="center" 
            alignItems="center"
            sx={{ mb: 3 }}
          >
            {enableRetry && retryCount < maxRetries && (
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={this.handleRetry}
                size={level === 'page' ? 'large' : 'medium'}
              >
                Try Again
              </Button>
            )}
            
            {level === 'page' && (
              <Button
                variant="outlined"
                startIcon={<Home />}
                onClick={() => window.location.href = '/dashboard'}
                size="large"
              >
                Go to Dashboard
              </Button>
            )}

            <Button
              variant="outlined"
              startIcon={<BugReport />}
              onClick={this.handleReportError}
              size={level === 'page' ? 'large' : 'medium'}
            >
              Report Issue
            </Button>
          </Stack>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ mt: 4, textAlign: 'left' }}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">Error Details (Development)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Error Message:</Typography>
                      <Alert severity="error" sx={{ mb: 2 }}>
                        <AlertTitle>{error?.name}</AlertTitle>
                        {error?.message}
                      </Alert>
                    </Box>
                    
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2">Stack Trace:</Typography>
                        <Tooltip title="Copy Error Details">
                          <IconButton onClick={this.copyErrorDetails} size="small">
                            <ContentCopy />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box 
                        sx={{ 
                          bgcolor: 'grey.100', 
                          p: 2, 
                          borderRadius: 1, 
                          fontSize: '0.75rem', 
                          fontFamily: 'monospace',
                          overflow: 'auto',
                          maxHeight: 200
                        }}
                      >
                        <pre>{error?.stack}</pre>
                      </Box>
                    </Box>

                    {errorInfo && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Component Stack:</Typography>
                        <Box 
                          sx={{ 
                            bgcolor: 'grey.100', 
                            p: 2, 
                            borderRadius: 1, 
                            fontSize: '0.75rem', 
                            fontFamily: 'monospace',
                            overflow: 'auto',
                            maxHeight: 200
                          }}
                        >
                          <pre>{errorInfo.componentStack}</pre>
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </Paper>

        {/* Error Report Dialog */}
        <Dialog 
          open={this.state.reportDialogOpen} 
          onClose={() => this.setState({ reportDialogOpen: false })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <BugReport sx={{ mr: 1 }} />
              Report Error
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Help us improve by describing what you were doing when this error occurred.
              </Typography>
              
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Describe what happened"
                placeholder="I was trying to..."
                value={this.state.reportDescription}
                onChange={(e) => this.setState({ reportDescription: e.target.value })}
                sx={{ mb: 2 }}
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.state.includePersonalInfo}
                    onChange={(e) => this.setState({ includePersonalInfo: e.target.checked })}
                  />
                }
                label="Include technical details (may contain personal information)"
              />
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <AlertTitle>Privacy Notice</AlertTitle>
                Technical details may include your browser information, current page, and error specifics. 
                No passwords or sensitive data are included.
              </Alert>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ reportDialogOpen: false })}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Send />}
              onClick={this.handleSubmitReport}
              disabled={!this.state.reportDescription.trim()}
            >
              Send Report
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    );
  }
}

// Higher-order component for easy error boundary wrapping
export const withErrorBoundary = <P extends object>(
  Component: ComponentType<P>,
  errorBoundaryConfig?: Partial<ErrorBoundaryProps>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryConfig}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Specialized error boundaries for different contexts
export const PageErrorBoundary: React.FC<{ children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }> = ({ 
  children, 
  onError 
}) => (
  <ErrorBoundary
    level="page"
    onError={onError}
    showReportDialog={true}
    enableRetry={false}
  >
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{ children: ReactNode; maxRetries?: number }> = ({ 
  children, 
  maxRetries = 3 
}) => (
  <ErrorBoundary
    level="component"
    enableRetry={true}
    maxRetries={maxRetries}
    showReportDialog={false}
  >
    {children}
  </ErrorBoundary>
);

export const SectionErrorBoundary: React.FC<{ children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }> = ({ 
  children, 
  onError 
}) => (
  <ErrorBoundary
    level="section"
    onError={onError}
    enableRetry={true}
    maxRetries={2}
    showReportDialog={true}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;