// Comprehensive Meeting Minutes & Action Items Management Module
// Features: Recording, transcription, AI summarization, action item tracking, reminders
import { Request, Response } from 'express';
import { 
  MeetingMinutes, 
  MeetingTemplate, 
  MeetingSeries,
  IMeetingMinutes,
  IMeetingTemplate,
  IMeetingSeries 
} from '../models/meetingMinutes';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';

// Authentication interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    name: string;
  };
}

// Service Response Interface
interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

// === MEETING MINUTES CRUD OPERATIONS ===

export const createMeetingMinutes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      date,
      startTime,
      endTime,
      location,
      meetingType,
      attendees,
      agenda,
      templateId
    } = req.body;

    const meetingId = uuidv4();
    
    let agendaItems = agenda || [];
    
    // If template is specified, load default agenda
    if (templateId) {
      const template = await MeetingTemplate.findById(templateId);
      if (template) {
        agendaItems = template.defaultAgenda.map(item => ({
          id: uuidv4(),
          title: item.title,
          description: item.description,
          timeAllocated: item.timeAllocated,
          presenter: '',
          completed: false
        }));
      }
    }

    const meetingMinutes = new MeetingMinutes({
      meetingId,
      title,
      date: new Date(date),
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : undefined,
      location,
      meetingType: meetingType || 'other',
      organizer: {
        userId: req.user!.id,
        name: req.user!.name,
        role: req.user!.role
      },
      attendees: attendees.map((attendee: any) => ({
        userId: attendee.userId,
        name: attendee.name,
        role: attendee.role,
        status: attendee.status || 'present'
      })),
      agenda: agendaItems,
      discussions: [],
      actionItems: [],
      decisions: [],
      followUpMeetings: [],
      attachments: [],
      status: 'draft',
      visibility: 'public',
      tags: [],
      metadata: {
        platform: 'FieldSync',
        version: '1.0',
        templateUsed: templateId
      },
      reminders: [],
      analytics: {
        speakingTime: new Map(),
        engagementScore: 0,
        participationRate: 0,
        onTimeStart: true,
        onTimeEnd: true,
        actualDuration: 0
      },
      createdBy: req.user!.id
    });

    await meetingMinutes.save();

    res.status(201).json({
      success: true,
      data: meetingMinutes,
      message: 'Meeting minutes created successfully'
    });
  } catch (error) {
    console.error('Error creating meeting minutes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create meeting minutes'
    });
  }
};

export const getMeetingMinutes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    // Update access tracking
    meetingMinutes.accessCount += 1;
    meetingMinutes.lastAccessedAt = new Date();
    await meetingMinutes.save();

    res.json({
      success: true,
      data: meetingMinutes
    });
  } catch (error) {
    console.error('Error fetching meeting minutes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting minutes'
    });
  }
};

export const updateMeetingMinutes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'meetingId' && key !== 'createdBy' && key !== 'createdAt') {
        (meetingMinutes as any)[key] = updates[key];
      }
    });

    meetingMinutes.updatedAt = new Date();
    await meetingMinutes.save();

    res.json({
      success: true,
      data: meetingMinutes,
      message: 'Meeting minutes updated successfully'
    });
  } catch (error) {
    console.error('Error updating meeting minutes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update meeting minutes'
    });
  }
};

export const getAllMeetingMinutes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      meetingType,
      attendeeId,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const query: any = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by meeting type
    if (meetingType) {
      query.meetingType = meetingType;
    }

    // Filter by attendee
    if (attendeeId) {
      query['attendees.userId'] = attendeeId;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom as string);
      if (dateTo) query.date.$lte = new Date(dateTo as string);
    }

    // Search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'discussions.description': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [meetingMinutes, total] = await Promise.all([
      MeetingMinutes.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      MeetingMinutes.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        meetingMinutes,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching meeting minutes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting minutes'
    });
  }
};

// === REAL-TIME RECORDING & DISCUSSION TRACKING ===

