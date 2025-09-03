/**
 * Calendar Integration Types
 * Type definitions for calendar integration functionality
 */

export type CalendarProvider = 'google' | 'outlook' | 'apple' | 'exchange';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  provider: CalendarProvider;
  providerEventId: string;
  attendees: string[];
  location?: string;
  isAllDay: boolean;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarIntegration {
  id: string;
  provider: CalendarProvider;
  isActive: boolean;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarSyncResult {
  success: boolean;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
}

export interface CalendarConfig {
  provider: CalendarProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface CalendarEventFilter {
  startDate?: Date;
  endDate?: Date;
  providers?: CalendarProvider[];
  includeAllDay?: boolean;
  searchTerm?: string;
}
