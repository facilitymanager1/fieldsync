/**
 * Enhanced Team Communication Module
 * Real-time messaging with integrated ticket management
 * AI-powered features and location-aware capabilities
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { formatError, formatSuccess, AppError, ErrorCodes, createNotFoundError, createValidationError } from '../utils/errorHandler';
import { 
  Thread, 
  Message, 
  Ticket,
  AISuggestion,
  MessageAttachment,
  Location
} from '../types/standardInterfaces';

// Type guard to ensure user is present
function ensureAuthenticated(req: AuthenticatedRequest): asserts req is AuthenticatedRequest & { user: NonNullable<AuthenticatedRequest['user']> } {
  if (!req.user) {
    throw new AppError('User authentication required', ErrorCodes.UNAUTHORIZED, 401);
  }
}

// MongoDB Schemas for Communication
const ThreadSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['direct', 'group', 'channel'], default: 'group' },
  description: String,
  participants: [{
    userId: { type: String, required: true },
    name: String,
    role: String,
    joinedAt: { type: Date, default: Date.now },
    permissions: {
      canSendMessages: { type: Boolean, default: true },
      canSendMedia: { type: Boolean, default: true },
      canCreateTickets: { type: Boolean, default: true },
      canAssignTickets: { type: Boolean, default: false },
      canDeleteMessages: { type: Boolean, default: false },
      canAddParticipants: { type: Boolean, default: false },
    }
  }],
  admins: [String],
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastMessage: {
    id: String,
    content: String,
    senderId: String,
    timestamp: Date,
  },
  settings: {
    allowTicketCreation: { type: Boolean, default: true },
    autoLocationSharing: { type: Boolean, default: false },
    ephemeralMessages: { type: Boolean, default: false },
    ephemeralDuration: { type: Number, default: 24 }, // hours
    aiAssistanceEnabled: { type: Boolean, default: true },
    smartSuggestionsEnabled: { type: Boolean, default: true },
  },
  relatedTickets: [String],
  relatedLocations: [{
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String,
    timestamp: Date,
  }],
  isActive: { type: Boolean, default: true },
});

const MessageSchema = new mongoose.Schema({
  threadId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: String,
  senderRole: String,
  type: { 
    type: String, 
    enum: ['text', 'image', 'document', 'voice', 'location', 'system', 'ticket'],
    default: 'text'
  },
  content: { type: String, required: true },
  metadata: {
    deliveryStatus: { 
      type: String, 
      enum: ['sending', 'sent', 'delivered', 'read'],
      default: 'sent'
    },
    priority: { 
      type: String, 
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    tags: [String],
    mentionedUsers: [String],
    ticketId: String,
    relatedVisitId: String,
    relatedExpenseId: String,
  },
  timestamp: { type: Date, default: Date.now },
  readBy: [{
    userId: String,
    readAt: Date,
  }],
  reactions: [{
    userId: String,
    emoji: String,
    timestamp: Date,
  }],
  replyTo: String, // Message ID for threaded replies
  edited: { type: Boolean, default: false },
  editedAt: Date,
  deleted: { type: Boolean, default: false },
  ephemeral: { type: Boolean, default: false },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String,
    isLive: Boolean,
    shareUntil: Date,
  },
  attachments: [{
    id: String,
    type: { type: String, enum: ['image', 'document', 'voice', 'video'] },
    url: String,
    filename: String,
    size: Number,
    thumbnail: String,
    duration: Number, // For voice/video
  }],
  aiSuggestions: [{
    id: String,
    type: { type: String, enum: ['quick_reply', 'action', 'location', 'ticket', 'task', 'safety'] },
    content: String,
    action: String,
    confidence: Number,
    contextData: mongoose.Schema.Types.Mixed,
    expiresAt: Date,
  }],
});

const ChatTicketSchema = new mongoose.Schema({
  threadId: { type: String, required: true },
  messageId: String, // Original message that created the ticket
  title: { type: String, required: true },
  description: String,
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
    default: 'open'
  },
  category: String,
  tags: [String],
  createdBy: { type: String, required: true },
  assignedTo: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  dueDate: Date,
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String,
  },
  attachments: [{
    id: String,
    type: String,
    url: String,
    filename: String,
    size: Number,
  }],
  comments: [{
    id: String,
    userId: String,
    userName: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
    type: { 
      type: String, 
      enum: ['comment', 'status_change', 'assignment', 'system'],
      default: 'comment'
    },
    metadata: mongoose.Schema.Types.Mixed,
  }],
  slaInfo: {
    responseTime: Number, // in minutes
    resolutionTime: Number, // in hours
    respondedAt: Date,
    resolvedAt: Date,
    breached: { type: Boolean, default: false },
    escalationLevel: { type: Number, default: 0 },
  },
  relatedMessages: [String],
  aiSuggestions: [{
    id: String,
    type: String,
    content: String,
    confidence: Number,
  }],
});

const UserPresenceSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['online', 'away', 'busy', 'offline'],
    default: 'offline'
  },
  lastSeen: { type: Date, default: Date.now },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: Date,
  },
  isTyping: { type: Boolean, default: false },
  typingIn: String, // Thread ID
  lastActivity: { type: Date, default: Date.now },
});

// Models
const Thread = mongoose.model('Thread', ThreadSchema);
const Message = mongoose.model('Message', MessageSchema);
const ChatTicket = mongoose.model('ChatTicket', ChatTicketSchema);
const UserPresence = mongoose.model('UserPresence', UserPresenceSchema);

// Thread Management Functions
export const createThread = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { participants, name, type = 'group', description } = req.body;
    
    // Validation
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      throw createValidationError('participants', 'At least one participant is required');
    }

    const thread = new Thread({
      name: name || `Chat ${Date.now()}`,
      type,
      description,
      participants: participants.map((userId: string) => ({
        userId,
        name: 'User Name', // Would be fetched from user service
        role: 'Member',
        permissions: {
          canSendMessages: true,
          canSendMedia: true,
          canCreateTickets: true,
          canAssignTickets: false,
          canDeleteMessages: false,
          canAddParticipants: false,
        }
      })),
      admins: [req.user.id],
      createdBy: req.user.id,
      settings: {
        allowTicketCreation: true,
        autoLocationSharing: false,
        ephemeralMessages: false,
        ephemeralDuration: 24,
        aiAssistanceEnabled: true,
        smartSuggestionsEnabled: true,
      },
    });

    await thread.save();

    res.json(formatSuccess(thread, 'Thread created successfully'));
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const getThreads = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const threads = await Thread.find({
      'participants.userId': req.user.id,
      isActive: true,
    }).sort({ updatedAt: -1 });

    res.json(formatSuccess(threads, 'Threads retrieved successfully'));
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const getThreadMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { threadId } = req.params;
    const { limit = 50, before } = req.query;

    const query: any = { 
      threadId, 
      deleted: { $ne: true } 
    };

    if (before) {
      query.timestamp = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json(formatSuccess(messages.reverse(), 'Messages retrieved successfully'));
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

// Message Management Functions
export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { threadId, content, type = 'text', metadata = {}, location, attachments } = req.body;

    // Validation
    if (!threadId) {
      throw createValidationError('threadId', 'Thread ID is required');
    }
    if (!content) {
      throw createValidationError('content', 'Message content is required');
    }

    const message = new Message({
      threadId,
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      type,
      content,
      metadata: {
        deliveryStatus: 'sent',
        priority: 'normal',
        ...metadata,
      },
      location,
      attachments,
      readBy: [{
        userId: req.user.id,
        readAt: new Date(),
      }],
    });

    await message.save();

    // Update thread's last message
    await Thread.findByIdAndUpdate(threadId, {
      lastMessage: {
        id: message._id,
        content: message.content,
        senderId: req.user.id,
        timestamp: message.timestamp,
      },
      updatedAt: new Date(),
    });

    // Generate AI suggestions
    const aiSuggestions = await generateAISuggestionsForMessage(message);
    if (aiSuggestions && aiSuggestions.length > 0) {
      message.aiSuggestions = aiSuggestions as any; // Type cast to handle Mongoose type issue
      await message.save();
    }

    res.json(formatSuccess(message, 'Message sent successfully'));
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const updateMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      throw createValidationError('content', 'Message content is required');
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      throw new AppError('Message not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (message.senderId !== req.user.id) {
      throw new AppError('Not authorized to edit this message', ErrorCodes.FORBIDDEN);
    }

    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    
    await message.save();

    res.json(formatSuccess(message, 'Message updated successfully'));
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const deleteMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    
    if (!message) {
      throw new AppError('Message not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (message.senderId !== req.user.id && req.user.role !== 'Admin') {
      throw new AppError('Not authorized to delete this message', ErrorCodes.FORBIDDEN);
    }

    message.deleted = true;
    message.content = 'This message was deleted';
    
    await message.save();

    res.json(formatSuccess(null, 'Message deleted successfully'));
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const markMessageAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { messageId } = req.params;

    await Message.findByIdAndUpdate(messageId, {
      $addToSet: {
        readBy: {
          userId: req.user.id,
          readAt: new Date(),
        }
      }
    });

    res.json(formatSuccess(null, 'Message marked as read'));
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const addReaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      throw createValidationError('emoji', 'Emoji is required');
    }

    await Message.findByIdAndUpdate(messageId, {
      $addToSet: {
        reactions: {
          userId: req.user.id,
          emoji,
          timestamp: new Date(),
        }
      }
    });

    res.json(formatSuccess(null, 'Reaction added successfully'));
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const searchMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, threadId } = req.query;

    const searchQuery: any = {
      content: { $regex: query, $options: 'i' },
      deleted: { $ne: true },
    };

    if (threadId) {
      searchQuery.threadId = threadId;
    }

    const messages = await Message.find(searchQuery)
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Ticket Management Functions
export const createTicketFromMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { messageId, title, priority = 'medium' } = req.body;

    if (!title) {
      throw createValidationError('title', 'Ticket title is required');
    }

    const message = await Message.findById(messageId);
    if (!message) {
      throw new AppError('Message not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const ticket = new ChatTicket({
      threadId: message.threadId,
      messageId,
      title,
      description: message.content,
      priority,
      createdBy: req.user.id,
      location: message.location,
      relatedMessages: [messageId],
    });

    await ticket.save();

    // Add ticket reference to message (safely check metadata exists)
    if (!message.metadata) {
      message.metadata = {
        deliveryStatus: 'sent',
        priority: 'normal',
        tags: [],
        mentionedUsers: []
      };
    }
    message.metadata.ticketId = ticket._id.toString();
    await message.save();

    res.json(formatSuccess(ticket, 'Ticket created from message successfully'));
  } catch (error) {
    console.error('Error creating ticket from message:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const createTicketInThread = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { threadId, title, description, priority = 'medium', location } = req.body;

    if (!title) {
      throw createValidationError('title', 'Ticket title is required');
    }
    if (!description) {
      throw createValidationError('description', 'Ticket description is required');
    }

    const ticket = new ChatTicket({
      threadId,
      title,
      description,
      priority,
      createdBy: req.user.id,
      location,
    });

    await ticket.save();

    res.json(formatSuccess(ticket, 'Ticket created successfully'));
  } catch (error) {
    console.error('Error creating ticket in thread:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const updateTicketStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { ticketId } = req.params;
    const { status, comment } = req.body;

    if (!status) {
      throw createValidationError('status', 'Ticket status is required');
    }

    const ticket = await ChatTicket.findById(ticketId);
    if (!ticket) {
      throw new AppError('Ticket not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    ticket.status = status;
    ticket.updatedAt = new Date();

    if (comment) {
      ticket.comments.push({
        id: `comment_${Date.now()}`,
        userId: req.user.id,
        userName: req.user.name,
        content: comment,
        type: 'status_change',
      });
    }

    // Update SLA info (safely check slaInfo exists)
    if (status === 'resolved') {
      if (!ticket.slaInfo) {
        ticket.slaInfo = {
          breached: false,
          escalationLevel: 0
        };
      }
      ticket.slaInfo.resolvedAt = new Date();
    }

    await ticket.save();

    res.json(formatSuccess(ticket, 'Ticket status updated successfully'));
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const assignTicket = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { ticketId } = req.params;
    const { assigneeId } = req.body;

    if (!assigneeId) {
      throw createValidationError('assigneeId', 'Assignee ID is required');
    }

    const ticket = await ChatTicket.findById(ticketId);
    if (!ticket) {
      throw new AppError('Ticket not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    ticket.assignedTo = assigneeId;
    ticket.updatedAt = new Date();
    
    ticket.comments.push({
      id: `comment_${Date.now()}`,
      userId: req.user.id,
      userName: req.user.name,
      content: `Ticket assigned to ${assigneeId}`,
      type: 'assignment',
    });

    await ticket.save();

    res.json(formatSuccess({
      ...ticket.toObject(),
      assigneeName: 'Assignee Name', // Would be fetched from user service
    }, 'Ticket assigned successfully'));
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const getThreadTickets = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;

    const tickets = await ChatTicket.find({ threadId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    console.error('Error fetching thread tickets:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const getTicketDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ticketId } = req.params;

    const ticket = await ChatTicket.findById(ticketId).lean();
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const addTicketComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { ticketId } = req.params;
    const { content } = req.body;

    if (!content) {
      throw createValidationError('content', 'Comment content is required');
    }

    const ticket = await ChatTicket.findById(ticketId);
    if (!ticket) {
      throw new AppError('Ticket not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    ticket.comments.push({
      id: `comment_${Date.now()}`,
      userId: req.user.id,
      userName: req.user.name,
      content,
      type: 'comment',
    });

    ticket.updatedAt = new Date();
    await ticket.save();

    res.json(formatSuccess(ticket, 'Comment added successfully'));
  } catch (error) {
    console.error('Error adding ticket comment:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

// AI and Smart Features
export const generateAISuggestions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, userRole, location, threadType } = req.body;

    const suggestions = await generateAISuggestionsForMessage({
      content: message.content,
      type: message.type,
      location,
      senderRole: userRole,
    });

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const getSmartReplies = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    const smartReplies = generateSmartReplies(message.content, message.type);

    res.json({
      success: true,
      data: smartReplies,
    });
  } catch (error) {
    console.error('Error getting smart replies:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Presence and Status Management
export const updateUserPresence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { status, location } = req.body;

    await UserPresence.findOneAndUpdate(
      { userId: req.user.id },
      {
        status,
        lastSeen: new Date(),
        lastActivity: new Date(),
        currentLocation: location,
      },
      { upsert: true }
    );

    res.json(formatSuccess(null, 'Presence updated successfully'));
  } catch (error) {
    console.error('Error updating user presence:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

export const getUserPresence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const presence = await UserPresence.findOne({ userId }).lean();

    res.json({
      success: true,
      data: presence || { userId, status: 'offline', lastSeen: new Date() },
    });
  } catch (error) {
    console.error('Error fetching user presence:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const handleTypingIndicator = async (req: AuthenticatedRequest, res: Response) => {
  try {
    ensureAuthenticated(req);
    const { threadId, isTyping } = req.body;

    await UserPresence.findOneAndUpdate(
      { userId: req.user.id },
      {
        isTyping,
        typingIn: isTyping ? threadId : null,
        lastActivity: new Date(),
      },
      { upsert: true }
    );

    res.json(formatSuccess(null, 'Typing indicator updated'));
  } catch (error) {
    console.error('Error handling typing indicator:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
};

// File Upload and Media
export const uploadAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // File upload logic would be implemented here
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const attachment = {
      id: `attachment_${Date.now()}`,
      type: file.mimetype.startsWith('image/') ? 'image' : 'document',
      url: `/uploads/${file.filename}`,
      filename: file.originalname,
      size: file.size,
    };

    res.json({
      success: true,
      data: attachment,
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const shareLocation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId, latitude, longitude, accuracy, isLive, shareUntil } = req.body;

    const locationData = {
      latitude,
      longitude,
      accuracy,
      isLive,
      shareUntil: shareUntil ? new Date(shareUntil) : undefined,
    };

    res.json({
      success: true,
      data: locationData,
    });
  } catch (error) {
    console.error('Error sharing location:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Utility Functions
const generateAISuggestionsForMessage = async (message: any) => {
  const suggestions = [];

  // Location-based suggestions
  if (message.location) {
    suggestions.push({
      id: `suggestion_${Date.now()}_1`,
      type: 'quick_reply',
      content: "I've arrived at the location",
      confidence: 0.9,
    });
  }

  // Role-based suggestions
  if (message.senderRole === 'FieldTech') {
    suggestions.push({
      id: `suggestion_${Date.now()}_2`,
      type: 'action',
      content: 'Log visit completion',
      action: 'log_visit',
      confidence: 0.85,
    });
  }

  // Content-based suggestions
  if (message.content.toLowerCase().includes('issue') || message.content.toLowerCase().includes('problem')) {
    suggestions.push({
      id: `suggestion_${Date.now()}_3`,
      type: 'ticket',
      content: 'Create support ticket',
      confidence: 0.8,
    });
  }

  return suggestions;
};

const generateSmartReplies = (content: string, type: string) => {
  const baseReplies = [
    'Thanks!',
    'Got it',
    'On my way',
    'Will update soon',
  ];

  // Context-aware replies
  if (content.toLowerCase().includes('location')) {
    return [...baseReplies, 'Sharing my location', 'ETA 10 minutes'];
  }

  if (content.toLowerCase().includes('urgent')) {
    return [...baseReplies, 'Handling immediately', 'Escalating to supervisor'];
  }

  return baseReplies;
};
