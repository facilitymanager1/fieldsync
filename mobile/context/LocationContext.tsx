import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import ApiService from '../services/ApiServiceNew';

interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

interface LocationContextType {
  currentLocation: Location | null;
  isTracking: boolean;
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  updateLocation: (location: Location) => void;
  locationHistory: Location[];
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [watchId, setWatchId] = useState<number | null>(null);
  
  const { isAuthenticated, user } = useAuth();
  const { emit, isConnected } = useSocket();

  useEffect(() => {
    if (!isAuthenticated) {
      stopTracking();
    }
  }, [isAuthenticated]);

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'FieldSync Location Permission',
            message: 'FieldSync needs access to your location for tracking and geofencing features.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    }
    return true; // iOS handles permissions automatically
  };

  const startTracking = async (): Promise<boolean> => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is required for this feature.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Get initial position
      Geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          
          setCurrentLocation(location);
          updateLocationHistory(location);
          sendLocationUpdate(location);
        },
        (error) => {
          console.error('Failed to get current position:', error);
          Alert.alert(
            'Location Error',
            'Failed to get your current location. Please try again.',
            [{ text: 'OK' }]
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );

      // Start watching position
      const id = Geolocation.watchPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          
          setCurrentLocation(location);
          updateLocationHistory(location);
          sendLocationUpdate(location);
        },
        (error) => {
          console.error('Location watch error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 10000,
          distanceFilter: 10, // Update only when moved 10 meters
        }
      );

      setWatchId(id);
      setIsTracking(true);
      console.log('✅ Location tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      return false;
    }
  };

  const stopTracking = () => {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
    console.log('🛑 Location tracking stopped');
  };

  const updateLocationHistory = (location: Location) => {
    setLocationHistory(prev => {
      const newHistory = [location, ...prev].slice(0, 100); // Keep last 100 locations
      return newHistory;
    });
  };

  const sendLocationUpdate = async (location: Location) => {
    try {
      // Send via Socket.io for real-time updates
      if (isConnected && user) {
        emit('location:update', {
          userId: user.id,
          location,
          timestamp: new Date().toISOString(),
        });
      }

      // Also send to API for persistence
      await ApiService.updateLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date(location.timestamp).toISOString(),
      });
    } catch (error) {
      console.error('Failed to send location update:', error);
    }
  };

  const updateLocation = (location: Location) => {
    setCurrentLocation(location);
    updateLocationHistory(location);
    sendLocationUpdate(location);
  };

  const value: LocationContextType = {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    updateLocation,
    locationHistory,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
