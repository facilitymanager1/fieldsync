import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useSocket } from '../context/SocketContext';
import ApiService from '../services/ApiServiceNew';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface LocationHistory {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  timestamp: string;
  accuracy: number;
  speed?: number;
}

interface GeofenceZone {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
}

const LocationTrackingScreen: React.FC = () => {
  const { user } = useAuth();
  const {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    locationHistory,
  } = useLocation();
  const { isConnected } = useSocket();

  const [geofences, setGeofences] = useState<GeofenceZone[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeGeofence, setActiveGeofence] = useState<string | null>(null);

  useEffect(() => {
    loadGeofences();
  }, []);

  useEffect(() => {
    // Check geofence entry when location changes
    if (currentLocation && geofences.length > 0) {
      checkGeofenceEntry(currentLocation);
    }
  }, [currentLocation, geofences]);

  const loadGeofences = async () => {
    try {
      const data = await ApiService.getGeofences();
      setGeofences(data || mockGeofences);
    } catch (error) {
      console.error('Failed to load geofences:', error);
      setGeofences(mockGeofences);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadGeofences();
    setIsRefreshing(false);
  };

  const checkGeofenceEntry = async (location: { latitude: number; longitude: number }) => {
    try {
      for (const geofence of geofences) {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          geofence.latitude,
          geofence.longitude
        );

        if (distance <= geofence.radius && activeGeofence !== geofence.id) {
          setActiveGeofence(geofence.id);
          
          // Notify backend about geofence entry
          await ApiService.checkGeofenceEntry({
            geofenceId: geofence.id,
            userId: user?.id,
            location: location,
            timestamp: new Date().toISOString(),
          });

          Alert.alert(
            'Geofence Entry',
            `You've entered ${geofence.name}`,
            [{ text: 'OK' }]
          );
        } else if (distance > geofence.radius && activeGeofence === geofence.id) {
          setActiveGeofence(null);
          Alert.alert(
            'Geofence Exit',
            `You've left ${geofence.name}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Failed to check geofence entry:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleToggleTracking = () => {
    if (isTracking) {
      Alert.alert(
        'Stop Tracking',
        'Are you sure you want to stop location tracking?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Stop', onPress: stopTracking },
        ]
      );
    } else {
      startTracking();
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const renderCurrentLocationCard = () => (
    <View style={styles.locationCard}>
      <View style={styles.locationHeader}>
        <Icon name="my-location" size={24} color="#007AFF" />
        <Text style={styles.locationTitle}>Current Location</Text>
        <View style={[styles.statusIndicator, { backgroundColor: isTracking ? '#4CAF50' : '#F44336' }]} />
      </View>
      
      {currentLocation ? (
        <View style={styles.locationDetails}>
          <Text style={styles.coordinates}>
            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
          <Text style={styles.accuracy}>
            Accuracy: ±{currentLocation.accuracy?.toFixed(0) || 'Unknown'}m
          </Text>
          <Text style={styles.timestamp}>
            Last updated: {formatTime(new Date(currentLocation.timestamp).toISOString())}
          </Text>
        </View>
      ) : (
        <Text style={styles.noLocationText}>
          {isTracking ? 'Getting location...' : 'Location tracking disabled'}
        </Text>
      )}
    </View>
  );

  const renderTrackingControls = () => (
    <View style={styles.controlsContainer}>
      <TouchableOpacity
        style={[
          styles.trackingButton,
          { backgroundColor: isTracking ? '#F44336' : '#4CAF50' },
        ]}
        onPress={handleToggleTracking}
      >
        <Icon
          name={isTracking ? 'location-off' : 'location-on'}
          size={24}
          color="#FFFFFF"
        />
        <Text style={styles.trackingButtonText}>
          {isTracking ? 'Stop Tracking' : 'Start Tracking'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderGeofenceItem = ({ item }: { item: GeofenceZone }) => (
    <View style={[
      styles.geofenceCard,
      activeGeofence === item.id && styles.activeGeofenceCard,
    ]}>
      <View style={styles.geofenceHeader}>
        <Icon
          name="place"
          size={20}
          color={activeGeofence === item.id ? '#4CAF50' : '#666'}
        />
        <Text style={[
          styles.geofenceName,
          activeGeofence === item.id && styles.activeGeofenceName,
        ]}>
          {item.name}
        </Text>
        {activeGeofence === item.id && (
          <View style={styles.activeIndicator}>
            <Text style={styles.activeText}>ACTIVE</Text>
          </View>
        )}
      </View>
      <Text style={styles.geofenceDescription}>{item.description}</Text>
      <Text style={styles.geofenceRadius}>Radius: {item.radius}m</Text>
    </View>
  );

  const renderLocationHistoryItem = ({ item }: { item: LocationHistory }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <Icon name="history" size={20} color="#666" />
        <Text style={styles.historyTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <Text style={styles.historyCoordinates}>
        {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
      </Text>
      {item.address && (
        <Text style={styles.historyAddress}>{item.address}</Text>
      )}
      <Text style={styles.historyAccuracy}>
        Accuracy: ±{item.accuracy.toFixed(0)}m
      </Text>
    </View>
  );

  const mockGeofences: GeofenceZone[] = [
    {
      id: '1',
      name: 'Main Office',
      description: 'Corporate headquarters building',
      latitude: 40.7128,
      longitude: -74.0060,
      radius: 100,
      isActive: true,
    },
    {
      id: '2',
      name: 'Warehouse A',
      description: 'Primary storage facility',
      latitude: 40.7589,
      longitude: -73.9851,
      radius: 150,
      isActive: true,
    },
    {
      id: '3',
      name: 'Client Site - ABC Corp',
      description: 'Regular maintenance location',
      latitude: 40.7831,
      longitude: -73.9712,
      radius: 75,
      isActive: true,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Location Tracking</Text>
          <Text style={styles.subtitle}>Real-time location monitoring</Text>
        </View>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Current Location */}
      {renderCurrentLocationCard()}

      {/* Tracking Controls */}
      {renderTrackingControls()}

      {/* Geofences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Geofence Zones</Text>
        <FlatList
          data={geofences}
          renderItem={renderGeofenceItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No geofence zones configured</Text>
          }
        />
      </View>

      {/* Location History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Locations</Text>
        <FlatList
          data={locationHistory.slice(0, 10).map((location, index) => ({
            id: `${index}`,
            latitude: location.latitude,
            longitude: location.longitude,
            address: 'Address not available',
            timestamp: new Date(location.timestamp).toISOString(),
            accuracy: location.accuracy || 0,
          }))} // Convert Location to LocationHistory format
          renderItem={renderLocationHistoryItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No location history available</Text>
          }
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationDetails: {
    marginTop: 8,
  },
  coordinates: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  accuracy: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  speed: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  noLocationText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 4,
  },
  controlsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  trackingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  geofenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
  },
  activeGeofenceCard: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  geofenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  geofenceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  activeGeofenceName: {
    color: '#2E7D32',
  },
  activeIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  geofenceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  geofenceRadius: {
    fontSize: 12,
    color: '#999',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  historyCoordinates: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  historyAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  historyAccuracy: {
    fontSize: 11,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    padding: 20,
  },
});

export default LocationTrackingScreen;
