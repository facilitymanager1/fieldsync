/**
 * Centralized Entity Type Definitions for FieldSync Frontend
 * Eliminates interface duplication across components
 */

export interface BaseEntity {
  id: string;
  _id?: string; // MongoDB compatibility
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseEntity {
  email: string;
  role: UserRole;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
  };
}

export type UserRole = 'FieldTech' | 'Supervisor' | 'Admin' | 'Client' | 'SiteStaff';

export interface Ticket extends BaseEntity {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'created' | 'assigned' | 'in-progress' | 'resolved' | 'closed';
  ticketNumber?: number;
  createdBy: string | User;
  assignedTo?: string | User;
  client?: string;
  attachments?: Attachment[];
}

export interface Staff extends BaseEntity {
  name: string;
  email: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive';
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  contentType?: string;
  size?: number;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedAPIResponse<T = any> extends APIResponse<T[]> {
  pagination?: {
    current: number;
    pages: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}