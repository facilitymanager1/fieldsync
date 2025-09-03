'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Face as FaceIcon,
  LocationOn as LocationIcon,
  CheckCircle as CheckInIcon,
  Cancel as CheckOutIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Verified as VerifiedIcon,
  Error as ErrorIcon,
  Group as GroupIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Styled Components
const KioskContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
}));

const KioskCard = styled(Card)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  borderRadius: theme.spacing(2),
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
}));

const CameraView = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '400px',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  background: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const FaceOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  border: '3px solid #00ff00',
  borderRadius: '8px',
  pointerEvents: 'none',
  transition: 'all 0.3s ease',
}));

const StatusIndicator = styled(Box)<{ status: 'idle' | 'scanning' | 'success' | 'error' }>(({ theme, status }) => ({
  padding: theme.spacing(1, 2),
  borderRadius: theme.spacing(1),
  color: 'white',
  fontWeight: 'bold',
  textAlign: 'center',
  ...(status === 'idle' && { background: theme.palette.grey[500] }),
  ...(status === 'scanning' && { background: theme.palette.info.main }),
  ...(status === 'success' && { background: theme.palette.success.main }),
  ...(status === 'error' && { background: theme.palette.error.main }),
}));

// Interfaces
interface Employee {
  id: string;
  name: string;
  department: string;
  avatar?: string;
  lastAttendance?: Date;
  status: 'checked_in' | 'checked_out' | 'not_present';
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'check_in' | 'check_out';
  timestamp: Date;
  confidence: number;
  location: GeolocationCoords;
  verified: boolean;
}

interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface FaceDetectionResult {
  success: boolean;
  confidence: number;
  employeeId?: string;
  employeeName?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface KioskSettings {
  locationName: string;
  geofenceRadius: number;
  requiredConfidence: number;
  enableLivenessDetection: boolean;
  enableGroupAttendance: boolean;
  maxFacesPerSession: number;
  autoProcessDelay: number;
}

// Mock data
const mockEmployees: Employee[] = [
  { id: '1', name: 'John Smith', department: 'Engineering', status: 'checked_in', lastAttendance: new Date(Date.now() - 3600000) },
  { id: '2', name: 'Sarah Johnson', department: 'Design', status: 'checked_out', lastAttendance: new Date(Date.now() - 7200000) },
  { id: '3', name: 'Mike Chen', department: 'Operations', status: 'not_present' },
  { id: '4', name: 'Emma Davis', department: 'Marketing', status: 'checked_in', lastAttendance: new Date(Date.now() - 1800000) },
];

const defaultSettings: KioskSettings = {
  locationName: 'Main Office Entrance',
  geofenceRadius: 50,
  requiredConfidence: 85,
  enableLivenessDetection: true,
  enableGroupAttendance: true,
  maxFacesPerSession: 10,
  autoProcessDelay: 2000,
};

const KioskAttendance: React.FC = () => {
  // State Management
  const [currentLocation, setCurrentLocation] = useState<GeolocationCoords | null>(null);
  const [locationVerified, setLocationVerified] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [detectedFaces, setDetectedFaces] = useState<FaceDetectionResult[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [settings, setSettings] = useState<KioskSettings>(defaultSettings);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize kiosk on mount
  useEffect(() => {
    initializeKiosk();
    return cleanup;
  }, []);

  const initializeKiosk = async () => {
    try {
      await requestPermissions();
      await getCurrentLocation();
      await initializeCamera();
      setDetectionStatus('idle');
    } catch (error) {
      console.error('Kiosk initialization failed:', error);
      setDetectionStatus('error');
    }
  };

  const requestPermissions = async (): Promise<void> => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' } 
      });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking permission
      
      // Request location permission
      await navigator.geolocation.getCurrentPosition(() => {}, () => {});
    } catch (error) {
      throw new Error('Camera and location permissions required for kiosk operation');
    }
  };

  const getCurrentLocation = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: GeolocationCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setCurrentLocation(coords);
          
          // Verify location is within allowed geofence
          const isWithinGeofence = verifyGeofence(coords);
          setLocationVerified(isWithinGeofence);
          resolve();
        },
        (error) => {
          console.error('Location error:', error);
          reject(new Error('Location access required for attendance verification'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const verifyGeofence = (coords: GeolocationCoords): boolean => {
    // Mock geofence center (replace with actual office coordinates)
    const geofenceCenter = { latitude: 12.9716, longitude: 77.5946 };
    const distance = calculateDistance(coords, geofenceCenter);
    return distance <= settings.geofenceRadius;
  };

  const calculateDistance = (point1: GeolocationCoords, point2: { latitude: number; longitude: number }): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const initializeCamera = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 1280, 
          height: 720, 
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (error) {
      throw new Error('Failed to initialize camera');
    }
  };

  const startFaceDetection = useCallback(() => {
    if (!cameraActive || isProcessing) return;
    
    setDetectionStatus('scanning');
    setIsProcessing(true);
    setScanningProgress(0);
    
    // Simulate scanning progress
    const progressInterval = setInterval(() => {
      setScanningProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Start face detection process
    detectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        await detectFaces();
      }
    }, 500);

    // Auto-stop after delay if no faces detected
    setTimeout(() => {
      if (detectedFaces.length === 0) {
        stopFaceDetection();
        setDetectionStatus('idle');
      }
    }, settings.autoProcessDelay);
  }, [cameraActive, isProcessing, detectedFaces.length, settings.autoProcessDelay]);

  const stopFaceDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsProcessing(false);
    setScanningProgress(0);
  }, []);

  const detectFaces = async (): Promise<void> => {
    try {
      // Simulate face detection API call
      const mockDetection = await simulateFaceDetection();
      
      if (mockDetection.length > 0) {
        setDetectedFaces(mockDetection);
        setDetectionStatus('success');
        
        // Process attendance for detected faces
        await processDetectedFaces(mockDetection);
      }
    } catch (error) {
      console.error('Face detection error:', error);
      setDetectionStatus('error');
    }
  };

  const simulateFaceDetection = async (): Promise<FaceDetectionResult[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock face detection results
    const mockResults: FaceDetectionResult[] = [];
    
    if (Math.random() > 0.3) { // 70% chance of detecting a face
      const randomEmployee = employees[Math.floor(Math.random() * employees.length)];
      mockResults.push({
        success: true,
        confidence: 85 + Math.random() * 15, // 85-100% confidence
        employeeId: randomEmployee.id,
        employeeName: randomEmployee.name,
        boundingBox: {
          x: 200 + Math.random() * 100,
          y: 150 + Math.random() * 50,
          width: 200 + Math.random() * 50,
          height: 250 + Math.random() * 50,
        }
      });
    }
    
    // Group mode: detect multiple faces
    if (groupMode && Math.random() > 0.5) {
      const anotherEmployee = employees[Math.floor(Math.random() * employees.length)];
      if (anotherEmployee.id !== mockResults[0]?.employeeId) {
        mockResults.push({
          success: true,
          confidence: 80 + Math.random() * 15,
          employeeId: anotherEmployee.id,
          employeeName: anotherEmployee.name,
          boundingBox: {
            x: 600 + Math.random() * 100,
            y: 150 + Math.random() * 50,
            width: 200 + Math.random() * 50,
            height: 250 + Math.random() * 50,
          }
        });
      }
    }
    
    return mockResults;
  };

  const processDetectedFaces = async (faces: FaceDetectionResult[]): Promise<void> => {
    const newAttendanceRecords: AttendanceRecord[] = [];
    
    for (const face of faces) {
      if (face.success && face.confidence >= settings.requiredConfidence && face.employeeId && currentLocation) {
        // Determine attendance type based on current status
        const employee = employees.find(emp => emp.id === face.employeeId);
        const attendanceType: 'check_in' | 'check_out' = 
          employee?.status === 'checked_in' ? 'check_out' : 'check_in';
        
        const record: AttendanceRecord = {
          id: `attendance_${Date.now()}_${face.employeeId}`,
          employeeId: face.employeeId,
          employeeName: face.employeeName || 'Unknown',
          type: attendanceType,
          timestamp: new Date(),
          confidence: face.confidence,
          location: currentLocation,
          verified: true,
        };
        
        newAttendanceRecords.push(record);
        
        // Update employee status
        setEmployees(prev => prev.map(emp => 
          emp.id === face.employeeId 
            ? { 
                ...emp, 
                status: attendanceType === 'check_in' ? 'checked_in' : 'checked_out',
                lastAttendance: new Date()
              }
            : emp
        ));
      }
    }
    
    if (newAttendanceRecords.length > 0) {
      setRecentAttendance(prev => [...newAttendanceRecords, ...prev].slice(0, 10));
      
      // Submit to backend
      await submitAttendanceRecords(newAttendanceRecords);
      
      // Show success feedback
      setTimeout(() => {
        stopFaceDetection();
        setDetectedFaces([]);
        setDetectionStatus('idle');
      }, 3000);
    }
  };

  const submitAttendanceRecords = async (records: AttendanceRecord[]): Promise<void> => {
    try {
      // Mock API submission
      console.log('Submitting attendance records:', records);
      
      // In production, this would be:
      // await fetch('/api/kiosk/attendance', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ records, kioskLocation: settings.locationName })
      // });
    } catch (error) {
      console.error('Failed to submit attendance records:', error);
    }
  };

  const cleanup = () => {
    stopFaceDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status: Employee['status']): 'success' | 'error' | 'default' => {
    switch (status) {
      case 'checked_in': return 'success';
      case 'checked_out': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: Employee['status']) => {
    switch (status) {
      case 'checked_in': return <CheckInIcon />;
      case 'checked_out': return <CheckOutIcon />;
      default: return <ScheduleIcon />;
    }
  };

  return (
    <KioskContainer maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h3" color="white" fontWeight="bold">
            FieldSync Attendance Kiosk
          </Typography>
          <Typography variant="h6" color="rgba(255, 255, 255, 0.8)">
            {settings.locationName}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Location Status">
            <Chip
              icon={<LocationIcon />}
              label={locationVerified ? 'Location Verified' : 'Location Error'}
              color={locationVerified ? 'success' : 'error'}
              variant="filled"
            />
          </Tooltip>
          
          <Tooltip title="Group Mode">
            <Chip
              icon={<GroupIcon />}
              label={groupMode ? 'Group Mode' : 'Individual Mode'}
              color={groupMode ? 'primary' : 'default'}
              variant="filled"
              onClick={() => setGroupMode(!groupMode)}
              clickable
            />
          </Tooltip>
          
          <IconButton
            color="inherit"
            onClick={() => setSettingsDialog(true)}
            sx={{ color: 'white' }}
          >
            <SettingsIcon />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        {/* Main Camera View */}
        <Grid item xs={12} lg={8}>
          <KioskCard sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight="bold">
                  Face Recognition Scanner
                </Typography>
                <StatusIndicator status={detectionStatus}>
                  {detectionStatus === 'idle' && 'Ready to Scan'}
                  {detectionStatus === 'scanning' && 'Scanning...'}
                  {detectionStatus === 'success' && 'Recognition Successful'}
                  {detectionStatus === 'error' && 'Detection Error'}
                </StatusIndicator>
              </Box>

              {/* Camera View */}
              <CameraView>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  muted
                />
                <canvas
                  ref={canvasRef}
                  style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                />
                
                {/* Face Detection Overlays */}
                {detectedFaces.map((face, index) => (
                  face.boundingBox && (
                    <FaceOverlay
                      key={index}
                      sx={{
                        left: face.boundingBox.x,
                        top: face.boundingBox.y,
                        width: face.boundingBox.width,
                        height: face.boundingBox.height,
                        borderColor: face.confidence >= settings.requiredConfidence ? '#00ff00' : '#ff9800',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -30,
                          left: 0,
                          background: 'rgba(0, 0, 0, 0.8)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {face.employeeName} ({face.confidence.toFixed(1)}%)
                      </Box>
                    </FaceOverlay>
                  )
                ))}

                {/* Scanning Progress */}
                {isProcessing && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 20,
                      left: 20,
                      right: 20,
                      background: 'rgba(0, 0, 0, 0.8)',
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Typography variant="body2" color="white" gutterBottom>
                      Processing faces...
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={scanningProgress}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                )}
              </CameraView>

              {/* Controls */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {!isProcessing ? (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<FaceIcon />}
                    onClick={startFaceDetection}
                    disabled={!cameraActive || !locationVerified}
                    sx={{ px: 4, py: 2, fontSize: '1.1rem' }}
                  >
                    Start Attendance Scan
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<CircularProgress size={20} />}
                    onClick={stopFaceDetection}
                    sx={{ px: 4, py: 2, fontSize: '1.1rem' }}
                  >
                    Stop Scanning
                  </Button>
                )}
                
                <IconButton
                  size="large"
                  onClick={initializeKiosk}
                  disabled={isProcessing}
                >
                  <RefreshIcon />
                </IconButton>
              </Box>

              {/* Status Alerts */}
              {!locationVerified && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Location verification failed. Please ensure the kiosk is placed in the authorized area.
                </Alert>
              )}
              
              {!cameraActive && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Camera not active. Please check camera permissions and connection.
                </Alert>
              )}
            </CardContent>
          </KioskCard>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Recent Attendance */}
          <KioskCard sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Attendance
              </Typography>
              <List dense>
                {recentAttendance.slice(0, 5).map((record) => (
                  <React.Fragment key={record.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>
                          {record.type === 'check_in' ? <CheckInIcon /> : <CheckOutIcon />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={record.employeeName}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {record.type === 'check_in' ? 'Checked In' : 'Checked Out'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(record.timestamp)} • {record.confidence.toFixed(1)}% confidence
                            </Typography>
                          </Box>
                        }
                      />
                      <VerifiedIcon color="success" />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
                {recentAttendance.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No recent attendance"
                      secondary="Attendance records will appear here"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </KioskCard>

          {/* Employee Status */}
          <KioskCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Employee Status
              </Typography>
              <List dense>
                {employees.slice(0, 8).map((employee) => (
                  <React.Fragment key={employee.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>
                          {employee.avatar ? (
                            <img src={employee.avatar} alt={employee.name} />
                          ) : (
                            <PersonIcon />
                          )}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={employee.name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {employee.department}
                            </Typography>
                            {employee.lastAttendance && (
                              <Typography variant="caption" color="text.secondary">
                                Last: {formatTime(employee.lastAttendance)}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Chip
                        icon={getStatusIcon(employee.status)}
                        label={employee.status.replace('_', ' ')}
                        color={getStatusColor(employee.status)}
                        size="small"
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </KioskCard>
        </Grid>
      </Grid>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialog}
        onClose={() => setSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Kiosk Settings</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Configure kiosk behavior and detection parameters.
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Location: {settings.locationName}</Typography>
            <Typography variant="subtitle2">Geofence Radius: {settings.geofenceRadius}m</Typography>
            <Typography variant="subtitle2">Required Confidence: {settings.requiredConfidence}%</Typography>
            <Typography variant="subtitle2">Liveness Detection: {settings.enableLivenessDetection ? 'Enabled' : 'Disabled'}</Typography>
            <Typography variant="subtitle2">Group Attendance: {settings.enableGroupAttendance ? 'Enabled' : 'Disabled'}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Dashboard */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        href="/dashboard"
      >
        <DashboardIcon />
      </Fab>
    </KioskContainer>
  );
};

export default KioskAttendance;
