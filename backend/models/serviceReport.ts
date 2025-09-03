// Service Reporting & Checklists data model
import { Attachment } from './attachment';

export interface ServiceReport {
  id: string;
  userId: string;
  department: string;
  checklist: Array<{ item: string; completed: boolean; notes?: string }>;
  photos: string[];
  signatures: string[];
  notes: string;
  status: 'draft' | 'submitted';
  createdAt: Date;
  updatedAt: Date;
  attachments?: Attachment[];
}
