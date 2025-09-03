// Passive location batch data model
export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  activity: 'IN_VEHICLE' | 'STATIONARY' | 'ON_FOOT' | 'UNKNOWN';
}

export interface LocationBatch {
  id: string;
  userId: string;
  points: LocationPoint[];
  flushedAt: Date;
}
