// Sync & Reconciliation payload data model
export interface SyncPayload {
  id: string;
  userId: string;
  shiftId: string;
  odometerEntries: string[]; // OdometerEntry ids
  locationBatchIds: string[];
  siteLogs: any[];
  attachments: string[];
  syncedAt: Date;
}
