/**
 * Kiosk Configuration Page - Admin interface for setting up kiosk locations and settings
 * 
 * Features:
 * - Location management with geofencing setup
 * - Employee assignment and face recognition enrollment
 * - Kiosk display settings and customization
 * - Analytics and monitoring configuration
 * - Security and access control settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Paper,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface KioskLocation {
  _id: string;
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  geofenceRadius: number;
  isActive: boolean;
  assignedEmployees: string[];
  settings: {
    autoRefreshInterval: number;
    requireFaceRecognition: boolean;
    allowGroupAttendance: boolean;
    maxGroupSize: number;
    attendanceTimeWindow: number;
    displayBranding: boolean;
    customWelcomeMessage: string;
  };
  analytics: {
    totalAttendance: number;
    averageDaily: number;
    lastActivity: string;
  };
}

interface Employee {
  _id: string;
  name: string;
  employeeId: string;
  department: string;
  email: string;
  avatar?: string;
  faceEnrollmentStatus: 'pending' | 'enrolled' | 'failed';
  assignedLocations: string[];
}

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
      id={`kiosk-config-tabpanel-${index}`}
      aria-labelledby={`kiosk-config-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function KioskConfigPage() {
  const [tabValue, setTabValue] = useState(0);
  const [locations, setLocations] = useState<KioskLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<KioskLocation | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form states
  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    geofenceRadius: 100,
    isActive: true,
    assignedEmployees: [] as string[],
    autoRefreshInterval: 30,
    requireFaceRecognition: true,
    allowGroupAttendance: true,
    maxGroupSize: 10,
    attendanceTimeWindow: 15,
    displayBranding: true,
    customWelcomeMessage: 'Welcome to FieldSync Attendance Kiosk',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load kiosk locations
      const locationsResponse = await fetch('/api/kiosk/locations');
      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        setLocations(locationsData.data || []);
      }

      // Load employees
      const employeesResponse = await fetch('/api/staff');
      if (employeesResponse.ok) {
        const employeesData = await employeesResponse.json();
        setEmployees(employeesData.data || []);
      }

      setError(null);
    } catch (err) {
      setError('Failed to load kiosk configuration data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreateLocation = () => {
    setSelectedLocation(null);
    setLocationForm({
      name: '',
      address: '',
      latitude: 0,
      longitude: 0,
      geofenceRadius: 100,
      isActive: true,
      assignedEmployees: [],
      autoRefreshInterval: 30,
      requireFaceRecognition: true,
      allowGroupAttendance: true,
      maxGroupSize: 10,
      attendanceTimeWindow: 15,
      displayBranding: true,
      customWelcomeMessage: 'Welcome to FieldSync Attendance Kiosk',
    });
    setLocationDialogOpen(true);
  };

  const handleEditLocation = (location: KioskLocation) => {
    setSelectedLocation(location);
    setLocationForm({
      name: location.name,
      address: location.address,
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
      geofenceRadius: location.geofenceRadius,
      isActive: location.isActive,
      assignedEmployees: location.assignedEmployees,
      autoRefreshInterval: location.settings.autoRefreshInterval,
      requireFaceRecognition: location.settings.requireFaceRecognition,
      allowGroupAttendance: location.settings.allowGroupAttendance,
      maxGroupSize: location.settings.maxGroupSize,
      attendanceTimeWindow: location.settings.attendanceTimeWindow,
      displayBranding: location.settings.displayBranding,
      customWelcomeMessage: location.settings.customWelcomeMessage,
    });
    setLocationDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    try {
      const locationData = {
        name: locationForm.name,
        address: locationForm.address,
        coordinates: {
          latitude: locationForm.latitude,
          longitude: locationForm.longitude,
        },
        geofenceRadius: locationForm.geofenceRadius,
        isActive: locationForm.isActive,
        assignedEmployees: locationForm.assignedEmployees,
        settings: {
          autoRefreshInterval: locationForm.autoRefreshInterval,
          requireFaceRecognition: locationForm.requireFaceRecognition,
          allowGroupAttendance: locationForm.allowGroupAttendance,
          maxGroupSize: locationForm.maxGroupSize,
          attendanceTimeWindow: locationForm.attendanceTimeWindow,
          displayBranding: locationForm.displayBranding,
          customWelcomeMessage: locationForm.customWelcomeMessage,
        },
      };

      const url = selectedLocation 
        ? `/api/kiosk/locations/${selectedLocation._id}`
        : '/api/kiosk/locations';
      
      const method = selectedLocation ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationData),
      });

      if (response.ok) {
        setSuccess(selectedLocation ? 'Location updated successfully' : 'Location created successfully');
        setLocationDialogOpen(false);
        loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to save location');
      }
    } catch (err) {
      setError('Failed to save location');
      console.error('Error saving location:', err);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      const response = await fetch(`/api/kiosk/locations/${locationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Location deleted successfully');
        loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete location');
      }
    } catch (err) {
      setError('Failed to delete location');
      console.error('Error deleting location:', err);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationForm(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
        },
        (error) => {
          setError('Failed to get current location');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser');
    }
  };

  const exportConfiguration = async () => {
    try {
      const config = {
        locations,
        employees: employees.filter(emp => 
          locations.some(loc => loc.assignedEmployees.includes(emp._id))
        ),
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kiosk-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Configuration exported successfully');
    } catch (err) {
      setError('Failed to export configuration');
      console.error('Export error:', err);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Kiosk Configuration
        </Typography>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Kiosk Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportConfiguration}
          >
            Export Config
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ width: '100%', mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="kiosk configuration tabs"
        >
          <Tab icon={<LocationIcon />} label="Locations" />
          <Tab icon={<PeopleIcon />} label="Employees" />
          <Tab icon={<SettingsIcon />} label="Global Settings" />
          <Tab icon={<AnalyticsIcon />} label="Analytics" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Locations Tab */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Kiosk Locations</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateLocation}
            >
              Add Location
            </Button>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
            {locations.map((location) => (
              <Box key={location._id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" component="h3">
                        {location.name}
                      </Typography>
                      <Chip
                        label={location.isActive ? 'Active' : 'Inactive'}
                        color={location.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {location.address}
                    </Typography>
                    
                    <Typography variant="body2" gutterBottom>
                      Coordinates: {location.coordinates.latitude.toFixed(6)}, {location.coordinates.longitude.toFixed(6)}
                    </Typography>
                    
                    <Typography variant="body2" gutterBottom>
                      Geofence Radius: {location.geofenceRadius}m
                    </Typography>
                    
                    <Typography variant="body2" gutterBottom>
                      Assigned Employees: {location.assignedEmployees.length}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditLocation(location)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteLocation(location._id)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Employees Tab */}
          <Typography variant="h6" gutterBottom>
            Employee Management
          </Typography>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Face Recognition</TableCell>
                  <TableCell>Assigned Locations</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee._id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={employee.avatar} alt={employee.name}>
                          {employee.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {employee.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {employee.employeeId}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>
                      <Chip
                        label={employee.faceEnrollmentStatus}
                        color={
                          employee.faceEnrollmentStatus === 'enrolled'
                            ? 'success'
                            : employee.faceEnrollmentStatus === 'failed'
                            ? 'error'
                            : 'warning'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {employee.assignedLocations.length} location(s)
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setEmployeeDialogOpen(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* Global Settings Tab */}
          <Typography variant="h6" gutterBottom>
            Global Kiosk Settings
          </Typography>
          {/* Global settings content */}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {/* Analytics Tab */}
          <Typography variant="h6" gutterBottom>
            Kiosk Analytics
          </Typography>
          {/* Analytics content */}
        </TabPanel>
      </Paper>

      {/* Location Dialog */}
      <Dialog
        open={locationDialogOpen}
        onClose={() => setLocationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedLocation ? 'Edit Location' : 'Create New Location'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mt: 1 }}>
            <Box>
              <TextField
                fullWidth
                label="Location Name"
                value={locationForm.name}
                onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={locationForm.isActive}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label="Address"
                value={locationForm.address}
                onChange={(e) => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Latitude"
                type="number"
                value={locationForm.latitude}
                onChange={(e) => setLocationForm(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Longitude"
                type="number"
                value={locationForm.longitude}
                onChange={(e) => setLocationForm(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
              />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  label="Geofence Radius (m)"
                  type="number"
                  value={locationForm.geofenceRadius}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, geofenceRadius: parseInt(e.target.value) }))}
                />
                <Button
                  variant="outlined"
                  onClick={getCurrentLocation}
                  sx={{ minWidth: 'auto', p: 1 }}
                >
                  <LocationIcon />
                </Button>
              </Box>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label="Custom Welcome Message"
                multiline
                rows={2}
                value={locationForm.customWelcomeMessage}
                onChange={(e) => setLocationForm(prev => ({ ...prev, customWelcomeMessage: e.target.value }))}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveLocation}
            startIcon={<SaveIcon />}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
