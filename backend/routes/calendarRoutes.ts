/**
 * Calendar Integration Routes
 * RESTful API endpoints for calendar and scheduling functionality
 */

import express from 'express';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getUserAvailability,
  suggestMeetingTimes,
  addCalendarProvider,
  syncUserCalendars,
  exportUserCalendar,
  getCalendarAnalytics
} from '../modules/calendarIntegration';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Event Management Routes
router.post('/events', createCalendarEvent);
router.put('/events/:eventId', updateCalendarEvent);
router.delete('/events/:eventId', deleteCalendarEvent);

// Availability and Scheduling Routes
router.get('/users/:userId/availability', getUserAvailability);
router.post('/meetings/suggest', suggestMeetingTimes);

// External Calendar Integration Routes
router.post('/users/:userId/providers', addCalendarProvider);
router.post('/users/:userId/sync', syncUserCalendars);

// Export and Analytics Routes
router.get('/users/:userId/export', exportUserCalendar);
router.get('/users/:userId/analytics', getCalendarAnalytics);

export default router;
