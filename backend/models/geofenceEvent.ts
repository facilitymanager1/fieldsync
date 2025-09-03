// Geofence event data model
export interface GeofenceEvent {
  id: string;
  userId: string;
  siteId: string;
  eventType: 'enter' | 'exit';
  timestamp: Date;
  location: { lat: number; lng: number };
}
