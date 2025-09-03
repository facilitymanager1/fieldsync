// Comprehensive Meeting Minutes & Action Items Tests
// Tests recording, transcription, AI summarization, action item tracking

import request from 'supertest';
import app from '../index';
import { MeetingMinutes, MeetingTemplate } from '../models/meetingMinutes';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Meeting Minutes API', () => {
  let authToken: string;
  let testMeetingId: string;

  beforeEach(async () => {
    // Setup authentication
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@fieldsync.com',
        password: 'admin123'
      });
    
    authToken = authResponse.body.token;

    // Clean up test data
    await MeetingMinutes.deleteMany({});
    await MeetingTemplate.deleteMany({});
  });

  afterEach(async () => {
    // Clean up after tests
    await MeetingMinutes.deleteMany({});
    await MeetingTemplate.deleteMany({});
  });

  describe('POST /api/meetings/minutes', () => {
    it('should create new meeting minutes successfully', async () => {
      const meetingData = {
        title: 'Test Weekly Standup',
        date: new Date().toISOString(),
        startTime: new Date().toISOString(),
        location: 'Conference Room A',
        meetingType: 'standup',
        attendees: [
          {
            userId: 'user1',
            name: 'John Doe',
            role: 'FieldTech',
            status: 'present'
          },
          {
            userId: 'user2',
            name: 'Jane Smith',
            role: 'Supervisor',
            status: 'present'
          }
        ],
        agenda: [
          {
            id: 'agenda1',
            title: 'Project Updates',
            description: 'Review current project status',
            timeAllocated: 15,
            presenter: 'John Doe',
            completed: false
          }
        ]
      };

      const response = await request(app)
        .post('/api/meetings/minutes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(meetingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(meetingData.title);
      expect(response.body.data.attendees).toHaveLength(2);
      expect(response.body.data.agenda).toHaveLength(1);
      expect(response.body.data.status).toBe('draft');

      testMeetingId = response.body.data.meetingId;
    });

    it('should create meeting minutes from template', async () => {
      // First create a template
      const templateData = {
        name: 'Daily Standup Template',
        description: 'Standard daily standup meeting',
        category: 'Agile',
        estimatedDuration: 15,
        defaultAgenda: [
          {
            title: 'Yesterday\'s work',
            description: 'What did you work on yesterday?',
            timeAllocated: 5,
            required: true
          },
          {
            title: 'Today\'s plan',
            description: 'What will you work on today?',
            timeAllocated: 5,
            required: true
          },
          {
            title: 'Blockers',
            description: 'Any blockers or impediments?',
            timeAllocated: 5,
            required: true
          }
        ]
      };

      const templateResponse = await request(app)
        .post('/api/meetings/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      const templateId = templateResponse.body.data._id;

      // Create meeting from template
      const meetingData = {
        title: 'Daily Standup - Team Alpha',
        date: new Date().toISOString(),
        startTime: new Date().toISOString(),
        location: 'Virtual',
        meetingType: 'standup',
        attendees: [
          {
            userId: 'user1',
            name: 'John Doe',
            role: 'FieldTech',
            status: 'present'
          }
        ],
        templateId: templateId
      };

      const response = await request(app)
        .post('/api/meetings/minutes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(meetingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agenda).toHaveLength(3);
      expect(response.body.data.metadata.templateUsed).toBe(templateId);
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        title: 'Test Meeting'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/meetings/minutes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/meetings/minutes', () => {
    beforeEach(async () => {
      // Create test meetings
      const meetings = [
        {
          meetingId: 'test1',
          title: 'Team Meeting 1',
          date: new Date(),
          startTime: new Date(),
          location: 'Room A',
          meetingType: 'standup',
          organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
          attendees: [],
          agenda: [],
          actionItems: [],
          decisions: [],
          followUpMeetings: [],
          attachments: [],
          status: 'completed',
          createdBy: 'admin'
        },
        {
          meetingId: 'test2',
          title: 'Client Review',
          date: new Date(),
          startTime: new Date(),
          location: 'Room B',
          meetingType: 'client',
          organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
          attendees: [],
          agenda: [],
          actionItems: [],
          decisions: [],
          followUpMeetings: [],
          attachments: [],
          status: 'draft',
          createdBy: 'admin'
        }
      ];

      await MeetingMinutes.insertMany(meetings);
    });

    it('should get all meeting minutes with pagination', async () => {
      const response = await request(app)
        .get('/api/meetings/minutes?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.meetingMinutes).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/meetings/minutes?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.meetingMinutes).toHaveLength(1);
      expect(response.body.data.meetingMinutes[0].status).toBe('completed');
    });

    it('should filter by meeting type', async () => {
      const response = await request(app)
        .get('/api/meetings/minutes?meetingType=client')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.meetingMinutes).toHaveLength(1);
      expect(response.body.data.meetingMinutes[0].meetingType).toBe('client');
    });

    it('should search in title and description', async () => {
      const response = await request(app)
        .get('/api/meetings/minutes?search=Team')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.meetingMinutes).toHaveLength(1);
      expect(response.body.data.meetingMinutes[0].title).toContain('Team');
    });
  });

  describe('Recording Features', () => {
    beforeEach(async () => {
      // Create a test meeting
      const meeting = new MeetingMinutes({
        meetingId: 'recording-test',
        title: 'Recording Test Meeting',
        date: new Date(),
        startTime: new Date(),
        location: 'Virtual',
        meetingType: 'other',
        organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
        attendees: [],
        agenda: [],
        actionItems: [],
        decisions: [],
        followUpMeetings: [],
        attachments: [],
        status: 'in_progress',
        createdBy: 'admin'
      });

      await meeting.save();
      testMeetingId = 'recording-test';
    });

    it('should start meeting recording', async () => {
      const response = await request(app)
        .post(`/api/meetings/minutes/${testMeetingId}/recording/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ recordingType: 'audio', quality: 'high' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recordingStatus).toBe('started');

      // Verify recording was initialized
      const meeting = await MeetingMinutes.findOne({ meetingId: testMeetingId });
      expect(meeting?.recording?.status).toBe('recording');
      expect(meeting?.recording?.quality).toBe('high');
    });

    it('should stop meeting recording', async () => {
      // First start recording
      await request(app)
        .post(`/api/meetings/minutes/${testMeetingId}/recording/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ recordingType: 'audio' });

      // Then stop recording
      const response = await request(app)
        .post(`/api/meetings/minutes/${testMeetingId}/recording/stop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ duration: 1800 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recordingStatus).toBe('processing');

      // Verify recording was stopped
      const meeting = await MeetingMinutes.findOne({ meetingId: testMeetingId });
      expect(meeting?.recording?.status).toBe('processing');
      expect(meeting?.recording?.duration).toBe(1800);
    });
  });

  describe('Action Items Management', () => {
    beforeEach(async () => {
      const meeting = new MeetingMinutes({
        meetingId: 'action-test',
        title: 'Action Items Test Meeting',
        date: new Date(),
        startTime: new Date(),
        location: 'Virtual',
        meetingType: 'other',
        organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
        attendees: [],
        agenda: [],
        actionItems: [],
        decisions: [],
        followUpMeetings: [],
        attachments: [],
        status: 'in_progress',
        createdBy: 'admin'
      });

      await meeting.save();
      testMeetingId = 'action-test';
    });

    it('should add action item to meeting', async () => {
      const actionItemData = {
        title: 'Update project documentation',
        description: 'Update the project README and API docs',
        assigneeId: 'user1',
        assigneeName: 'John Doe',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        estimatedHours: 4
      };

      const response = await request(app)
        .post(`/api/meetings/minutes/${testMeetingId}/action-items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(actionItemData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(actionItemData.title);
      expect(response.body.data.priority).toBe(actionItemData.priority);
      expect(response.body.data.status).toBe('pending');

      // Verify action item was added to meeting
      const meeting = await MeetingMinutes.findOne({ meetingId: testMeetingId });
      expect(meeting?.actionItems).toHaveLength(1);
    });

    it('should update action item status', async () => {
      // First add an action item
      const actionItem = {
        id: 'action1',
        title: 'Test Action Item',
        description: 'Test description',
        assignee: { userId: 'user1', name: 'John Doe' },
        dueDate: new Date(),
        priority: 'medium' as const,
        status: 'pending' as const,
        estimatedHours: 2,
        notes: ''
      };

      await MeetingMinutes.updateOne(
        { meetingId: testMeetingId },
        { $push: { actionItems: actionItem } }
      );

      // Update the action item
      const updateData = {
        status: 'completed',
        actualHours: 3,
        notes: 'Completed successfully'
      };

      const response = await request(app)
        .put(`/api/meetings/minutes/${testMeetingId}/action-items/action1`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.completedAt).toBeDefined();
    });

    it('should get user action items across all meetings', async () => {
      // Add action items to multiple meetings
      const meetings = [
        {
          meetingId: 'meeting1',
          title: 'Meeting 1',
          date: new Date(),
          startTime: new Date(),
          location: 'Room A',
          meetingType: 'standup',
          organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
          attendees: [],
          agenda: [],
          actionItems: [
            {
              id: 'action1',
              title: 'Action Item 1',
              description: 'Description 1',
              assignee: { userId: 'user1', name: 'John Doe' },
              dueDate: new Date(),
              priority: 'high' as const,
              status: 'pending' as const,
              estimatedHours: 2,
              notes: ''
            }
          ],
          decisions: [],
          followUpMeetings: [],
          attachments: [],
          status: 'completed',
          createdBy: 'admin'
        },
        {
          meetingId: 'meeting2',
          title: 'Meeting 2',
          date: new Date(),
          startTime: new Date(),
          location: 'Room B',
          meetingType: 'review',
          organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
          attendees: [],
          agenda: [],
          actionItems: [
            {
              id: 'action2',
              title: 'Action Item 2',
              description: 'Description 2',
              assignee: { userId: 'user1', name: 'John Doe' },
              dueDate: new Date(),
              priority: 'medium' as const,
              status: 'in_progress' as const,
              estimatedHours: 3,
              notes: ''
            }
          ],
          decisions: [],
          followUpMeetings: [],
          attachments: [],
          status: 'completed',
          createdBy: 'admin'
        }
      ];

      await MeetingMinutes.insertMany(meetings);

      const response = await request(app)
        .get('/api/meetings/action-items/user/user1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].meetingTitle).toBeDefined();
    });
  });

  describe('Discussion Points', () => {
    beforeEach(async () => {
      const meeting = new MeetingMinutes({
        meetingId: 'discussion-test',
        title: 'Discussion Test Meeting',
        date: new Date(),
        startTime: new Date(),
        location: 'Virtual',
        meetingType: 'other',
        organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
        attendees: [],
        agenda: [],
        actionItems: [],
        decisions: [],
        followUpMeetings: [],
        attachments: [],
        status: 'in_progress',
        createdBy: 'admin'
      });

      await meeting.save();
      testMeetingId = 'discussion-test';
    });

    it('should add discussion point', async () => {
      const discussionData = {
        topic: 'Budget allocation concerns',
        description: 'Discussion about Q4 budget constraints and resource allocation',
        duration: 10,
        tags: ['budget', 'resources', 'Q4']
      };

      const response = await request(app)
        .post(`/api/meetings/minutes/${testMeetingId}/discussions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(discussionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.topic).toBe(discussionData.topic);
      expect(response.body.data.tags).toEqual(discussionData.tags);

      // Verify discussion was added
      const meeting = await MeetingMinutes.findOne({ meetingId: testMeetingId });
      expect(meeting?.discussions).toHaveLength(1);
    });
  });

  describe('Decisions Tracking', () => {
    beforeEach(async () => {
      const meeting = new MeetingMinutes({
        meetingId: 'decision-test',
        title: 'Decision Test Meeting',
        date: new Date(),
        startTime: new Date(),
        location: 'Virtual',
        meetingType: 'other',
        organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
        attendees: [],
        agenda: [],
        actionItems: [],
        decisions: [],
        followUpMeetings: [],
        attachments: [],
        status: 'in_progress',
        createdBy: 'admin'
      });

      await meeting.save();
      testMeetingId = 'decision-test';
    });

    it('should record decision', async () => {
      const decisionData = {
        title: 'Approve new vendor contract',
        description: 'Decision to proceed with Vendor X for cloud services',
        rationale: 'Best price-performance ratio and excellent support',
        impact: 'Reduce infrastructure costs by 20%',
        votingResults: [
          { option: 'Approve', votes: 5 },
          { option: 'Reject', votes: 1 }
        ]
      };

      const response = await request(app)
        .post(`/api/meetings/minutes/${testMeetingId}/decisions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(decisionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(decisionData.title);
      expect(response.body.data.votingResults).toHaveLength(2);

      // Verify decision was recorded
      const meeting = await MeetingMinutes.findOne({ meetingId: testMeetingId });
      expect(meeting?.decisions).toHaveLength(1);
    });
  });

  describe('Meeting Templates', () => {
    it('should create meeting template', async () => {
      const templateData = {
        name: 'Sprint Planning Template',
        description: 'Template for Agile sprint planning meetings',
        category: 'Agile',
        estimatedDuration: 120,
        defaultAgenda: [
          {
            title: 'Sprint Goal',
            description: 'Define the sprint goal and objectives',
            timeAllocated: 20,
            required: true
          },
          {
            title: 'Backlog Review',
            description: 'Review and prioritize backlog items',
            timeAllocated: 60,
            required: true
          },
          {
            title: 'Task Estimation',
            description: 'Estimate effort for selected items',
            timeAllocated: 40,
            required: true
          }
        ],
        requiredRoles: ['Product Owner', 'Scrum Master', 'Developer'],
        defaultReminders: [
          {
            type: 'preparation',
            timing: 24,
            message: 'Please review backlog items before tomorrow\'s sprint planning'
          }
        ]
      };

      const response = await request(app)
        .post('/api/meetings/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(templateData.name);
      expect(response.body.data.defaultAgenda).toHaveLength(3);
    });

    it('should get meeting templates', async () => {
      // Create test templates
      const templates = [
        {
          name: 'Daily Standup',
          description: 'Daily team standup meeting',
          category: 'Agile',
          estimatedDuration: 15,
          defaultAgenda: [],
          requiredRoles: [],
          defaultReminders: [],
          customFields: [],
          createdBy: 'admin'
        },
        {
          name: 'Client Review',
          description: 'Client review and feedback session',
          category: 'Client',
          estimatedDuration: 60,
          defaultAgenda: [],
          requiredRoles: [],
          defaultReminders: [],
          customFields: [],
          createdBy: 'admin'
        }
      ];

      await MeetingTemplate.insertMany(templates);

      const response = await request(app)
        .get('/api/meetings/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter templates by category', async () => {
      const templates = [
        {
          name: 'Daily Standup',
          category: 'Agile',
          estimatedDuration: 15,
          defaultAgenda: [],
          requiredRoles: [],
          defaultReminders: [],
          customFields: [],
          createdBy: 'admin'
        },
        {
          name: 'Client Review',
          category: 'Client',
          estimatedDuration: 60,
          defaultAgenda: [],
          requiredRoles: [],
          defaultReminders: [],
          customFields: [],
          createdBy: 'admin'
        }
      ];

      await MeetingTemplate.insertMany(templates);

      const response = await request(app)
        .get('/api/meetings/templates?category=Agile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe('Agile');
    });
  });

  describe('Analytics', () => {
    beforeEach(async () => {
      // Create test meetings with analytics data
      const meetings = [
        {
          meetingId: 'analytics1',
          title: 'Team Meeting 1',
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          location: 'Room A',
          meetingType: 'standup',
          organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
          attendees: [],
          agenda: [],
          actionItems: [
            {
              id: 'action1',
              title: 'Task 1',
              description: 'Description',
              assignee: { userId: 'user1', name: 'John Doe' },
              dueDate: new Date(),
              priority: 'high' as const,
              status: 'completed' as const,
              estimatedHours: 2,
              notes: ''
            }
          ],
          decisions: [],
          followUpMeetings: [],
          attachments: [],
          status: 'completed',
          analytics: {
            speakingTime: new Map([['user1', 10], ['user2', 15]]),
            engagementScore: 8,
            participationRate: 90,
            onTimeStart: true,
            onTimeEnd: true,
            actualDuration: 25
          },
          createdBy: 'admin'
        },
        {
          meetingId: 'analytics2',
          title: 'Client Review',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          location: 'Room B',
          meetingType: 'client',
          organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
          attendees: [],
          agenda: [],
          actionItems: [
            {
              id: 'action2',
              title: 'Task 2',
              description: 'Description',
              assignee: { userId: 'user1', name: 'John Doe' },
              dueDate: new Date(),
              priority: 'medium' as const,
              status: 'pending' as const,
              estimatedHours: 3,
              notes: ''
            }
          ],
          decisions: [],
          followUpMeetings: [],
          attachments: [],
          status: 'completed',
          analytics: {
            speakingTime: new Map([['user1', 20], ['user2', 30]]),
            engagementScore: 7,
            participationRate: 80,
            onTimeStart: false,
            onTimeEnd: true,
            actualDuration: 65
          },
          createdBy: 'admin'
        }
      ];

      await MeetingMinutes.insertMany(meetings);
    });

    it('should get meeting analytics', async () => {
      const response = await request(app)
        .get('/api/meetings/analytics?period=7')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalMeetings).toBe(2);
      expect(response.body.data.actionItemsCreated).toBe(2);
      expect(response.body.data.actionItemsCompleted).toBe(1);
      expect(response.body.data.onTimeStartRate).toBe(50); // 1 out of 2 meetings
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      const meetings = [
        {
          meetingId: 'search1',
          title: 'Important Project Review',
          date: new Date(),
          startTime: new Date(),
          location: 'Room A',
          meetingType: 'review',
          organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
          attendees: [{ userId: 'user1', name: 'John Doe', role: 'FieldTech', status: 'present' }],
          agenda: [],
          actionItems: [],
          decisions: [],
          followUpMeetings: [],
          attachments: [],
          discussions: [
            {
              id: 'disc1',
              topic: 'Budget constraints',
              description: 'Discussion about budget limitations for the project',
              speaker: 'John Doe',
              timestamp: new Date(),
              duration: 10,
              tags: ['budget', 'project']
            }
          ],
          status: 'completed',
          createdBy: 'admin'
        }
      ];

      await MeetingMinutes.insertMany(meetings);
    });

    it('should search meetings by content', async () => {
      const searchData = {
        query: 'project budget',
        filters: {
          meetingType: ['review'],
          status: ['completed']
        },
        page: 1,
        limit: 10
      };

      const response = await request(app)
        .post('/api/meetings/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send(searchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].title).toContain('Project');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent meeting ID', async () => {
      const response = await request(app)
        .get('/api/meetings/minutes/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Meeting minutes not found');
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/api/meetings/minutes')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid action item ID', async () => {
      // Create a test meeting first
      const meeting = new MeetingMinutes({
        meetingId: 'error-test',
        title: 'Error Test Meeting',
        date: new Date(),
        startTime: new Date(),
        location: 'Virtual',
        meetingType: 'other',
        organizer: { userId: 'admin', name: 'Admin User', role: 'Admin' },
        attendees: [],
        agenda: [],
        actionItems: [],
        decisions: [],
        followUpMeetings: [],
        attachments: [],
        status: 'draft',
        createdBy: 'admin'
      });

      await meeting.save();

      const response = await request(app)
        .put('/api/meetings/minutes/error-test/action-items/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Action item not found');
    });
  });
});

export {};
