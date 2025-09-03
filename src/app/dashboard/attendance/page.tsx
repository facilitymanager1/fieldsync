'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  LinearProgress,
  IconButton,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckInIcon,
  ExitToApp as CheckOutIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Face as FaceIcon,
  MyLocation as GpsIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import ShiftTable from './ShiftTable';

// Face Recognition Component
interface FaceRecognitionProps {
  onFaceDetected: (confidence: number, userData: any) => void;
  onError: (error: string) => void;
  isActive: boolean;
}

const FaceRecognition: React.FC<FaceRecognitionProps> = ({ onFaceDetected, onError, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isActive]);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start face detection after video loads
        videoRef.current.onloadedmetadata = () => {
          setIsLoading(false);
          startFaceDetection();
        };
      }
    } catch (error) {
      setIsLoading(false);
      onError('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startFaceDetection = () => {
    // Simulate face detection with mock confidence
    const interval = setInterval(() => {
      const mockConfidence = Math.random() * 100;
      setConfidence(mockConfidence);
      
      if (mockConfidence > 85) {
        onFaceDetected(mockConfidence, {
          userId: 'user123',
          name: 'John Doe',
          employeeId: 'EMP001'
        });
        clearInterval(interval);
      }
    }, 1000);

    // Cleanup after 10 seconds
    setTimeout(() => clearInterval(interval), 10000);
  };

  return (
    <Box sx={{ textAlign: 'center', p: 2 }}>
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <video
          ref={videoRef}
          width={320}
          height={240}
          style={{
            borderRadius: 8,
            border: confidence > 85 ? '3px solid #4caf50' : '3px solid #2196f3'
          }}
          muted
        />
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
          width={320}
          height={240}
        />
        
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 2
            }}
          >
            <CircularProgress color="primary" />
          </Box>
        )}
      </Box>
      
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="textSecondary">
          Face Recognition Confidence
        </Typography>
        <LinearProgress
          variant="determinate"
          value={confidence}
          sx={{ mt: 1, height: 8, borderRadius: 4 }}
          color={confidence > 85 ? 'success' : 'primary'}
        />
        <Typography variant="caption" color="textSecondary">
          {confidence.toFixed(1)}%
        </Typography>
      </Box>
    </Box>
  );
};

// Geofence Status Component
interface GeofenceStatusProps {
  currentLocation: { lat: number; lng: number } | null;
  authorizedZones: Array<{
    id: string;
    name: string;
    center: { lat: number; lng: number };
    radius: number;
  }>;
  onLocationUpdate: (isWithinZone: boolean, zoneName?: string) => void;
}

