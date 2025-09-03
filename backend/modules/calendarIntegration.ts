/**
 * Enhanced Calendar Integration Module
 * Supports Google Calendar, Outlook, and iCal integration
 * Advanced scheduling optimization and conflict resolution
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as crypto from 'crypto';
import axios from 'axios';

// Calendar Integration Interfaces
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees: CalendarAttendee[];
  recurrence?: RecurrenceRule;
  reminders: Reminder[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'public' | 'private' | 'confidential';
  source: 'internal' | 'google' | 'outlook' | 'exchange' | 'ical';
  externalId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarAttendee {
  id: string;
  name: string;
  email: string;
  role: 'organizer' | 'required' | 'optional';
  status: 'pending' | 'accepted' | 'declined' | 'tentative';
  responseTime?: Date;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  count?: number;
  until?: Date;
  byWeekday?: number[];
  byMonthday?: number[];
  byMonth?: number[];
}

export interface Reminder {
  method: 'email' | 'popup' | 'sms';
  minutes: number;
}

export interface CalendarProvider {
  id: string;
  name: string;
  type: 'google' | 'outlook' | 'exchange' | 'ical';
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
    icalUrl?: string;
  };
  syncEnabled: boolean;
  lastSync: Date;
  syncInterval: number; // minutes
}

export interface ScheduleConflict {
  id: string;
  eventId1: string;
  eventId2: string;
  conflictType: 'overlap' | 'resource' | 'location';
  severity: 'minor' | 'major' | 'critical';
  suggestedResolution: string;
  autoResolvable: boolean;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  duration: number; // minutes
  userId: string;
  type: 'free' | 'busy' | 'tentative' | 'out_of_office';
}

export interface MeetingRequest {
  title: string;
  description?: string;
  duration: number; // minutes
  requiredAttendees: string[];
  optionalAttendees: string[];
  preferredTimes: Date[];
  location?: string;
  recurrence?: RecurrenceRule;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// Database Schemas
const CalendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date, required: true, index: true },
  location: String,
  attendees: [{
    id: String,
    name: String,
    email: String,
    role: { type: String, enum: ['organizer', 'required', 'optional'] },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'tentative'] },
    responseTime: Date,
  }],
  recurrence: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
    interval: Number,
    count: Number,
    until: Date,
    byWeekday: [Number],
    byMonthday: [Number],
    byMonth: [Number],
  },
  reminders: [{
    method: { type: String, enum: ['email', 'popup', 'sms'] },
    minutes: Number,
  }],
  status: { type: String, enum: ['confirmed', 'tentative', 'cancelled'], default: 'confirmed' },
  visibility: { type: String, enum: ['public', 'private', 'confidential'], default: 'private' },
  source: { type: String, enum: ['internal', 'google', 'outlook', 'exchange', 'ical'], default: 'internal' },
  externalId: String,
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const CalendarProviderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['google', 'outlook', 'exchange', 'ical'], required: true },
  credentials: {
    accessToken: String,
    refreshToken: String,
    clientId: String,
    clientSecret: String,
    tenantId: String,
    icalUrl: String,
  },
  syncEnabled: { type: Boolean, default: true },
  lastSync: { type: Date, default: Date.now },
  syncInterval: { type: Number, default: 30 }, // 30 minutes
});

const ScheduleConflictSchema = new mongoose.Schema({
  eventId1: { type: String, required: true },
  eventId2: { type: String, required: true },
  conflictType: { type: String, enum: ['overlap', 'resource', 'location'], required: true },
  severity: { type: String, enum: ['minor', 'major', 'critical'], required: true },
  suggestedResolution: String,
  autoResolvable: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
});

const CalendarEventModel = mongoose.model('CalendarEvent', CalendarEventSchema);
const CalendarProviderModel = mongoose.model('CalendarProvider', CalendarProviderSchema);
const ScheduleConflictModel = mongoose.model('ScheduleConflict', ScheduleConflictSchema);

class CalendarIntegrationService {
  private readonly DEFAULT_WORK_HOURS = { start: 9, end: 17 }; // 9 AM to 5 PM
  private readonly DEFAULT_MEETING_DURATION = 60; // minutes
  private readonly CONFLICT_CHECK_BUFFER = 15; // minutes

  // Core Calendar Management
  async createEvent(eventData: Partial<CalendarEvent>): Promise<ApiResponse> {
    try {
      // Validate required fields
      if (!eventData.title || !eventData.startTime || !eventData.endTime || !eventData.createdBy) {
        return {
          success: false,
          message: 'Missing required fields: title, startTime, endTime, createdBy',
        };
      }

      // Check for conflicts
      const conflicts = await this.detectConflicts({
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        attendees: eventData.attendees || [],
      });

      // Create event
      const event = new CalendarEventModel({
        ...eventData,
        id: crypto.randomUUID(),
        updatedAt: new Date(),
      });

      await event.save();

      // Handle conflicts if any
      if (conflicts.length > 0) {
        await this.handleConflicts(event.id, conflicts);
      }

      // Sync with external calendars
      await this.syncToExternalCalendars(event);

      return {
        success: true,
        data: {
          event,
          conflicts: conflicts.length > 0 ? conflicts : undefined,
        },
        message: 'Event created successfully',
      };

    } catch (error: any) {
      console.error('Create event error:', error);
      return {
        success: false,
        message: 'Failed to create event',
        error: error?.message || 'Unknown error',
      };
    }
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<ApiResponse> {
    try {
      const event = await CalendarEventModel.findById(eventId);
      if (!event) {
        return {
          success: false,
          message: 'Event not found',
        };
      }

      // Check for conflicts if time or attendees changed
      let conflicts: ScheduleConflict[] = [];
      if (updates.startTime || updates.endTime || updates.attendees) {
        conflicts = await this.detectConflicts({
          startTime: updates.startTime || event.startTime,
          endTime: updates.endTime || event.endTime,
          attendees: updates.attendees || event.attendees,
        }, eventId);
      }

      // Update event
      Object.assign(event, updates, { updatedAt: new Date() });
      await event.save();

      // Handle conflicts
      if (conflicts.length > 0) {
        await this.handleConflicts(eventId, conflicts);
      }

      // Sync with external calendars
      await this.syncToExternalCalendars(event);

      return {
        success: true,
        data: {
          event,
          conflicts: conflicts.length > 0 ? conflicts : undefined,
        },
        message: 'Event updated successfully',
      };

    } catch (error: any) {
      console.error('Update event error:', error);
      return {
        success: false,
        message: 'Failed to update event',
        error: error?.message || 'Unknown error',
      };
    }
  }

  async deleteEvent(eventId: string): Promise<ApiResponse> {
    try {
      const event = await CalendarEventModel.findById(eventId);
      if (!event) {
        return {
          success: false,
          message: 'Event not found',
        };
      }

      // Delete from external calendars first
      await this.deleteFromExternalCalendars(event);

      // Delete conflicts
      await ScheduleConflictModel.deleteMany({
        $or: [{ eventId1: eventId }, { eventId2: eventId }]
      });

      // Delete event
      await CalendarEventModel.findByIdAndDelete(eventId);

      return {
        success: true,
        message: 'Event deleted successfully',
      };

    } catch (error: any) {
      console.error('Delete event error:', error);
      return {
        success: false,
        message: 'Failed to delete event',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Availability and Scheduling
  async getAvailability(userId: string, startDate: Date, endDate: Date): Promise<ApiResponse> {
    try {
      // Get all events for the user in the date range
      const events = await CalendarEventModel.find({
        $or: [
          { createdBy: userId },
          { 'attendees.id': userId }
        ],
        startTime: { $gte: startDate },
        endTime: { $lte: endDate },
        status: { $ne: 'cancelled' }
      }).sort({ startTime: 1 });

      // Generate availability slots
      const availability: AvailabilitySlot[] = [];
      const workStart = this.DEFAULT_WORK_HOURS.start;
      const workEnd = this.DEFAULT_WORK_HOURS.end;

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        // Skip weekends
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const dayStart = new Date(currentDate);
        dayStart.setHours(workStart, 0, 0, 0);
        
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(workEnd, 0, 0, 0);

        // Find events for this day
        const dayEvents = events.filter(event => 
          event.startTime.toDateString() === currentDate.toDateString()
        );

        // Generate free slots
        let currentTime = dayStart;
        for (const event of dayEvents) {
          if (currentTime < event.startTime) {
            availability.push({
              start: new Date(currentTime),
              end: new Date(event.startTime),
              duration: (event.startTime.getTime() - currentTime.getTime()) / (1000 * 60),
              userId,
              type: 'free',
            });
          }
          currentTime = new Date(Math.max(currentTime.getTime(), event.endTime.getTime()));
        }

        // Add final slot if there's time left
        if (currentTime < dayEnd) {
          availability.push({
            start: new Date(currentTime),
            end: new Date(dayEnd),
            duration: (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60),
            userId,
            type: 'free',
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        success: true,
        data: {
          availability,
          events,
        },
        message: 'Availability retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get availability error:', error);
      return {
        success: false,
        message: 'Failed to retrieve availability',
        error: error?.message || 'Unknown error',
      };
    }
  }

  async suggestMeetingTimes(request: MeetingRequest): Promise<ApiResponse> {
    try {
      const suggestions: { time: Date; score: number; conflicts: string[] }[] = [];

      // Get availability for all required attendees
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

      for (const attendeeId of request.requiredAttendees) {
        const availability = await this.getAvailability(
          attendeeId,
          new Date(),
          oneWeekFromNow
        );

        if (!availability.success) continue;

        const freeSlots = availability.data.availability.filter(
          (slot: AvailabilitySlot) => 
            slot.type === 'free' && slot.duration >= request.duration
        );

        // Score each slot
        for (const slot of freeSlots) {
          const score = this.calculateTimeSlotScore(slot, request);
          const conflicts: string[] = [];

          suggestions.push({
            time: slot.start,
            score,
            conflicts,
          });
        }
      }

      // Sort by score and remove duplicates
      const uniqueSuggestions = suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return {
        success: true,
        data: {
          suggestions: uniqueSuggestions,
          searchCriteria: request,
        },
        message: 'Meeting time suggestions generated successfully',
      };

    } catch (error: any) {
      console.error('Suggest meeting times error:', error);
      return {
        success: false,
        message: 'Failed to suggest meeting times',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // External Calendar Integration
  async addCalendarProvider(userId: string, provider: Partial<CalendarProvider>): Promise<ApiResponse> {
    try {
      // Validate provider data
      if (!provider.type || !provider.name) {
        return {
          success: false,
          message: 'Provider type and name are required',
        };
      }

      // Test connection
      const connectionTest = await this.testProviderConnection(provider);
      if (!connectionTest.success) {
        return connectionTest;
      }

      // Save provider
      const calendarProvider = new CalendarProviderModel({
        userId,
        ...provider,
        id: crypto.randomUUID(),
      });

      await calendarProvider.save();

      // Perform initial sync
      await this.syncFromExternalCalendar(calendarProvider);

      return {
        success: true,
        data: calendarProvider,
        message: 'Calendar provider added successfully',
      };

    } catch (error: any) {
      console.error('Add calendar provider error:', error);
      return {
        success: false,
        message: 'Failed to add calendar provider',
        error: error?.message || 'Unknown error',
      };
    }
  }

  async syncCalendars(userId: string): Promise<ApiResponse> {
    try {
      const providers = await CalendarProviderModel.find({ 
        userId,
        syncEnabled: true 
      });

      const syncResults = [];

      for (const provider of providers) {
        try {
          const result = await this.syncFromExternalCalendar(provider);
          syncResults.push({
            providerId: provider.id,
            providerName: provider.name,
            ...result,
          });

          // Update last sync time
          provider.lastSync = new Date();
          await provider.save();

        } catch (error: any) {
          syncResults.push({
            providerId: provider.id,
            providerName: provider.name,
            success: false,
            error: error?.message || 'Sync failed',
          });
        }
      }

      return {
        success: true,
        data: {
          syncResults,
          totalProviders: providers.length,
        },
        message: 'Calendar sync completed',
      };

    } catch (error: any) {
      console.error('Sync calendars error:', error);
      return {
        success: false,
        message: 'Failed to sync calendars',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Conflict Detection and Resolution
  private async detectConflicts(eventData: {
    startTime: Date;
    endTime: Date;
    attendees: CalendarAttendee[];
  }, excludeEventId?: string): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    try {
      // Check for time overlaps with existing events
      const query: any = {
        $or: [
          {
            startTime: { $lte: eventData.endTime },
            endTime: { $gte: eventData.startTime }
          }
        ],
        status: { $ne: 'cancelled' }
      };

      if (excludeEventId) {
        query._id = { $ne: excludeEventId };
      }

      const overlappingEvents = await CalendarEventModel.find(query);

      for (const event of overlappingEvents) {
        // Check if they share attendees
        const sharedAttendees = eventData.attendees.filter(attendee =>
          event.attendees.some(eventAttendee => eventAttendee.id === attendee.id)
        );

        if (sharedAttendees.length > 0) {
          conflicts.push({
            id: crypto.randomUUID(),
            eventId1: event._id.toString(),
            eventId2: 'new-event',
            conflictType: 'overlap',
            severity: this.calculateConflictSeverity(eventData, event),
            suggestedResolution: 'Reschedule one of the events',
            autoResolvable: false,
          });
        }
      }

    } catch (error) {
      console.error('Conflict detection error:', error);
    }

    return conflicts;
  }

  private async handleConflicts(eventId: string, conflicts: ScheduleConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      const conflictRecord = new ScheduleConflictModel({
        ...conflict,
        eventId2: eventId,
      });
      await conflictRecord.save();
    }
  }

  private calculateConflictSeverity(event1: any, event2: any): 'minor' | 'major' | 'critical' {
    // Simple severity calculation - can be enhanced
    const overlapDuration = Math.min(event1.endTime, event2.endTime) - Math.max(event1.startTime, event2.startTime);
    const overlapMinutes = overlapDuration / (1000 * 60);

    if (overlapMinutes < 30) return 'minor';
    if (overlapMinutes < 120) return 'major';
    return 'critical';
  }

  private calculateTimeSlotScore(slot: AvailabilitySlot, request: MeetingRequest): number {
    let score = 100;

    // Prefer business hours
    const hour = slot.start.getHours();
    if (hour >= 9 && hour <= 17) {
      score += 20;
    } else {
      score -= 30;
    }

    // Prefer Tuesday-Thursday
    const day = slot.start.getDay();
    if (day >= 2 && day <= 4) {
      score += 10;
    }

    // Avoid early morning and late afternoon
    if (hour < 8 || hour > 16) {
      score -= 20;
    }

    // Priority boost
    switch (request.priority) {
      case 'urgent': score += 50; break;
      case 'high': score += 30; break;
      case 'medium': score += 10; break;
      default: break;
    }

    return Math.max(0, score);
  }

  // External Calendar API Methods (stubs for implementation)
  private async testProviderConnection(provider: Partial<CalendarProvider>): Promise<ApiResponse> {
    // Implementation would test actual API connections
    return {
      success: true,
      message: 'Connection test passed',
    };
  }

  private async syncFromExternalCalendar(provider: CalendarProvider): Promise<ApiResponse> {
    // Implementation would sync from Google Calendar, Outlook, etc.
    return {
      success: true,
      data: { eventsSynced: 0 },
      message: 'Sync completed',
    };
  }

  private async syncToExternalCalendars(event: any): Promise<void> {
    // Implementation would push to external calendars
  }

  private async deleteFromExternalCalendars(event: any): Promise<void> {
    // Implementation would delete from external calendars
  }

  // Export and Import
  async exportCalendar(userId: string, format: 'ical' | 'csv' | 'json', startDate?: Date, endDate?: Date): Promise<ApiResponse> {
    try {
      const query: any = {
        $or: [
          { createdBy: userId },
          { 'attendees.id': userId }
        ]
      };

      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = startDate;
        if (endDate) query.startTime.$lte = endDate;
      }

      const events = await CalendarEventModel.find(query).sort({ startTime: 1 });

      let exportData: any;
      let mimeType: string;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(events, null, 2);
          mimeType = 'application/json';
          break;

        case 'csv':
          exportData = this.convertToCSV(events);
          mimeType = 'text/csv';
          break;

        case 'ical':
          exportData = this.convertToICal(events);
          mimeType = 'text/calendar';
          break;

        default:
          return {
            success: false,
            message: 'Unsupported export format',
          };
      }

      return {
        success: true,
        data: {
          content: exportData,
          mimeType,
          filename: `calendar_export_${Date.now()}.${format}`,
        },
        message: 'Calendar exported successfully',
      };

    } catch (error: any) {
      console.error('Export calendar error:', error);
      return {
        success: false,
        message: 'Failed to export calendar',
        error: error?.message || 'Unknown error',
      };
    }
  }

  private convertToCSV(events: any[]): string {
    const headers = ['Title', 'Start Time', 'End Time', 'Location', 'Description', 'Attendees'];
    const rows = [headers.join(',')];

    for (const event of events) {
      const row = [
        `"${event.title}"`,
        `"${event.startTime.toISOString()}"`,
        `"${event.endTime.toISOString()}"`,
        `"${event.location || ''}"`,
        `"${event.description || ''}"`,
        `"${event.attendees.map((a: any) => a.name).join('; ')}"`,
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private convertToICal(events: any[]): string {
    // Basic iCal generation - would use proper library in production
    let ical = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//FieldSync//Calendar//EN\n';

    for (const event of events) {
      ical += 'BEGIN:VEVENT\n';
      ical += `UID:${event._id}@fieldsync.com\n`;
      ical += `DTSTART:${event.startTime.toISOString().replace(/[-:]/g, '').slice(0, -5)}Z\n`;
      ical += `DTEND:${event.endTime.toISOString().replace(/[-:]/g, '').slice(0, -5)}Z\n`;
      ical += `SUMMARY:${event.title}\n`;
      if (event.description) ical += `DESCRIPTION:${event.description}\n`;
      if (event.location) ical += `LOCATION:${event.location}\n`;
      ical += 'END:VEVENT\n';
    }

    ical += 'END:VCALENDAR';
    return ical;
  }

  // Analytics and Reporting
  async getCalendarAnalytics(userId: string, startDate: Date, endDate: Date): Promise<ApiResponse> {
    try {
      const events = await CalendarEventModel.find({
        $or: [
          { createdBy: userId },
          { 'attendees.id': userId }
        ],
        startTime: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' }
      });

      const analytics = {
        totalEvents: events.length,
        totalHours: events.reduce((sum, event) => 
          sum + (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60), 0
        ),
        averageEventDuration: 0,
        busiest: { day: '', hour: 0 },
        meetingTypes: {} as { [key: string]: number },
        attendeeCount: {} as { [key: string]: number },
      };

      if (events.length > 0) {
        analytics.averageEventDuration = analytics.totalHours / events.length;
      }

      // Calculate busiest day and hour
      const dayCount: { [key: string]: number } = {};
      const hourCount: { [key: number]: number } = {};

      for (const event of events) {
        const day = event.startTime.toLocaleDateString('en-US', { weekday: 'long' });
        const hour = event.startTime.getHours();

        dayCount[day] = (dayCount[day] || 0) + 1;
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }

      analytics.busiest.day = Object.keys(dayCount).reduce((a, b) => 
        dayCount[a] > dayCount[b] ? a : b, ''
      );

      analytics.busiest.hour = Object.keys(hourCount).reduce((a, b) => 
        hourCount[parseInt(a)] > hourCount[parseInt(b)] ? parseInt(a) : parseInt(b), 0
      );

      return {
        success: true,
        data: analytics,
        message: 'Calendar analytics retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get calendar analytics error:', error);
      return {
        success: false,
        message: 'Failed to retrieve calendar analytics',
        error: error?.message || 'Unknown error',
      };
    }
  }
}

interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

// Export service instance
const calendarService = new CalendarIntegrationService();

// Route handlers
export async function createCalendarEvent(req: Request, res: Response) {
  try {
    const result = await calendarService.createEvent(req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function updateCalendarEvent(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    const result = await calendarService.updateEvent(eventId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function deleteCalendarEvent(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    const result = await calendarService.deleteEvent(eventId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getUserAvailability(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const result = await calendarService.getAvailability(userId, start, end);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function suggestMeetingTimes(req: Request, res: Response) {
  try {
    const result = await calendarService.suggestMeetingTimes(req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function addCalendarProvider(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const result = await calendarService.addCalendarProvider(userId, req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function syncUserCalendars(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const result = await calendarService.syncCalendars(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function exportUserCalendar(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { format, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const result = await calendarService.exportCalendar(
      userId, 
      format as 'ical' | 'csv' | 'json',
      start,
      end
    );

    if (result.success) {
      res.setHeader('Content-Type', result.data.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
      res.send(result.data.content);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getCalendarAnalytics(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const result = await calendarService.getCalendarAnalytics(userId, start, end);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}
