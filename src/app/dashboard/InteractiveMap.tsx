import React, { useState, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
  Circle,
  DirectionsRenderer,
} from '@react-google-maps/api';
import {
  Box,
  Typography,
  Chip,
  Avatar,
  Paper,
  Button,
  IconButton,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tooltip,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Person as PersonIcon,
  DirectionsCar as CarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  MyLocation as MyLocationIcon,
  Route as RouteIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

// Map configuration
const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060, // New York City
};

const libraries: ("places" | "geometry" | "drawing")[] = ["places", "geometry"];

// Mock data for staff locations
interface StaffLocation {
  id: string;
  name: string;
  position: { lat: number; lng: number };
  status: 'active' | 'break' | 'transit' | 'offline';
  avatar: string;
  currentTask: string;
  lastUpdate: string;
  vehicleId?: string;
  route?: google.maps.DirectionsResult;
}

// Mock data for geofences
interface Geofence {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radius: number;
  type: 'worksite' | 'restricted' | 'client';
  color: string;
}

const mockStaffLocations: StaffLocation[] = [
  {
    id: '1',
    name: 'John Smith',
    position: { lat: 40.7589, lng: -73.9851 },
    status: 'active',
    avatar: '/avatars/john.jpg',
    currentTask: 'HVAC Maintenance - Floor 12',
    lastUpdate: '2 min ago',
    vehicleId: 'VAN-001',
  },
  {
    id: '2',
    name: 'Sarah Wilson',
    position: { lat: 40.7505, lng: -73.9934 },
    status: 'transit',
    avatar: '/avatars/sarah.jpg',
    currentTask: 'Traveling to Client Site B',
    lastUpdate: '1 min ago',
    vehicleId: 'TRUCK-003',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    position: { lat: 40.7282, lng: -74.0776 },
    status: 'break',
    avatar: '/avatars/mike.jpg',
    currentTask: 'Lunch Break',
    lastUpdate: '5 min ago',
  },
  {
    id: '4',
    name: 'Emily Davis',
    position: { lat: 40.7614, lng: -73.9776 },
    status: 'active',
    avatar: '/avatars/emily.jpg',
    currentTask: 'Security System Check',
    lastUpdate: '3 min ago',
    vehicleId: 'VAN-002',
  },
];

const mockGeofences: Geofence[] = [
  {
    id: '1',
    name: 'Main Office',
    center: { lat: 40.7128, lng: -74.0060 },
    radius: 200,
    type: 'worksite',
    color: '#4caf50',
  },
  {
    id: '2',
    name: 'Client Site A',
    center: { lat: 40.7589, lng: -73.9851 },
    radius: 150,
    type: 'client',
    color: '#2196f3',
  },
  {
    id: '3',
    name: 'Restricted Zone',
    center: { lat: 40.7505, lng: -73.9934 },
    radius: 100,
    type: 'restricted',
    color: '#f44336',
  },
];