export const startMeetingRecording = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { recordingType = 'audio', quality = 'medium' } = req.body;

    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    // Initialize recording
    meetingMinutes.recording = {
      audioUrl: recordingType === 'audio' ? `/recordings/${id}_audio.wav` : undefined,
      videoUrl: recordingType === 'video' ? `/recordings/${id}_video.mp4` : undefined,
      duration: 0,
      quality: quality as 'low' | 'medium' | 'high',
      status: 'recording'
    };

    meetingMinutes.status = 'in_progress';
    await meetingMinutes.save();

    res.json({
      success: true,
      data: { recordingStatus: 'started' },
      message: 'Recording started successfully'
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start recording'
    });
  }
};

export const stopMeetingRecording = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { duration } = req.body;

    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    // Update recording status
    if (meetingMinutes.recording) {
      meetingMinutes.recording.status = 'processing';
      meetingMinutes.recording.duration = duration;
    }

    meetingMinutes.endTime = new Date();
    meetingMinutes.analytics.actualDuration = Math.floor(
      (meetingMinutes.endTime.getTime() - meetingMinutes.startTime.getTime()) / 60000
    );

    await meetingMinutes.save();

    // Trigger transcription processing (mock implementation)
    processTranscription(id);

    res.json({
      success: true,
      data: { recordingStatus: 'processing' },
      message: 'Recording stopped and processing started'
    });
  } catch (error) {
    console.error('Error stopping recording:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop recording'
    });
  }
};

export const addDiscussionPoint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { topic, description, agendaItemId, duration = 5, tags = [] } = req.body;

    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    const discussionPoint = {
      id: uuidv4(),
      agendaItemId,
      topic,
      description,
      speaker: req.user!.name,
      timestamp: new Date(),
      duration,
      tags
    };

    meetingMinutes.discussions.push(discussionPoint);
    await meetingMinutes.save();

    res.json({
      success: true,
      data: discussionPoint,
      message: 'Discussion point added successfully'
    });
  } catch (error) {
    console.error('Error adding discussion point:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add discussion point'
    });
  }
};

// === ACTION ITEMS MANAGEMENT ===

export const addActionItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      assigneeId,
      assigneeName,
      dueDate,
      priority = 'medium',
      estimatedHours = 1,
      relatedDiscussionId,
      dependencies = []
    } = req.body;

    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    const actionItem = {
      id: uuidv4(),
      title,
      description,
      assignee: {
        userId: assigneeId,
        name: assigneeName
      },
      dueDate: new Date(dueDate),
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
      status: 'pending' as const,
      relatedDiscussionId,
      dependencies,
      estimatedHours,
      notes: ''
    };

    meetingMinutes.actionItems.push(actionItem);
    await meetingMinutes.save();

    // Schedule reminder
    scheduleActionItemReminder(actionItem, assigneeId);

    res.json({
      success: true,
      data: actionItem,
      message: 'Action item added successfully'
    });
  } catch (error) {
    console.error('Error adding action item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add action item'
    });
  }
};

export const updateActionItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, actionItemId } = req.params;
    const updates = req.body;

    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    const actionItemIndex = meetingMinutes.actionItems.findIndex(
      item => item.id === actionItemId
    );

    if (actionItemIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Action item not found'
      });
      return;
    }

    // Update action item
    const actionItem = meetingMinutes.actionItems[actionItemIndex];
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        (actionItem as any)[key] = updates[key];
      }
    });

    // Track completion
    if (updates.status === 'completed' && actionItem.status !== 'completed') {
      actionItem.completedAt = new Date();
      actionItem.completedBy = req.user!.name;
    }

    await meetingMinutes.save();

    res.json({
      success: true,
      data: actionItem,
      message: 'Action item updated successfully'
    });
  } catch (error) {
    console.error('Error updating action item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update action item'
    });
  }
};

export const getUserActionItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, priority, overdue } = req.query;

    const query: any = {
      'actionItems.assignee.userId': userId
    };

    if (status) {
      query['actionItems.status'] = status;
    }

    const meetings = await MeetingMinutes.find(query);

    let actionItems: any[] = [];

    meetings.forEach(meeting => {
      meeting.actionItems.forEach(item => {
        if (item.assignee.userId === userId) {
          // Apply filters
          if (status && item.status !== status) return;
          if (priority && item.priority !== priority) return;
          if (overdue === 'true' && new Date(item.dueDate) >= new Date()) return;

          actionItems.push({
            ...item.toObject(),
            meetingId: meeting.meetingId,
            meetingTitle: meeting.title,
            meetingDate: meeting.date
          });
        }
      });
    });

    // Sort by due date
    actionItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    res.json({
      success: true,
      data: actionItems
    });
  } catch (error) {
    console.error('Error fetching user action items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action items'
    });
  }
};

