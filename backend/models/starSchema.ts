// Star schema and event schemas for FieldSync data model
// See AGENT.md Data Model section

export interface FactWorkEvent {
  id: string;
  staffId: string;
  managerId: string;
  clientId: string;
  siteId: string;
  dutyType: string;
  timeId: string;
  eventType: string;
  eventData: any;
  timestamp: Date;
}

export interface DimStaff {
  id: string;
  name: string;
  role: string;
  // ...other fields
}

export interface DimManager {
  id: string;
  name: string;
  // ...other fields
}

export interface DimClient {
  id: string;
  name: string;
  // ...other fields
}

export interface DimSite {
  id: string;
  name: string;
  location: string;
  // ...other fields
}

export interface DimDutyType {
  id: string;
  type: 'Standard' | 'Replacement' | 'Overtime';
}

export interface DimTime {
  id: string;
  date: string;
  // ...other fields
}

export interface ContractRates {
  id: string;
  clientId: string;
  dutyType: string;
  rate: number;
}

export interface SlaTemplate {
  id: string;
  name: string;
  responseHours: number;
  resolutionHours: number;
  escalationPolicy: string;
}

// Event schemas
export interface WorkOrderCreated {
  id: string;
  workOrderId: string;
  createdBy: string;
  createdAt: Date;
}

export interface ResponseEvent {
  id: string;
  workOrderId: string;
  responderId: string;
  respondedAt: Date;
}

export interface ResolveEvent {
  id: string;
  workOrderId: string;
  resolverId: string;
  resolvedAt: Date;
}

export interface ReplacementStarted {
  id: string;
  staffId: string;
  startTime: Date;
}

export interface AttendanceEvent {
  id: string;
  staffId: string;
  eventType: string;
  eventTime: Date;
}

export interface ReferralMade {
  id: string;
  staffId: string;
  referralCode: string;
  createdAt: Date;
}
