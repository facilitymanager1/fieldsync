// SLA & Compliance Engine data model
export interface SlaTemplate {
  id: string;
  name: string;
  responseHours: number;
  resolutionHours: number;
  escalationContacts: string[];
  createdAt: Date;
  updatedAt: Date;
}
