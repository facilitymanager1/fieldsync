// Comprehensive Meeting Minutes & Action Items Data Model
import { Schema, Document, model } from 'mongoose';

// Meeting Minutes Interface
export interface IMeetingMinutes extends Document {
  meetingId: string;
  title: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  location: string;
  meetingType: 'standup' | 'planning' | 'review' | 'emergency' | 'training' | 'client' | 'other';
  organizer: {
    userId: string;
    name: string;
    role: string;
  };
  attendees: Array<{
    userId: string;
    name: string;
    role: string;
    status: 'present' | 'absent' | 'late' | 'left_early';
    joinTime?: Date;
    leaveTime?: Date;
  }>;
  agenda: Array<{
    id: string;
    title: string;
    description: string;
    timeAllocated: number; // minutes
    presenter: string;
    completed: boolean;
  }>;
  discussions: Array<{
    id: string;
    agendaItemId?: string;
    topic: string;
    description: string;
    speaker: string;
    timestamp: Date;
    duration: number; // minutes
    tags: string[];
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    description: string;
    assignee: {
      userId: string;
      name: string;
    };
    dueDate: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    relatedDiscussionId?: string;
    dependencies: string[]; // other action item IDs
    estimatedHours: number;
    actualHours?: number;
    completedAt?: Date;
    completedBy?: string;
    notes: string;
  }>;
  decisions: Array<{
    id: string;
    title: string;
    description: string;
    decisionBy: string;
    timestamp: Date;
    rationale: string;
    impact: string;
    relatedDiscussionId?: string;
    votingResults?: {
      option: string;
      votes: number;
    }[];
  }>;
  followUpMeetings: Array<{
    title: string;
    scheduledDate: Date;
    purpose: string;
    requiredAttendees: string[];
  }>;
  attachments: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    uploadedBy: string;
    uploadedAt: Date;
  }>;
  recording?: {
    audioUrl?: string;
    videoUrl?: string;
    transcriptionUrl?: string;
    duration: number; // seconds
    quality: 'low' | 'medium' | 'high';
    status: 'recording' | 'processing' | 'ready' | 'failed';
  };
  transcription?: {
    text: string;
    confidence: number;
    speakers: Array<{
      name: string;
      segments: Array<{
        text: string;
        startTime: number;
        endTime: number;
        confidence: number;
      }>;
    }>;
    keywords: string[];
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  };
  aiSummary?: {
    keyPoints: string[];
    mainDecisions: string[];
    nextSteps: string[];
    sentiment: string;
    effectiveness: number; // 1-10 score
    recommendations: string[];
    generatedAt: Date;
  };
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  visibility: 'public' | 'private' | 'confidential';
  tags: string[];
  metadata: {
    platform: string;
    version: string;
    location?: {
      latitude: number;
      longitude: number;
      address: string;
    };
    weather?: string;
    templateUsed?: string;
  };
  reminders: Array<{
    id: string;
    type: 'action_item_due' | 'follow_up_meeting' | 'review_needed';
    message: string;
    recipientIds: string[];
    scheduledFor: Date;
    sent: boolean;
    sentAt?: Date;
  }>;
  analytics: {
    speakingTime: Record<string, number>; // userId -> minutes
    engagementScore: number;
    participationRate: number;
    onTimeStart: boolean;
    onTimeEnd: boolean;
    actualDuration: number; // minutes
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

// Meeting Template Interface
export interface IMeetingTemplate extends Document {
  name: string;
  description: string;
  category: string;
  estimatedDuration: number; // minutes
  defaultAgenda: Array<{
    title: string;
    description: string;
    timeAllocated: number;
    required: boolean;
  }>;
  requiredRoles: string[];
  defaultReminders: Array<{
    type: string;
    timing: number; // hours before meeting
    message: string;
  }>;
  customFields: Array<{
    name: string;
    type: string;
    required: boolean;
    options?: string[];
  }>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Meeting Series Interface (for recurring meetings)
export interface IMeetingSeries extends Document {
  name: string;
  description: string;
  recurrenceRule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    interval: number;
    daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
    endDate?: Date;
    maxOccurrences?: number;
  };
  templateId?: string;
  organizer: string;
  defaultAttendees: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schemas
const meetingMinutesSchema = new Schema<IMeetingMinutes>({
  meetingId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  location: { type: String, required: true },
  meetingType: { 
    type: String, 
    enum: ['standup', 'planning', 'review', 'emergency', 'training', 'client', 'other'],
    default: 'other'
  },
  organizer: {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  attendees: [{
    userId: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['present', 'absent', 'late', 'left_early'],
      default: 'present'
    },
    joinTime: Date,
    leaveTime: Date
  }],
  agenda: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    timeAllocated: { type: Number, default: 10 },
    presenter: String,
    completed: { type: Boolean, default: false }
  }],
  discussions: [{
    id: { type: String, required: true },
    agendaItemId: String,
    topic: { type: String, required: true },
    description: String,
    speaker: { type: String, required: true },
    timestamp: { type: Date, required: true },
    duration: { type: Number, default: 0 },
    tags: [String]
  }],
  actionItems: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    assignee: {
      userId: { type: String, required: true },
      name: { type: String, required: true }
    },
    dueDate: { type: Date, required: true },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: { 
      type: String, 
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    relatedDiscussionId: String,
    dependencies: [String],
    estimatedHours: { type: Number, default: 1 },
    actualHours: Number,
    completedAt: Date,
    completedBy: String,
    notes: String
  }],
  decisions: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    decisionBy: { type: String, required: true },
    timestamp: { type: Date, required: true },
    rationale: String,
    impact: String,
    relatedDiscussionId: String,
    votingResults: [{
      option: String,
      votes: Number
    }]
  }],
  followUpMeetings: [{
    title: String,
    scheduledDate: Date,
    purpose: String,
    requiredAttendees: [String]
  }],
  attachments: [{
    id: String,
    name: String,
    type: String,
    size: Number,
    url: String,
    uploadedBy: String,
    uploadedAt: Date
  }],
  recording: {
    audioUrl: String,
    videoUrl: String,
    transcriptionUrl: String,
    duration: Number,
    quality: { 
      type: String, 
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    status: { 
      type: String, 
      enum: ['recording', 'processing', 'ready', 'failed'],
      default: 'recording'
    }
  },
  transcription: {
    text: String,
    confidence: Number,
    speakers: [{
      name: String,
      segments: [{
        text: String,
        startTime: Number,
        endTime: Number,
        confidence: Number
      }]
    }],
    keywords: [String],
    summary: String,
    sentiment: { 
      type: String, 
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral'
    }
  },
  aiSummary: {
    keyPoints: [String],
    mainDecisions: [String],
    nextSteps: [String],
    sentiment: String,
    effectiveness: { type: Number, min: 1, max: 10 },
    recommendations: [String],
    generatedAt: Date
  },
  status: { 
    type: String, 
    enum: ['draft', 'in_progress', 'completed', 'cancelled'],
    default: 'draft'
  },
  visibility: { 
    type: String, 
    enum: ['public', 'private', 'confidential'],
    default: 'public'
  },
  tags: [String],
  metadata: {
    platform: String,
    version: String,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    weather: String,
    templateUsed: String
  },
  reminders: [{
    id: String,
    type: { 
      type: String, 
      enum: ['action_item_due', 'follow_up_meeting', 'review_needed']
    },
    message: String,
    recipientIds: [String],
    scheduledFor: Date,
    sent: { type: Boolean, default: false },
    sentAt: Date
  }],
  analytics: {
    speakingTime: { type: Map, of: Number },
    engagementScore: { type: Number, default: 0 },
    participationRate: { type: Number, default: 0 },
    onTimeStart: { type: Boolean, default: true },
    onTimeEnd: { type: Boolean, default: true },
    actualDuration: Number
  },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastAccessedAt: { type: Date, default: Date.now },
  accessCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const meetingTemplateSchema = new Schema<IMeetingTemplate>({
  name: { type: String, required: true, unique: true },
  description: String,
  category: { type: String, required: true },
  estimatedDuration: { type: Number, required: true },
  defaultAgenda: [{
    title: { type: String, required: true },
    description: String,
    timeAllocated: { type: Number, required: true },
    required: { type: Boolean, default: false }
  }],
  requiredRoles: [String],
  defaultReminders: [{
    type: String,
    timing: Number,
    message: String
  }],
  customFields: [{
    name: String,
    type: String,
    required: Boolean,
    options: [String]
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const meetingSeriesSchema = new Schema<IMeetingSeries>({
  name: { type: String, required: true },
  description: String,
  recurrenceRule: {
    frequency: { 
      type: String, 
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      required: true
    },
    interval: { type: Number, required: true, min: 1 },
    daysOfWeek: [Number],
    endDate: Date,
    maxOccurrences: Number
  },
  templateId: String,
  organizer: { type: String, required: true },
  defaultAttendees: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
meetingMinutesSchema.index({ meetingId: 1 });
meetingMinutesSchema.index({ date: -1 });
meetingMinutesSchema.index({ 'organizer.userId': 1 });
meetingMinutesSchema.index({ 'attendees.userId': 1 });
meetingMinutesSchema.index({ status: 1 });
meetingMinutesSchema.index({ tags: 1 });
meetingMinutesSchema.index({ 'actionItems.assignee.userId': 1 });
meetingMinutesSchema.index({ 'actionItems.dueDate': 1 });

meetingTemplateSchema.index({ category: 1 });
meetingTemplateSchema.index({ isActive: 1 });

meetingSeriesSchema.index({ organizer: 1 });
meetingSeriesSchema.index({ isActive: 1 });

// Export models
export const MeetingMinutes = model<IMeetingMinutes>('MeetingMinutes', meetingMinutesSchema);
export const MeetingTemplate = model<IMeetingTemplate>('MeetingTemplate', meetingTemplateSchema);
export const MeetingSeries = model<IMeetingSeries>('MeetingSeries', meetingSeriesSchema);

// Legacy interface for backward compatibility
export interface MeetingMinutes {
  id: string;
  agenda: string;
  attendees: string[];
  items: Array<{ description: string; actionItem?: string; assignee?: string; dueDate?: Date }>;
  reminders: string[];
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}
