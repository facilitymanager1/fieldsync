// Odometer reading and photo verification data model
export interface OdometerEntry {
  id: string;
  userId: string;
  shiftId: string;
  reading: number;
  photoUrl: string;
  ocrText: string;
  verified: boolean;
  createdAt: Date;
}
