import { Router } from 'express';
import { getMeetings, createMeeting, updateMeeting, deleteMeeting } from '../modules/meeting';
import meetingMinutesController from '../modules/meetingMinutes';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// === BASIC MEETING ROUTES ===

// Get all meetings (Supervisor, Admin, FieldTech)
router.get('/', requireAuth, requireRole(['Supervisor', 'Admin', 'FieldTech']), getMeetings);

// Create meeting (Supervisor, Admin)
router.post('/', requireAuth, requireRole(['Supervisor', 'Admin']), createMeeting);

// Update meeting (Supervisor, Admin)
router.put('/:id', requireAuth, requireRole(['Supervisor', 'Admin']), updateMeeting);

// Delete meeting (Admin)
router.delete('/:id', requireAuth, requireRole(['Admin']), deleteMeeting);

// === MEETING MINUTES ROUTES ===

// Create meeting minutes (Supervisor, Admin)
router.post('/minutes', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.createMeetingMinutes);

// Get all meeting minutes with filtering and pagination
router.get('/minutes', requireAuth, requireRole(['Supervisor', 'Admin', 'FieldTech']), meetingMinutesController.getAllMeetingMinutes);

// Get specific meeting minutes
router.get('/minutes/:id', requireAuth, requireRole(['Supervisor', 'Admin', 'FieldTech']), meetingMinutesController.getMeetingMinutes);

// Update meeting minutes (Supervisor, Admin)
router.put('/minutes/:id', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.updateMeetingMinutes);

// === RECORDING ROUTES ===

// Start meeting recording (Supervisor, Admin)
router.post('/minutes/:id/recording/start', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.startMeetingRecording);

// Stop meeting recording (Supervisor, Admin)
router.post('/minutes/:id/recording/stop', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.stopMeetingRecording);

// === DISCUSSION & CONTENT ROUTES ===

// Add discussion point during meeting (Supervisor, Admin, FieldTech)
router.post('/minutes/:id/discussions', requireAuth, requireRole(['Supervisor', 'Admin', 'FieldTech']), meetingMinutesController.addDiscussionPoint);

// Add decision to meeting (Supervisor, Admin)
router.post('/minutes/:id/decisions', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.addDecision);

// === ACTION ITEMS ROUTES ===

// Add action item to meeting (Supervisor, Admin)
router.post('/minutes/:id/action-items', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.addActionItem);

// Update action item (Supervisor, Admin, FieldTech - if assigned)
router.put('/minutes/:id/action-items/:actionItemId', requireAuth, requireRole(['Supervisor', 'Admin', 'FieldTech']), meetingMinutesController.updateActionItem);

// Get user's action items across all meetings (All authenticated users)
router.get('/action-items/user/:userId', requireAuth, meetingMinutesController.getUserActionItems);

// === TEMPLATE ROUTES ===

// Create meeting template (Admin)
router.post('/templates', requireAuth, requireRole(['Admin']), meetingMinutesController.createMeetingTemplate);

// Get meeting templates (Supervisor, Admin)
router.get('/templates', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.getMeetingTemplates);

// === ANALYTICS & REPORTING ROUTES ===

// Get meeting analytics (Supervisor, Admin)
router.get('/analytics', requireAuth, requireRole(['Supervisor', 'Admin']), meetingMinutesController.getMeetingAnalytics);

// === SEARCH ROUTES ===

// Advanced search for meetings (Supervisor, Admin, FieldTech)
router.post('/search', requireAuth, requireRole(['Supervisor', 'Admin', 'FieldTech']), meetingMinutesController.searchMeetings);

// === LEGACY ROUTE (for backward compatibility) ===

// Record meeting minutes (legacy - deprecated)
router.post('/record', requireAuth, requireRole(['Supervisor', 'Admin']), (req, res) => {
  const result = meetingMinutesController.recordMeetingMinutes(req.body);
  res.status(200).json({ 
    legacy: true,
    message: 'Legacy endpoint - please use /minutes instead',
    result 
  });
});

export default router;
