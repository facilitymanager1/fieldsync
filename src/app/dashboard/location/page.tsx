/**
 * Passive Location Tracking Dashboard Component
 * Advanced GPS tracking with activity recognition and analytics
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Alert,
  Switch,
  FormControlLabel,
  Paper,
  Tooltip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Timeline as TimelineIcon,
  Analytics as AnalyticsIcon,
  Map as MapIcon,
  Settings as SettingsIcon,
  Battery4Bar as BatteryIcon,
  Wifi as WifiIcon,
  BluetoothConnected as BluetoothIcon,
  DirectionsRun as ActivityIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

interface LocationPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  source: 'gps' | 'network' | 'passive';
  batteryLevel?: number;
  speed?: number;
  heading?: number;
}

interface ActivityData {
  id: string;
  type: 'stationary' | 'walking' | 'running' | 'driving' | 'unknown';
  confidence: number;
  startTime: Date;
  endTime: Date;
  distance?: number;
  steps?: number;
}

interface GeofenceEvent {
  id: string;
  geofenceId: string;
  eventType: 'enter' | 'exit' | 'dwell';
  timestamp: Date;
  location: LocationPoint;
  duration?: number;
}

interface LocationBatch {
  id: string;
  deviceId: string;
  startTime: Date;
  endTime: Date;
  points: LocationPoint[];
  compressedSize: number;
  originalSize: number;
  status: 'pending' | 'uploaded' | 'processed' | 'failed';
}

interface TrackingSettings {
  enabled: boolean;
  accuracy: 'high' | 'balanced' | 'low_power';
  interval: number;
  minDistance: number;
  batchSize: number;
  wifiOnly: boolean;
  batteryOptimization: boolean;
  significantLocationChange: boolean;
}

export default function PassiveLocationPage() {
  const [currentView, setCurrentView] = useState('overview');
  const [locationPoints, setLocationPoints] = useState<LocationPoint[]>([]);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);
  const [locationBatches, setLocationBatches] = useState<LocationBatch[]>([]);
  const [settings, setSettings] = useState<TrackingSettings>({
    enabled: true,
    accuracy: 'balanced',
    interval: 300,
    minDistance: 10,
    batchSize: 100,
    wifiOnly: false,
    batteryOptimization: true,
    significantLocationChange: true,
  });
  
  const [loading, setLoading] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [analytics, setAnalytics] = useState<any>({});
  const [deviceStatus, setDeviceStatus] = useState({
    gpsEnabled: true,
    batteryLevel: 75,
    networkAvailable: true,
    lastUpdate: new Date(),
    trackingActive: true,
  });

  useEffect(() => {
    loadLocationData();
    const interval = setInterval(loadRealtimeData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [selectedDate]);

  const loadLocationData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadLocationPoints(),
        loadActivities(),
        loadGeofenceEvents(),
        loadLocationBatches(),
        loadAnalytics(),
      ]);
    } catch (error) {
      console.error('Failed to load location data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealtimeData = async () => {
    try {
      // Load real-time updates without showing loading
      await Promise.all([
        loadLocationPoints(),
        updateDeviceStatus(),
      ]);
    } catch (error) {
      console.error('Failed to load real-time data:', error);
    }
  };

  const loadLocationPoints = async () => {
    // Simulate API call
    const mockPoints: LocationPoint[] = [
      {
        id: '1',
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5,
        timestamp: new Date(Date.now() - 3600000),
        source: 'gps',
        batteryLevel: 75,
        speed: 0,
        heading: 0,
      },
      {
        id: '2',
        latitude: 40.7129,
        longitude: -74.0061,
        accuracy: 8,
        timestamp: new Date(Date.now() - 1800000),
        source: 'gps',
        batteryLevel: 74,
        speed: 5,
        heading: 45,
      },
    ];
    setLocationPoints(mockPoints);
  };

  const loadActivities = async () => {
    const mockActivities: ActivityData[] = [
      {
        id: '1',
        type: 'walking',
        confidence: 85,
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() - 5400000),
        distance: 1200,
        steps: 1500,
      },
      {
        id: '2',
        type: 'driving',
        confidence: 92,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() - 1800000),
        distance: 15000,
      },
    ];
    setActivities(mockActivities);
  };

  const loadGeofenceEvents = async () => {
    const mockEvents: GeofenceEvent[] = [
      {
        id: '1',
        geofenceId: 'office',
        eventType: 'enter',
        timestamp: new Date(Date.now() - 7200000),
        location: {
          id: 'loc1',
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 5,
          timestamp: new Date(),
          source: 'gps',
        },
      },
    ];
    setGeofenceEvents(mockEvents);
  };

  const loadLocationBatches = async () => {
    const mockBatches: LocationBatch[] = [
      {
        id: '1',
        deviceId: 'device123',
        startTime: new Date(Date.now() - 86400000),
        endTime: new Date(Date.now() - 43200000),
        points: [],
        compressedSize: 2048,
        originalSize: 8192,
        status: 'processed',
      },
    ];
    setLocationBatches(mockBatches);
  };

  const loadAnalytics = async () => {
    const mockAnalytics = {
      totalDistance: 25.5,
      averageAccuracy: 6.2,
      batteryUsage: 12.5,
      dataUsage: 1.2,
      activitiesSummary: {
        walking: 45,
        driving: 30,
        stationary: 25,
      },
    };
    setAnalytics(mockAnalytics);
  };

  const updateDeviceStatus = async () => {
    // Update device status in real-time
    setDeviceStatus(prev => ({
      ...prev,
      lastUpdate: new Date(),
      batteryLevel: Math.max(20, prev.batteryLevel - Math.random() * 2),
    }));
  };

  const handleSettingsUpdate = async () => {
    try {
      setLoading(true);
      
      // API call to update settings
      console.log('Updating tracking settings:', settings);
      
      setSettingsDialogOpen(false);
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    try {
      setLoading(true);
      
      // API call to force synchronization
      console.log('Forcing location sync...');
      
      await loadLocationData();
    } catch (error) {
      console.error('Failed to force sync:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (format: 'csv' | 'gpx' | 'kml') => {
    try {
      setLoading(true);
      
      // API call to export location data
      console.log('Exporting location data as:', format);
      
    } catch (error) {
      console.error('Failed to export data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy <= 5) return 'success';
    if (accuracy <= 15) return 'warning';
    return 'error';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'walking': return '🚶';
      case 'running': return '🏃';
      case 'driving': return '🚗';
      case 'stationary': return '⏸️';
      default: return '❓';
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'success';
    if (level > 20) return 'warning';
    return 'error';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationIcon /> Passive Location Tracking
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={handleForceSync}
              disabled={loading}
            >
              Sync Now
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => handleExportData('gpx')}
            >
              Export GPX
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsDialogOpen(true)}
            >
              Settings
            </Button>
          </Box>
        </Box>

        {/* Device Status Bar */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon color={deviceStatus.gpsEnabled ? 'success' : 'error'} />
                  <Typography variant="body2">
                    GPS: {deviceStatus.gpsEnabled ? 'Active' : 'Disabled'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BatteryIcon color={getBatteryColor(deviceStatus.batteryLevel)} />
                  <Typography variant="body2">
                    Battery: {Math.round(deviceStatus.batteryLevel)}%
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WifiIcon color={deviceStatus.networkAvailable ? 'success' : 'error'} />
                  <Typography variant="body2">
                    Network: {deviceStatus.networkAvailable ? 'Connected' : 'Offline'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    Last Update: {deviceStatus.lastUpdate.toLocaleTimeString()}
                  </Typography>
                  {deviceStatus.trackingActive && (
                    <Chip label="Tracking Active" size="small" color="success" />
                  )}
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <Tabs value={currentView} onChange={(e, v) => setCurrentView(v)} sx={{ mb: 3 }}>
          <Tab value="overview" label="Overview" icon={<MapIcon />} />
          <Tab value="timeline" label="Timeline" icon={<TimelineIcon />} />
          <Tab value="activities" label="Activities" icon={<ActivityIcon />} />
          <Tab value="batches" label="Data Batches" icon={<HistoryIcon />} />
          <Tab value="analytics" label="Analytics" icon={<AnalyticsIcon />} />
        </Tabs>

        {/* Overview */}
        {currentView === 'overview' && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Location Points
                  </Typography>
                  
                  <DatePicker
                    label="Select Date"
                    value={selectedDate}
                    onChange={(date) => setSelectedDate(date || new Date())}
                    sx={{ mb: 2 }}
                  />
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Time</TableCell>
                          <TableCell>Coordinates</TableCell>
                          <TableCell>Accuracy</TableCell>
                          <TableCell>Source</TableCell>
                          <TableCell>Speed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {locationPoints.map((point) => (
                          <TableRow key={point.id}>
                            <TableCell>
                              {point.timestamp.toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={`±${point.accuracy}m`}
                                size="small"
                                color={getAccuracyColor(point.accuracy)}
                              />
                            </TableCell>
                            <TableCell>{point.source}</TableCell>
                            <TableCell>
                              {point.speed ? `${point.speed} km/h` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Today's Summary
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Total Distance
                      </Typography>
                      <Typography variant="h6">
                        {analytics.totalDistance || 0} km
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Location Points
                      </Typography>
                      <Typography variant="h6">
                        {locationPoints.length}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Average Accuracy
                      </Typography>
                      <Typography variant="h6">
                        ±{analytics.averageAccuracy || 0}m
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Battery Usage
                      </Typography>
                      <Typography variant="h6">
                        {analytics.batteryUsage || 0}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Geofence Events
                  </Typography>
                  
                  <List>
                    {geofenceEvents.map((event) => (
                      <ListItem key={event.id} divider>
                        <ListItemText
                          primary={`${event.eventType.toUpperCase()} ${event.geofenceId}`}
                          secondary={event.timestamp.toLocaleString()}
                        />
                        <Chip
                          label={event.eventType}
                          size="small"
                          color={event.eventType === 'enter' ? 'success' : 'warning'}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Timeline View */}
        {currentView === 'timeline' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Location Timeline
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                {locationPoints.map((point, index) => (
                  <Box key={point.id} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ minWidth: 100 }}>
                      <Typography variant="body2">
                        {point.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', mx: 2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Accuracy: ±{point.accuracy}m • Source: {point.source}
                        {point.speed && ` • Speed: ${point.speed} km/h`}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Activities View */}
        {currentView === 'activities' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Detected Activities
              </Typography>
              
              <List>
                {activities.map((activity) => (
                  <ListItem key={activity.id} divider>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Typography variant="h6">
                        {getActivityIcon(activity.type)}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1">
                          {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {activity.startTime.toLocaleString()} - {activity.endTime.toLocaleString()}
                        </Typography>
                        {activity.distance && (
                          <Typography variant="caption">
                            Distance: {(activity.distance / 1000).toFixed(2)} km
                          </Typography>
                        )}
                        {activity.steps && (
                          <Typography variant="caption" sx={{ ml: 2 }}>
                            Steps: {activity.steps}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={`${activity.confidence}% confidence`}
                        size="small"
                        color={activity.confidence >= 80 ? 'success' : activity.confidence >= 60 ? 'warning' : 'error'}
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Data Batches View */}
        {currentView === 'batches' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Location Data Batches
              </Typography>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Batch ID</TableCell>
                      <TableCell>Time Range</TableCell>
                      <TableCell>Points</TableCell>
                      <TableCell>Compression</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {locationBatches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>{batch.id}</TableCell>
                        <TableCell>
                          {batch.startTime.toLocaleDateString()} - {batch.endTime.toLocaleDateString()}
                        </TableCell>
                        <TableCell>{batch.points.length}</TableCell>
                        <TableCell>
                          {((1 - batch.compressedSize / batch.originalSize) * 100).toFixed(1)}%
                          <br />
                          <Typography variant="caption" color="textSecondary">
                            {(batch.compressedSize / 1024).toFixed(1)} KB / {(batch.originalSize / 1024).toFixed(1)} KB
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={batch.status}
                            size="small"
                            color={
                              batch.status === 'processed' ? 'success' :
                              batch.status === 'failed' ? 'error' : 'warning'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Analytics View */}
        {currentView === 'analytics' && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Activity Distribution
                  </Typography>
                  
                  {analytics.activitiesSummary && (
                    <Box sx={{ mt: 2 }}>
                      {Object.entries(analytics.activitiesSummary).map(([activity, percentage]) => (
                        <Box key={activity} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'between', mb: 1 }}>
                            <Typography variant="body2">
                              {getActivityIcon(activity)} {activity.charAt(0).toUpperCase() + activity.slice(1)}
                            </Typography>
                            <Typography variant="body2">{percentage}%</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percentage as number}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Metrics
                  </Typography>
                  
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Data Usage (Today)
                      </Typography>
                      <Typography variant="h6">
                        {analytics.dataUsage || 0} MB
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Battery Impact
                      </Typography>
                      <Typography variant="h6">
                        {analytics.batteryUsage || 0}%
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Sync Efficiency
                      </Typography>
                      <Typography variant="h6">
                        92%
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Location Updates
                      </Typography>
                      <Typography variant="h6">
                        {locationPoints.length} today
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Settings Dialog */}
        <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Location Tracking Settings</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  />
                }
                label="Enable Location Tracking"
              />
              
              <FormControl fullWidth>
                <InputLabel>Accuracy Mode</InputLabel>
                <Select
                  value={settings.accuracy}
                  onChange={(e) => setSettings({ ...settings, accuracy: e.target.value as any })}
                >
                  <MenuItem value="high">High Accuracy (GPS)</MenuItem>
                  <MenuItem value="balanced">Balanced (GPS + Network)</MenuItem>
                  <MenuItem value="low_power">Low Power (Network only)</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                label="Update Interval (seconds)"
                type="number"
                value={settings.interval}
                onChange={(e) => setSettings({ ...settings, interval: parseInt(e.target.value) })}
                fullWidth
                helperText="How often to request location updates"
              />
              
              <TextField
                label="Minimum Distance (meters)"
                type="number"
                value={settings.minDistance}
                onChange={(e) => setSettings({ ...settings, minDistance: parseInt(e.target.value) })}
                fullWidth
                helperText="Minimum distance change to trigger update"
              />
              
              <TextField
                label="Batch Size"
                type="number"
                value={settings.batchSize}
                onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) })}
                fullWidth
                helperText="Number of points per batch upload"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.wifiOnly}
                    onChange={(e) => setSettings({ ...settings, wifiOnly: e.target.checked })}
                  />
                }
                label="Upload only on WiFi"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.batteryOptimization}
                    onChange={(e) => setSettings({ ...settings, batteryOptimization: e.target.checked })}
                  />
                }
                label="Battery Optimization"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.significantLocationChange}
                    onChange={(e) => setSettings({ ...settings, significantLocationChange: e.target.checked })}
                  />
                }
                label="Significant Location Change Only"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSettingsUpdate} variant="contained" disabled={loading}>
              Save Settings
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