const GeofenceStatus: React.FC<GeofenceStatusProps> = ({
  currentLocation,
  authorizedZones,
  onLocationUpdate
}) => {
  const [isWithinZone, setIsWithinZone] = useState(false);
  const [currentZone, setCurrentZone] = useState<string>('');
  const [locationError, setLocationError] = useState<string>('');

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      checkGeofence();
    }
  }, [currentLocation, authorizedZones]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        checkGeofenceForLocation(location);
      },
      (error) => {
        setLocationError('Unable to retrieve location: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const calculateDistance = (
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const checkGeofenceForLocation = (location: { lat: number; lng: number }) => {
    let withinZone = false;
    let zoneName = '';

    for (const zone of authorizedZones) {
      const distance = calculateDistance(
        location.lat, location.lng,
        zone.center.lat, zone.center.lng
      );

      if (distance <= zone.radius) {
        withinZone = true;
        zoneName = zone.name;
        break;
      }
    }

    setIsWithinZone(withinZone);
    setCurrentZone(zoneName);
    onLocationUpdate(withinZone, zoneName);
  };

  const checkGeofence = () => {
    if (currentLocation) {
      checkGeofenceForLocation(currentLocation);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <GpsIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Location Status</Typography>
          <IconButton size="small" onClick={getCurrentLocation} sx={{ ml: 'auto' }}>
            <RefreshIcon />
          </IconButton>
        </Box>

        {locationError ? (
          <Alert severity="error">{locationError}</Alert>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationIcon
                sx={{
                  color: isWithinZone ? '#4caf50' : '#f44336',
                  mr: 1
                }}
              />
              <Typography variant="body1">
                {isWithinZone ? `Inside ${currentZone}` : 'Outside authorized zone'}
              </Typography>
              <Chip
                label={isWithinZone ? 'Authorized' : 'Unauthorized'}
                color={isWithinZone ? 'success' : 'error'}
                size="small"
                sx={{ ml: 1 }}
              />
            </Box>

            {currentLocation && (
              <Typography variant="caption" color="textSecondary">
                Current: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </Typography>
            )}

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Authorized Zones:
              </Typography>
              {authorizedZones.map((zone) => (
                <Chip
                  key={zone.id}
                  label={zone.name}
                  variant={currentZone === zone.name ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Tab Panel Component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`attendance-tabpanel-${index}`}
      aria-labelledby={`attendance-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `attendance-tab-${index}`,
    'aria-controls': `attendance-tabpanel-${index}`,
  };
}

// Main Attendance Dashboard
const AttendancePage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [faceRecognitionActive, setFaceRecognitionActive] = useState(false);
  const [attendanceDialog, setAttendanceDialog] = useState(false);
  const [attendanceType, setAttendanceType] = useState<'check-in' | 'check-out'>('check-in');
  const [userIdentified, setUserIdentified] = useState(false);
  const [locationAuthorized, setLocationAuthorized] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Mock data
  const authorizedZones = [
    {
      id: 'office-1',
      name: 'Main Office',
      center: { lat: 40.7128, lng: -74.0060 },
      radius: 100
    },
    {
      id: 'site-1',
      name: 'Construction Site A',
      center: { lat: 40.7589, lng: -73.9851 },
      radius: 50
    },
    {
      id: 'site-2',
      name: 'Maintenance Site B',
      center: { lat: 40.7505, lng: -73.9934 },
      radius: 75
    }
  ];

  const todayAttendance = {
    checkIn: '09:15 AM',
    checkOut: null,
    status: 'present',
    location: 'Main Office',
    shift: 'Full Day (8 hours)',
    totalHours: '6.5'
  };

  const attendanceHistory = [
    { date: '2025-08-01', checkIn: '09:00 AM', checkOut: '06:00 PM', hours: '8.0', status: 'Present' },
    { date: '2025-07-31', checkIn: '09:15 AM', checkOut: '05:45 PM', hours: '7.5', status: 'Present' },
    { date: '2025-07-30', checkIn: '09:30 AM', checkOut: '01:30 PM', hours: '4.0', status: 'Half Day' },
    { date: '2025-07-29', checkIn: '--', checkOut: '--', hours: '0.0', status: 'Leave' }
  ];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleStartAttendance = (type: 'check-in' | 'check-out') => {
    setAttendanceType(type);
    setAttendanceDialog(true);
    setFaceRecognitionActive(true);
    setUserIdentified(false);
  };

  const handleFaceDetected = (confidence: number, userData: any) => {
    if (confidence > 85) {
      setUserIdentified(true);
      setFaceRecognitionActive(false);
      
      if (locationAuthorized) {
        // Process attendance
        setTimeout(() => {
          setAttendanceDialog(false);
          // Show success notification
        }, 2000);
      }
    }
  };

  const handleLocationUpdate = (isWithinZone: boolean, zoneName?: string) => {
    setLocationAuthorized(isWithinZone);
  };

  const canMarkAttendance = userIdentified && locationAuthorized;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Attendance Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Face recognition-based attendance with geofencing verification
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="attendance tabs">
            <Tab
              label="Mark Attendance"
              icon={<FaceIcon />}
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              label="History"
              icon={<HistoryIcon />}
              iconPosition="start"
              {...a11yProps(1)}
            />
            <Tab
              label="Shifts"
              icon={<ScheduleIcon />}
              iconPosition="start"
              {...a11yProps(2)}
            />
            <Tab
              label="Settings"
              icon={<SettingsIcon />}
              iconPosition="start"
              {...a11yProps(3)}
            />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          {/* Quick Actions */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#4caf50', mr: 2 }}>
                      <CheckInIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">Check In</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Mark your arrival using face recognition
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<FaceIcon />}
                    onClick={() => handleStartAttendance('check-in')}
                    disabled={todayAttendance.checkIn !== null}
                    sx={{ mt: 2 }}
                  >
                    {todayAttendance.checkIn ? 'Already Checked In' : 'Check In Now'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#f44336', mr: 2 }}>
                      <CheckOutIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">Check Out</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Mark your departure using face recognition
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    startIcon={<FaceIcon />}
                    onClick={() => handleStartAttendance('check-out')}
                    disabled={!todayAttendance.checkIn || todayAttendance.checkOut !== null}
                    sx={{ mt: 2 }}
                  >
                    {todayAttendance.checkOut ? 'Already Checked Out' : 'Check Out Now'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Geofence Status */}
          <GeofenceStatus
            currentLocation={currentLocation}
            authorizedZones={authorizedZones}
            onLocationUpdate={handleLocationUpdate}
          />

          {/* Today's Status */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Today's Attendance
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {todayAttendance.checkIn || '--:--'}
                  </Typography>
                  <Typography variant="body2">Check In</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error.main">
                    {todayAttendance.checkOut || '--:--'}
                  </Typography>
                  <Typography variant="body2">Check Out</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary.main">
                    {todayAttendance.totalHours}h
                  </Typography>
                  <Typography variant="body2">Total Hours</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Chip
                    label={todayAttendance.status.toUpperCase()}
                    color="success"
                    size="large"
                  />
                  <Typography variant="body2" sx={{ mt: 1 }}>Status</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Typography variant="h6" gutterBottom>
            Attendance History
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="center">Check In</TableCell>
                  <TableCell align="center">Check Out</TableCell>
                  <TableCell align="center">Total Hours</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attendanceHistory.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell>{record.date}</TableCell>
                    <TableCell align="center">{record.checkIn}</TableCell>
                    <TableCell align="center">{record.checkOut}</TableCell>
                    <TableCell align="center">{record.hours}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={record.status}
                        color={
                          record.status === 'Present' ? 'success' :
                          record.status === 'Half Day' ? 'warning' : 'error'
                        }
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <ShiftTable />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Attendance Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Face Recognition Settings
                  </Typography>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Enable Face Recognition"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="High Accuracy Mode"
                  />
                  <FormControlLabel
                    control={<Switch />}
                    label="Allow Backup PIN"
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Geofencing Settings
                  </Typography>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Enable Geofencing"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Strict Location Verification"
                  />
                  <FormControlLabel
                    control={<Switch />}
                    label="Allow Manual Override"
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Attendance Dialog */}
      <Dialog
        open={attendanceDialog}
        onClose={() => {
          setAttendanceDialog(false);
          setFaceRecognitionActive(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {attendanceType === 'check-in' ? 'Check In' : 'Check Out'} - Face Recognition
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <FaceRecognition
              isActive={faceRecognitionActive}
              onFaceDetected={handleFaceDetected}
              onError={(error) => console.error(error)}
            />
            
            <Box sx={{ mt: 3 }}>
              <Alert
                severity={locationAuthorized ? 'success' : 'error'}
                sx={{ mb: 2 }}
              >
                {locationAuthorized
                  ? 'Location verified - You are in an authorized zone'
                  : 'Location verification failed - Please ensure you are in an authorized zone'
                }
              </Alert>

              {userIdentified && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Face recognition successful - Identity verified
                </Alert>
              )}

              {canMarkAttendance && (
                <Alert severity="info">
                  All verifications complete! Processing attendance...
                </Alert>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAttendanceDialog(false);
              setFaceRecognitionActive(false);
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AttendancePage;