// === DECISIONS TRACKING ===

export const addDecision = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      rationale,
      impact,
      relatedDiscussionId,
      votingResults
    } = req.body;

    const meetingMinutes = await MeetingMinutes.findOne({ meetingId: id });
    
    if (!meetingMinutes) {
      res.status(404).json({
        success: false,
        error: 'Meeting minutes not found'
      });
      return;
    }

    const decision = {
      id: uuidv4(),
      title,
      description,
      decisionBy: req.user!.name,
      timestamp: new Date(),
      rationale,
      impact,
      relatedDiscussionId,
      votingResults
    };

    meetingMinutes.decisions.push(decision);
    await meetingMinutes.save();

    res.json({
      success: true,
      data: decision,
      message: 'Decision recorded successfully'
    });
  } catch (error) {
    console.error('Error adding decision:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record decision'
    });
  }
};

// === AI TRANSCRIPTION & SUMMARIZATION ===

const processTranscription = async (meetingId: string): Promise<void> => {
  try {
    // Mock transcription processing
    const meetingMinutes = await MeetingMinutes.findOne({ meetingId });
    
    if (!meetingMinutes) return;

    // Simulate transcription delay
    setTimeout(async () => {
      // Mock transcription result
      const mockTranscription = {
        text: "Mock transcribed content of the meeting...",
        confidence: 0.87,
        speakers: [
          {
            name: "John Doe",
            segments: [
              {
                text: "Welcome everyone to today's meeting",
                startTime: 0,
                endTime: 3,
                confidence: 0.9
              }
            ]
          }
        ],
        keywords: ["project", "deadline", "budget", "team"],
        summary: "Team meeting discussing project progress and upcoming deadlines",
        sentiment: 'positive' as const
      };

      meetingMinutes.transcription = mockTranscription;

      // Generate AI summary
      const aiSummary = await generateAISummary(meetingMinutes);
      meetingMinutes.aiSummary = aiSummary;

      // Update recording status
      if (meetingMinutes.recording) {
        meetingMinutes.recording.status = 'ready';
      }

      await meetingMinutes.save();
    }, 5000); // 5 second delay to simulate processing

  } catch (error) {
    console.error('Error processing transcription:', error);
  }
};

const generateAISummary = async (meetingMinutes: IMeetingMinutes): Promise<any> => {
  // Mock AI summary generation
  return {
    keyPoints: [
      "Project milestone review completed",
      "Budget allocation discussed",
      "Team assignments confirmed"
    ],
    mainDecisions: [
      "Proceed with Phase 2 development",
      "Increase testing team by 2 members"
    ],
    nextSteps: [
      "Complete requirements analysis by next week",
      "Schedule client presentation"
    ],
    sentiment: "positive",
    effectiveness: 8,
    recommendations: [
      "Consider shorter meeting duration",
      "Prepare agenda in advance"
    ],
    generatedAt: new Date()
  };
};

// === MEETING TEMPLATES ===

export const createMeetingTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      category,
      estimatedDuration,
      defaultAgenda,
      requiredRoles,
      defaultReminders,
      customFields
    } = req.body;

    const template = new MeetingTemplate({
      name,
      description,
      category,
      estimatedDuration,
      defaultAgenda,
      requiredRoles,
      defaultReminders,
      customFields,
      createdBy: req.user!.id
    });

    await template.save();

    res.status(201).json({
      success: true,
      data: template,
      message: 'Meeting template created successfully'
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create meeting template'
    });
  }
};

export const getMeetingTemplates = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, active } = req.query;

    const query: any = {};
    if (category) query.category = category;
    if (active !== undefined) query.isActive = active === 'true';

    const templates = await MeetingTemplate.find(query).sort({ name: 1 });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting templates'
    });
  }
};

// === REMINDER SYSTEM ===

const scheduleActionItemReminder = (actionItem: any, assigneeId: string): void => {
  const dueDate = new Date(actionItem.dueDate);
  const reminderDate = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before

  if (reminderDate > new Date()) {
    // Schedule reminder (mock implementation)
    console.log(`Reminder scheduled for action item: ${actionItem.title} on ${reminderDate}`);
  }
};

