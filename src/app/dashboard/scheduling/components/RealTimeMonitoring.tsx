'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  IconButton,
  Switch,
  FormControlLabel,
  Badge,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';
import { schedulingApi } from '../services/SchedulingApiService';

interface RealTimeEvent {
  id: string;
  timestamp: Date;
  type: 'task_started' | 'task_completed' | 'task_delayed' | 'resource_assigned' | 'optimization_complete' | 'alert' | 'geofence_entry' | 'geofence_exit';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  resourceId?: string;
  resourceName?: string;
  taskId?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  metadata?: Record<string, any>;
}

interface ActiveTask {
  id: string;
  title: string;
  assignedTo: string;
  status: 'in_progress' | 'delayed' | 'completed' | 'paused';
  startTime: Date;
  estimatedDuration: number;
  actualDuration?: number;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  alerts?: string[];
}

interface SystemAlert {
  id: string;
  type: 'system' | 'resource' | 'performance' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  actions?: Array<{ label: string; action: string }>;
}

const RealTimeMonitoring: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [events, setEvents] = useState<RealTimeEvent[]>([]);
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (autoRefresh && isMonitoring) {
      intervalRef.current = setInterval(fetchLatestData, refreshInterval);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isMonitoring]);

  const startMonitoring = () => {
    // Initialize WebSocket connection
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Real-time monitoring connected');
        // Subscribe to events
        wsRef.current?.send(JSON.stringify({
          type: 'subscribe',
          channels: ['task_events', 'system_alerts', 'resource_updates']
        }));
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealTimeUpdate(data);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Fall back to polling
        if (autoRefresh) {
          intervalRef.current = setInterval(fetchLatestData, refreshInterval);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket connection closed');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (isMonitoring) {
            startMonitoring();
          }
        }, 5000);
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      // Fall back to polling
      if (autoRefresh) {
        intervalRef.current = setInterval(fetchLatestData, refreshInterval);
      }
    }

    // Initial data fetch
    fetchLatestData();
  };

  const stopMonitoring = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleRealTimeUpdate = (data: any) => {
    switch (data.type) {
      case 'task_event':
        addEvent(data.payload);
        updateActiveTask(data.payload);
        break;
      case 'system_alert':
        addSystemAlert(data.payload);
        break;
      case 'resource_update':
        updateResourceStatus(data.payload);
        break;
      default:
        console.log('Unknown event type:', data.type);
    }
  };

  const fetchLatestData = async () => {
    try {
      // Fetch active tasks
      const tasks = await schedulingApi.getActiveTasks();
      setActiveTasks(tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        assignedTo: task.assignedResource.name,
        status: task.status,
        startTime: new Date(task.scheduledStart),
        estimatedDuration: task.estimatedDuration,
        actualDuration: task.actualDuration,
        location: task.location.address,
        priority: task.priority,
        progress: task.progress || 0,
        alerts: task.alerts || []
      })));

      // Fetch recent events (mock data for now)
      const recentEvents: RealTimeEvent[] = [
        {
          id: '1',
          timestamp: new Date(),
          type: 'task_started',
          severity: 'info',
          title: 'Task Started',
          description: 'John Smith started HVAC Maintenance at Building A',
          resourceId: 'tech-001',
          resourceName: 'John Smith',
          taskId: 'task-101',
          location: { lat: 40.7128, lng: -74.0060, address: '123 Main St, New York, NY' }
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 300000),
          type: 'optimization_complete',
          severity: 'success',
          title: 'Optimization Complete',
          description: 'Route optimization completed with 15% efficiency improvement',
          metadata: { improvement: 15, algorithm: 'genetic' }
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 600000),
          type: 'task_delayed',
          severity: 'warning',
          title: 'Task Delayed',
          description: 'Electrical Repair at Building C delayed by 30 minutes',
          resourceId: 'tech-002',
          resourceName: 'Sarah Johnson',
          taskId: 'task-102'
        }
      ];

      setEvents(prev => {
        const newEvents = [...recentEvents, ...prev];
        return newEvents.slice(0, 50); // Keep only latest 50 events
      });

      // Fetch system alerts (mock data)
      const alerts: SystemAlert[] = [
        {
          id: 'alert-1',
          type: 'performance',
          severity: 'warning',
          title: 'High Resource Utilization',
          message: 'Resource utilization has exceeded 90% for the past 2 hours',
          timestamp: new Date(Date.now() - 900000),
          acknowledged: false,
          actions: [
            { label: 'View Details', action: 'view_utilization' },
            { label: 'Adjust Schedule', action: 'adjust_schedule' }
          ]
        },
        {
          id: 'alert-2',
          type: 'system',
          severity: 'info',
          title: 'Scheduled Maintenance',
          message: 'System maintenance window scheduled for tonight at 2:00 AM',
          timestamp: new Date(Date.now() - 1800000),
          acknowledged: true
        }
      ];

      setSystemAlerts(alerts);

    } catch (error) {
      console.error('Failed to fetch latest data:', error);
    }
  };

  const addEvent = (event: RealTimeEvent) => {
    setEvents(prev => [event, ...prev.slice(0, 49)]);
    
    if (notifications && event.severity === 'error') {
      // Show browser notification for critical events
      if (Notification.permission === 'granted') {
        new Notification(event.title, {
          body: event.description,
          icon: '/favicon.ico'
        });
      }
    }
  };

  const addSystemAlert = (alert: SystemAlert) => {
    setSystemAlerts(prev => [alert, ...prev]);
  };

  const updateActiveTask = (taskUpdate: any) => {
    setActiveTasks(prev => 
      prev.map(task => 
        task.id === taskUpdate.taskId 
          ? { ...task, ...taskUpdate }
          : task
      )
    );
  };

  const updateResourceStatus = (resourceUpdate: any) => {
    // Update resource status in active tasks
    setActiveTasks(prev =>
      prev.map(task =>
        task.assignedTo === resourceUpdate.resourceName
          ? { ...task, status: resourceUpdate.status }
          : task
      )
    );
  };

  const acknowledgeAlert = (alertId: string) => {
    setSystemAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const getEventIcon = (type: RealTimeEvent['type']) => {
    switch (type) {
      case 'task_started':
        return <PlayIcon color="primary" />;
      case 'task_completed':
        return <CheckCircleIcon color="success" />;
      case 'task_delayed':
        return <WarningIcon color="warning" />;
      case 'alert':
        return <ErrorIcon color="error" />;
      case 'optimization_complete':
        return <CheckCircleIcon color="success" />;
      case 'geofence_entry':
      case 'geofence_exit':
        return <LocationIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getStatusColor = (status: ActiveTask['status']) => {
    switch (status) {
      case 'in_progress':
        return 'primary';
      case 'completed':
        return 'success';
      case 'delayed':
        return 'warning';
      case 'paused':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: ActiveTask['priority']) => {
    switch (priority) {
      case 'urgent':
        return '#f44336';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      case 'low':
        return '#4caf50';
      default:
        return '#9e9e9e';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <Box sx={{ height: isFullscreen ? '100vh' : 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Real-Time Monitoring</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
            }
            label="Notifications"
          />
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />
          <Button
            variant={isMonitoring ? "outlined" : "contained"}
            startIcon={isMonitoring ? <PauseIcon /> : <PlayIcon />}
            onClick={() => setIsMonitoring(!isMonitoring)}
            color={isMonitoring ? "warning" : "primary"}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </Button>
          <IconButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            size="small"
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* System Status */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">System Status</Typography>
              <Chip
                label={isMonitoring ? 'ACTIVE' : 'STOPPED'}
                color={isMonitoring ? 'success' : 'default'}
                size="small"
              />
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="primary">
                      {activeTasks.length}
                    </Typography>
                    <Typography variant="body2">Active Tasks</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="warning.main">
                      {systemAlerts.filter(a => !a.acknowledged).length}
                    </Typography>
                    <Typography variant="body2">Unacknowledged Alerts</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="success.main">
                      {events.filter(e => e.type === 'task_completed').length}
                    </Typography>
                    <Typography variant="body2">Completed Today</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="info.main">
                      {Math.round(activeTasks.reduce((acc, task) => acc + task.progress, 0) / Math.max(activeTasks.length, 1))}%
                    </Typography>
                    <Typography variant="body2">Avg Progress</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Active Tasks */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Active Tasks</Typography>
            <List>
              {activeTasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  <ListItem>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: getPriorityColor(task.priority), width: 32, height: 32 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1">{task.title}</Typography>
                          <Chip
                            label={task.status.replace('_', ' ').toUpperCase()}
                            color={getStatusColor(task.status)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Assigned to: {task.assignedTo} • Location: {task.location}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TimeIcon fontSize="small" />
                              <Typography variant="caption">
                                Started: {task.startTime.toLocaleTimeString()}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                              <Typography variant="caption">Progress:</Typography>
                              <Box sx={{ flexGrow: 1, bgcolor: 'grey.200', borderRadius: 1, height: 6 }}>
                                <Box
                                  sx={{
                                    bgcolor: getPriorityColor(task.priority),
                                    height: '100%',
                                    borderRadius: 1,
                                    width: `${task.progress}%`,
                                    transition: 'width 0.3s ease'
                                  }}
                                />
                              </Box>
                              <Typography variant="caption">{task.progress}%</Typography>
                            </Box>
                          </Box>
                          {task.alerts && task.alerts.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              {task.alerts.map((alert, alertIndex) => (
                                <Chip
                                  key={alertIndex}
                                  label={alert}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ mr: 1, mb: 0.5 }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < activeTasks.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {activeTasks.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No active tasks"
                    secondary="All tasks are completed or not yet started"
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Real-Time Events */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Real-Time Events</Typography>
              <IconButton size="small" onClick={fetchLatestData}>
                <RefreshIcon />
              </IconButton>
            </Box>
            <Box sx={{ height: 320, overflow: 'auto' }}>
              <List dense>
                {events.map((event) => (
                  <ListItem key={event.id}>
                    <ListItemIcon>
                      {getEventIcon(event.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={event.title}
                      secondary={
                        <Box>
                          <Typography variant="body2">{event.description}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatTimestamp(event.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
                {events.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No recent events"
                      secondary="Events will appear here when monitoring is active"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Paper>
        </Grid>

        {/* System Alerts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">System Alerts</Typography>
              <Badge badgeContent={systemAlerts.filter(a => !a.acknowledged).length} color="error">
                <NotificationsIcon />
              </Badge>
            </Box>
            <Box sx={{ height: 320, overflow: 'auto' }}>
              <List dense>
                {systemAlerts.map((alert) => (
                  <ListItem
                    key={alert.id}
                    sx={{
                      bgcolor: alert.acknowledged ? 'transparent' : 'action.hover',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemIcon>
                      {alert.severity === 'critical' || alert.severity === 'error' ? (
                        <ErrorIcon color="error" />
                      ) : alert.severity === 'warning' ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <InfoIcon color="info" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2">{alert.title}</Typography>
                          {!alert.acknowledged && (
                            <Button
                              size="small"
                              onClick={() => acknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">{alert.message}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatTimestamp(alert.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
                {systemAlerts.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No system alerts"
                      secondary="System is operating normally"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RealTimeMonitoring;
