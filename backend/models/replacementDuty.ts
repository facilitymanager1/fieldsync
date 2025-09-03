// Replacement Duty & Contract Rates data model
export interface ReplacementDuty {
  id: string;
  userId: string;
  clientId: string;
  dutyType: 'Standard' | 'Replacement' | 'Overtime';
  contractRate: number;
  approved: boolean;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  updatedAt: Date;
}