// === ANALYTICS & REPORTING ===

export const getMeetingAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { period = '30', userId } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(period));

    const query: any = {
      date: { $gte: startDate }
    };

    if (userId) {
      query.$or = [
        { 'organizer.userId': userId },
        { 'attendees.userId': userId }
      ];
    }

    const meetings = await MeetingMinutes.find(query);

    const analytics = {
      totalMeetings: meetings.length,
      totalHours: meetings.reduce((sum, m) => sum + (m.analytics.actualDuration || 0), 0) / 60,
      averageDuration: meetings.length > 0 
        ? meetings.reduce((sum, m) => sum + (m.analytics.actualDuration || 0), 0) / meetings.length 
        : 0,
      meetingsByType: {},
      actionItemsCreated: meetings.reduce((sum, m) => sum + m.actionItems.length, 0),
      actionItemsCompleted: meetings.reduce((sum, m) => 
        sum + m.actionItems.filter(ai => ai.status === 'completed').length, 0),
      averageEngagement: meetings.length > 0
        ? meetings.reduce((sum, m) => sum + m.analytics.engagementScore, 0) / meetings.length
        : 0,
      onTimeStartRate: meetings.length > 0
        ? meetings.filter(m => m.analytics.onTimeStart).length / meetings.length * 100
        : 0
    };

    // Calculate meetings by type
    meetings.forEach(meeting => {
      const type = meeting.meetingType;
      analytics.meetingsByType = {
        ...analytics.meetingsByType,
        [type]: (analytics.meetingsByType as any)[type] ? (analytics.meetingsByType as any)[type] + 1 : 1
      };
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting analytics'
    });
  }
};

// === SEARCH & FILTERING ===

export const searchMeetings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { 
      query: searchQuery, 
      filters = {},
      page = 1,
      limit = 10 
    } = req.body;

    const mongoQuery: any = {};

    // Text search
    if (searchQuery) {
      mongoQuery.$text = { $search: searchQuery };
    }

    // Apply filters
    if (filters.dateRange) {
      mongoQuery.date = {
        $gte: new Date(filters.dateRange.start),
        $lte: new Date(filters.dateRange.end)
      };
    }

    if (filters.meetingType) {
      mongoQuery.meetingType = { $in: filters.meetingType };
    }

    if (filters.status) {
      mongoQuery.status = { $in: filters.status };
    }

    if (filters.attendees) {
      mongoQuery['attendees.userId'] = { $in: filters.attendees };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [results, total] = await Promise.all([
      MeetingMinutes.find(mongoQuery)
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      MeetingMinutes.countDocuments(mongoQuery)
    ]);

    res.json({
      success: true,
      data: {
        results,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error searching meetings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search meetings'
    });
  }
};

// Legacy function for backward compatibility
export function recordMeetingMinutes(minutes: any) {
  console.log('Legacy function called - use createMeetingMinutes instead');
  return { success: false, message: 'Use new API endpoints' };
}

// === CRON JOBS FOR REMINDERS ===

// Check for action items due soon (runs daily at 9 AM)
cron.schedule('0 9 * * *', async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const meetings = await MeetingMinutes.find({
      'actionItems.dueDate': { $lte: tomorrow },
      'actionItems.status': { $in: ['pending', 'in_progress'] }
    });

    for (const meeting of meetings) {
      for (const actionItem of meeting.actionItems) {
        if (actionItem.dueDate <= tomorrow && ['pending', 'in_progress'].includes(actionItem.status)) {
          // Send reminder notification (mock implementation)
          console.log(`Reminder: Action item "${actionItem.title}" is due tomorrow`);
        }
      }
    }
  } catch (error) {
    console.error('Error running reminder cron job:', error);
  }
});

export default {
  createMeetingMinutes,
  getMeetingMinutes,
  updateMeetingMinutes,
  getAllMeetingMinutes,
  startMeetingRecording,
  stopMeetingRecording,
  addDiscussionPoint,
  addActionItem,
  updateActionItem,
  getUserActionItems,
  addDecision,
  createMeetingTemplate,
  getMeetingTemplates,
  getMeetingAnalytics,
  searchMeetings,
  recordMeetingMinutes
};