interface InteractiveMapProps {
  height?: number;
  onStaffClick?: (staff: StaffLocation) => void;
  showControls?: boolean;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  height = 300,
  onStaffClick,
  showControls = true,
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffLocation | null>(null);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showRoutes, setShowRoutes] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Error getting user location:', error);
        }
      );
    }
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleStaffMarkerClick = (staff: StaffLocation) => {
    setSelectedStaff(staff);
    if (onStaffClick) {
      onStaffClick(staff);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'break':
        return '#ff9800';
      case 'transit':
        return '#2196f3';
      case 'offline':
        return '#f44336';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon sx={{ fontSize: 16 }} />;
      case 'break':
        return <ScheduleIcon sx={{ fontSize: 16 }} />;
      case 'transit':
        return <CarIcon sx={{ fontSize: 16 }} />;
      case 'offline':
        return <WarningIcon sx={{ fontSize: 16 }} />;
      default:
        return <PersonIcon sx={{ fontSize: 16 }} />;
    }
  };

  const filteredStaff = mockStaffLocations.filter(staff => 
    filterStatus === 'all' || staff.status === filterStatus
  );

  const centerMapOnUser = () => {
    if (map && userLocation) {
      map.panTo(userLocation);
      map.setZoom(15);
    }
  };

  const centerMapOnStaff = () => {
    if (map && filteredStaff.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      filteredStaff.forEach(staff => {
        bounds.extend(staff.position);
      });
      map.fitBounds(bounds);
    }
  };

  return (
    <Box sx={{ height, position: 'relative' }}>
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'demo-key' ? (
        // Fallback UI when API key is not configured
        <Box
          sx={{
            height: '100%',
            backgroundColor: '#e3f2fd',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            backgroundImage: 'linear-gradient(45deg, rgba(25,118,210,0.1) 25%, transparent 25%), linear-gradient(-45deg, rgba(25,118,210,0.1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(25,118,210,0.1) 75%), linear-gradient(-45deg, transparent 75%, rgba(25,118,210,0.1) 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        >
          <LocationIcon sx={{ fontSize: 80, color: '#1976d2', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" sx={{ mb: 1, textAlign: 'center' }}>
            Interactive Map Ready
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mb: 2 }}>
            Configure Google Maps API key to enable live tracking
          </Typography>
          
          {/* Mock Staff List */}
          <Paper sx={{ p: 2, maxWidth: 300, width: '90%' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Active Field Staff:
            </Typography>
            {mockStaffLocations.map((staff) => (
              <Box key={staff.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ width: 24, height: 24, mr: 1 }}>{staff.name[0]}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {staff.name}
                  </Typography>
                  <Chip
                    label={staff.status}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      backgroundColor: getStatusColor(staff.status),
                      color: 'white',
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Paper>
          
          {/* Instructions */}
          <Typography variant="caption" color="textSecondary" sx={{ 
            position: 'absolute', 
            bottom: 16, 
            textAlign: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '8px 16px',
            borderRadius: 2,
          }}>
            Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local for full functionality
          </Typography>
        </Box>
      ) : (
        // Full Google Maps implementation
        <LoadScript
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'demo-key'}
          libraries={libraries}
          loadingElement={
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#e3f2fd',
              borderRadius: 2,
            }}>
              <Typography variant="h6" color="textSecondary">
                Loading Interactive Map...
              </Typography>
            </Box>
          }
        >
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={userLocation || defaultCenter}
            zoom={12}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }],
                },
              ],
              disableDefaultUI: !showControls,
              zoomControl: showControls,
              streetViewControl: false,
              fullscreenControl: showControls,
            }}
          >
            {/* Staff Markers */}
            {filteredStaff.map((staff) => (
              <Marker
                key={staff.id}
                position={staff.position}
                onClick={() => handleStaffMarkerClick(staff)}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: getStatusColor(staff.status),
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                }}
              />
            ))}

            {/* User Location Marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#1976d2',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
              />
            )}

            {/* Geofences */}
            {showGeofences && mockGeofences.map((geofence) => (
              <Circle
                key={geofence.id}
                center={geofence.center}
                radius={geofence.radius}
                options={{
                  fillColor: geofence.color,
                  fillOpacity: 0.2,
                  strokeColor: geofence.color,
                  strokeWeight: 2,
                  strokeOpacity: 0.8,
                }}
              />
            ))}

            {/* Info Window for Selected Staff */}
            {selectedStaff && (
              <InfoWindow
                position={selectedStaff.position}
                onCloseClick={() => setSelectedStaff(null)}
              >
                <Card sx={{ minWidth: 250, boxShadow: 'none' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Avatar
                        src={selectedStaff.avatar}
                        sx={{ width: 40, height: 40, mr: 1 }}
                      >
                        {selectedStaff.name[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
                          {selectedStaff.name}
                        </Typography>
                        <Chip
                          label={selectedStaff.status}
                          size="small"
                          icon={getStatusIcon(selectedStaff.status)}
                          sx={{
                            backgroundColor: getStatusColor(selectedStaff.status),
                            color: 'white',
                            fontSize: '0.75rem',
                          }}
                        />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      {selectedStaff.currentTask}
                    </Typography>
                    {selectedStaff.vehicleId && (
                      <Typography variant="caption" color="textSecondary">
                        Vehicle: {selectedStaff.vehicleId}
                      </Typography>
                    )}
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                      Last update: {selectedStaff.lastUpdate}
                    </Typography>
                  </CardContent>
                </Card>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      )}

      {/* Map Controls - always show for demo mode too */}
      {showControls && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'demo-key' && (
        <Paper
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            p: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minWidth: 200,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Center on my location">
              <IconButton size="small" onClick={centerMapOnUser}>
                <MyLocationIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fit all staff">
              <IconButton size="small" onClick={centerMapOnStaff}>
                <PersonIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter Status</InputLabel>
            <Select
              value={filterStatus}
              label="Filter Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">All Staff</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="transit">In Transit</MenuItem>
              <MenuItem value="break">On Break</MenuItem>
              <MenuItem value="offline">Offline</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={showGeofences}
                onChange={(e) => setShowGeofences(e.target.checked)}
                size="small"
              />
            }
            label="Geofences"
          />
        </Paper>
      )}

      {/* Staff Count Indicator */}
      <Chip
        label={`${filteredStaff.length} staff visible`}
        size="small"
        sx={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
        }}
      />
    </Box>
  );
};

export default InteractiveMap;
