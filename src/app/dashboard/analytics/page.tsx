/**
 * Real-Time Analytics Dashboard for FieldSync
 * Comprehensive analytics dashboard with real-time data visualization
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Fab,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  ShowChart as ShowChartIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import { useAuth } from '../../auth/AuthContext';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { io, Socket } from 'socket.io-client';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  TimeScale
);

interface AnalyticsMetrics {
  systemMetrics: {
    activeUsers: number;
    averageResponseTime: number;
    systemLoad: number;
    memoryUsage: number;
    errorRate: number;
  };
  businessMetrics: {
    activeTickets: number;
    slaCompliance: number;
    staffUtilization: number;
    clientSatisfaction: number;
  };
}

interface TimeSeriesData {
  timestamp: Date;
  value: number;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
  }[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AnalyticsDashboard() {
  const { token, isAuthenticated } = useAuth();
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState('metric');
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [timeSeriesData, setTimeSeriesData] = useState<{ [key: string]: TimeSeriesData[] }>({});
  const [chartData, setChartData] = useState<{ [key: string]: ChartData }>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadAnalyticsData();
    
    if (isRealTimeEnabled) {
      initializeWebSocket();
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (isRealTimeEnabled && isAuthenticated) {
      initializeWebSocket();
    } else if (socketRef.current) {
      socketRef.current.disconnect();
      setConnectionStatus('disconnected');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealTimeEnabled, isAuthenticated]);

  const initializeWebSocket = () => {
    if (socketRef.current) return; // Already connected
    
    setConnectionStatus('connecting');
    
    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Connected to analytics WebSocket');
      setConnectionStatus('connected');
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from analytics WebSocket');
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('disconnected');
      setError('Real-time connection failed');
    });

    socket.on('analytics:initial', (data) => {
      console.log('Received initial analytics data:', data);
      setMetrics(data.metrics);
      setLastUpdated(new Date(data.timestamp));
    });

    socket.on('analytics:metrics', (data) => {
      console.log('Received metrics update:', data);
      setMetrics(data.metrics);
      setLastUpdated(new Date(data.timestamp));
      updateTimeSeriesData(data.metrics);
    });

    socket.on('analytics:alert', (alert) => {
      console.log('Received alert:', alert);
      // Handle real-time alerts here
      setError(`Alert: ${alert.message}`);
      setTimeout(() => setError(null), 5000);
    });

    socketRef.current = socket;
  };

  const updateTimeSeriesData = (newMetrics: AnalyticsMetrics) => {
    const timestamp = new Date();
    
    setTimeSeriesData(prev => {
      const updated = { ...prev };
      
      // Update system metrics time series
      const systemMetrics = [
        { key: 'activeUsers', value: newMetrics.systemMetrics.activeUsers },
        { key: 'responseTime', value: newMetrics.systemMetrics.averageResponseTime },
        { key: 'cpuUsage', value: newMetrics.systemMetrics.systemLoad },
        { key: 'memoryUsage', value: newMetrics.systemMetrics.memoryUsage }
      ];

      systemMetrics.forEach(({ key, value }) => {
        if (!updated[key]) updated[key] = [];
        updated[key].push({ timestamp, value });
        
        // Keep only last 50 data points
        if (updated[key].length > 50) {
          updated[key] = updated[key].slice(-50);
        }
      });

      return updated;
    });

    // Update chart data
    updateChartData();
  };

  const updateChartData = () => {
    setChartData(prev => {
      const updated = { ...prev };
      
      // System Performance Chart
      const activeUsersData = timeSeriesData['activeUsers'] || [];
      const responseTimeData = timeSeriesData['responseTime'] || [];
      
      updated['systemPerformance'] = {
        labels: activeUsersData.map(d => d.timestamp.toLocaleTimeString()),
        datasets: [
          {
            label: 'Active Users',
            data: activeUsersData.map(d => d.value),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            fill: true
          },
          {
            label: 'Response Time (ms)',
            data: responseTimeData.map(d => d.value),
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            fill: false
          }
        ]
      };

      return updated;
    });
  };

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/analytics/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load analytics data');
      }

      const data = await response.json();
      setMetrics(data.data);
      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error loading analytics data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const createWidget = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/widgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: newWidgetType,
          title: newWidgetTitle,
          config: {
            refreshInterval: 30000,
            size: { width: 4, height: 3 },
            position: { x: 0, y: 0 }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create widget');
      }

      setWidgetDialogOpen(false);
      setNewWidgetTitle('');
      setNewWidgetType('metric');
      await loadAnalyticsData();

    } catch (error) {
      console.error('Error creating widget:', error);
      setError(error instanceof Error ? error.message : 'Failed to create widget');
    }
  };

  const formatNumber = (num: number, suffix?: string): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M${suffix || ''}`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K${suffix || ''}`;
    }
    return `${num}${suffix || ''}`;
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  const renderMetricCard = (title: string, value: number, suffix?: string, trend?: number) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h3" component="div" sx={{ mb: 1 }}>
          {suffix === '%' ? formatPercentage(value) : formatNumber(value, suffix)}
        </Typography>
        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {trend > 0 ? (
              <TrendingUpIcon sx={{ color: 'success.main', mr: 0.5 }} />
            ) : (
              <TrendingDownIcon sx={{ color: 'error.main', mr: 0.5 }} />
            )}
            <Typography variant="body2" color={trend > 0 ? 'success.main' : 'error.main'}>
              {Math.abs(trend)}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Alert severity="warning">
          Please log in to access the analytics dashboard.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading analytics dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Analytics Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time insights and performance metrics
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={isRealTimeEnabled}
                onChange={(e) => setIsRealTimeEnabled(e.target.checked)}
              />
            }
            label="Real-time updates"
          />
          
          <Tooltip title={`WebSocket ${connectionStatus}`}>
            <Chip 
              label={connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              size="small"
              color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'connecting' ? 'warning' : 'default'}
              variant={connectionStatus === 'connected' ? 'filled' : 'outlined'}
            />
          </Tooltip>
          
          <Chip 
            label={lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'No data'}
            size="small"
            variant="outlined"
          />
          
          <Tooltip title="Refresh data">
            <IconButton onClick={loadAnalyticsData} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* System Metrics */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        System Performance
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('Active Users', metrics?.systemMetrics.activeUsers || 0)}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('Response Time', metrics?.systemMetrics.averageResponseTime || 0, 'ms')}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('CPU Usage', metrics?.systemMetrics.systemLoad || 0, '%')}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('Memory Usage', metrics?.systemMetrics.memoryUsage || 0, '%')}
        </Grid>
      </Grid>

      {/* Business Metrics */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Business Metrics
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('Active Tickets', metrics?.businessMetrics.activeTickets || 0)}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('SLA Compliance', metrics?.businessMetrics.slaCompliance || 0, '%')}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('Staff Utilization', metrics?.businessMetrics.staffUtilization || 0, '%')}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {renderMetricCard('Client Satisfaction', metrics?.businessMetrics.clientSatisfaction || 0, '%')}
        </Grid>
      </Grid>

      {/* System Status */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        System Status
      </Typography>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
              <Typography variant="body2">Database: Connected</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
              <Typography variant="body2">Redis: Connected</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
              <Typography variant="body2">WebSocket: Connected</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {(metrics?.systemMetrics.errorRate || 0) < 5 ? (
                <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
              ) : (
                <WarningIcon sx={{ color: 'warning.main', mr: 1 }} />
              )}
              <Typography variant="body2">
                Error Rate: {formatPercentage(metrics?.systemMetrics.errorRate || 0)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Real-time Charts */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        <ShowChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Performance Trends
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {/* System Performance Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Performance Over Time
              </Typography>
              {chartData['systemPerformance'] ? (
                <Box sx={{ height: 320 }}>
                  <Line
                    data={chartData['systemPerformance']}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: {
                        mode: 'index',
                        intersect: false,
                      },
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: false,
                        },
                      },
                      scales: {
                        x: {
                          display: true,
                          title: {
                            display: true,
                            text: 'Time'
                          }
                        },
                        y: {
                          display: true,
                          title: {
                            display: true,
                            text: 'Value'
                          }
                        }
                      }
                    }}
                  />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
                  <Typography color="text.secondary">
                    No chart data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* SLA Compliance Gauge */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                SLA Compliance
              </Typography>
              <Box sx={{ height: 320, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {metrics ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <Doughnut
                      data={{
                        labels: ['Compliant', 'Non-compliant'],
                        datasets: [
                          {
                            data: [
                              metrics.businessMetrics.slaCompliance,
                              100 - metrics.businessMetrics.slaCompliance
                            ],
                            backgroundColor: [
                              '#4caf50',
                              '#f44336',
                            ],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                          },
                        },
                        cutout: '70%',
                      }}
                    />
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                      <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                        {formatPercentage(metrics.businessMetrics.slaCompliance)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Compliance Rate
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    Loading...
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Business Metrics Bar Chart */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <BarChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Business Metrics Overview
              </Typography>
              {metrics ? (
                <Box sx={{ height: 300 }}>
                  <Bar
                    data={{
                      labels: ['Active Tickets', 'Staff Utilization', 'Client Satisfaction', 'SLA Compliance'],
                      datasets: [
                        {
                          label: 'Current Metrics',
                          data: [
                            metrics.businessMetrics.activeTickets,
                            metrics.businessMetrics.staffUtilization,
                            metrics.businessMetrics.clientSatisfaction,
                            metrics.businessMetrics.slaCompliance,
                          ],
                          backgroundColor: [
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(255, 205, 86, 0.8)',
                            'rgba(75, 192, 192, 0.8)',
                          ],
                          borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(255, 205, 86, 1)',
                            'rgba(75, 192, 192, 1)',
                          ],
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        title: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Value'
                          }
                        },
                      },
                    }}
                  />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <Typography color="text.secondary">
                    Loading chart data...
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Loading indicator for real-time updates */}
      {connectionStatus === 'connecting' && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
            Establishing real-time connection...
          </Typography>
        </Box>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add widget"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setWidgetDialogOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Create Widget Dialog */}
      <Dialog open={widgetDialogOpen} onClose={() => setWidgetDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Widget</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Widget Title"
              fullWidth
              variant="outlined"
              value={newWidgetTitle}
              onChange={(e) => setNewWidgetTitle(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Widget Type</InputLabel>
              <Select
                value={newWidgetType}
                onChange={(e) => setNewWidgetType(e.target.value)}
                label="Widget Type"
              >
                <MenuItem value="metric">Metric Card</MenuItem>
                <MenuItem value="chart">Chart</MenuItem>
                <MenuItem value="table">Data Table</MenuItem>
                <MenuItem value="gauge">Gauge</MenuItem>
                <MenuItem value="alert">Alert Panel</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWidgetDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={createWidget} 
            variant="contained"
            disabled={!newWidgetTitle.trim()}
          >
            Create Widget
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}