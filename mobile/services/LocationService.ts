// Location Service for FieldSync Mobile App
// Handles GPS tracking, geofencing, and location-based features

import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import ApiService from './ApiService';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  heading: number;
  speed: number;
  timestamp: number;
}

export interface GeofenceRegion {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
}

export interface LocationBatch {
  locations: LocationData[];
  startTime: number;
  endTime: number;
  deviceId: string;
}

class LocationService {
  private watchId: number | null = null;
  private locationBuffer: LocationData[] = [];
  private geofences: GeofenceRegion[] = [];
  private trackingState: boolean = false;
  private batchInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadGeofences();
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ]);

        return (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted' ||
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION] === 'granted'
        );
      } else {
        return new Promise((resolve) => {
          Geolocation.requestAuthorization('whenInUse')
            .then((result: any) => {
              resolve(result === 'granted');
            })
            .catch(() => resolve(false));
        });
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Location permission is required for attendance tracking');
      return null;
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position: any) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || 0,
            heading: position.coords.heading || 0,
            speed: position.coords.speed || 0,
            timestamp: position.timestamp,
          };
          resolve(location);
        },
        (error: any) => {
          console.error('Location error:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  async startTracking(): Promise<boolean> {
    if (this.trackingState) return true;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;

    this.watchId = Geolocation.watchPosition(
      (position: any) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || 0,
          heading: position.coords.heading || 0,
          speed: position.coords.speed || 0,
          timestamp: position.timestamp,
        };

        this.addLocationToBuffer(location);
        this.checkGeofences(location);
      },
      (error: any) => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // meters
        interval: 30000, // 30 seconds
        fastestInterval: 15000, // 15 seconds
      }
    );

    this.trackingState = true;
    this.startBatchingTimer();
    return true;
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    this.trackingState = false;
    
    // Flush remaining locations
    if (this.locationBuffer.length > 0) {
      this.flushLocationBuffer();
    }
  }

  private addLocationToBuffer(location: LocationData): void {
    this.locationBuffer.push(location);

    // Auto-flush if buffer gets too large
    if (this.locationBuffer.length >= 50) {
      this.flushLocationBuffer();
    }
  }

  private startBatchingTimer(): void {
    // Flush location buffer every 5 minutes
    this.batchInterval = setInterval(() => {
      this.flushLocationBuffer();
    }, 5 * 60 * 1000);
  }

  private async flushLocationBuffer(): Promise<void> {
    if (this.locationBuffer.length === 0) return;

    try {
      const batch: LocationBatch = {
        locations: [...this.locationBuffer],
        startTime: this.locationBuffer[0].timestamp,
        endTime: this.locationBuffer[this.locationBuffer.length - 1].timestamp,
        deviceId: await this.getDeviceId(),
      };

      const response = await ApiService.submitLocationBatch(batch.locations);
      
      if (response.success) {
        console.log(`Flushed ${this.locationBuffer.length} locations`);
        this.locationBuffer = [];
      } else {
        console.error('Failed to flush location buffer:', response.error);
      }
    } catch (error) {
      console.error('Location buffer flush error:', error);
    }
  }

  private async loadGeofences(): Promise<void> {
    try {
      const response = await ApiService.getGeofences();
      if (response.success && response.data) {
        this.geofences = response.data;
        console.log(`Loaded ${this.geofences.length} geofences`);
      }
    } catch (error) {
      console.error('Failed to load geofences:', error);
    }
  }

  private checkGeofences(location: LocationData): void {
    this.geofences.forEach((geofence) => {
      if (!geofence.isActive) return;

      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        geofence.latitude,
        geofence.longitude
      );

      const isInside = distance <= geofence.radius;
      
      // Check if this is an entry or exit event
      // In a real implementation, you'd track previous state
      this.handleGeofenceEvent(geofence, location, isInside ? 'enter' : 'exit');
    });
  }

  private async handleGeofenceEvent(
    geofence: GeofenceRegion,
    location: LocationData,
    event: 'enter' | 'exit'
  ): Promise<void> {
    try {
      console.log(`Geofence ${event}: ${geofence.name}`);
      
      const response = await ApiService.checkGeofenceEntry({
        geofenceId: geofence.id,
        event,
        location,
        timestamp: Date.now(),
      });

      if (response.success) {
        // Show notification or trigger actions based on geofence event
        this.showGeofenceNotification(geofence, event);
      }
    } catch (error) {
      console.error('Geofence event handling error:', error);
    }
  }

  private showGeofenceNotification(geofence: GeofenceRegion, event: 'enter' | 'exit'): void {
    const message = event === 'enter' 
      ? `Entered ${geofence.name}` 
      : `Left ${geofence.name}`;
    
    // In a real app, you'd use push notifications
    console.log(`Geofence notification: ${message}`);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async getDeviceId(): Promise<string> {
    // In production, use a proper device ID library
    return 'mobile_device_' + Date.now();
  }

  // Public utility methods
  isTracking(): boolean {
    return this.trackingState;
  }

  getBufferSize(): number {
    return this.locationBuffer.length;
  }

  async refreshGeofences(): Promise<void> {
    await this.loadGeofences();
  }

  getGeofences(): GeofenceRegion[] {
    return [...this.geofences];
  }
}

export default new LocationService();
