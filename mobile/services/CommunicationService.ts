import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import ApiService from './ApiService';
import LocationService from './LocationService';

// Core Message Interfaces
export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'voice' | 'video' | 'system';
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: MessageMetadata;
  readBy: ReadReceipt[];
  reactions: MessageReaction[];
  replyTo?: string; // Message ID for threaded replies
  edited?: boolean;
  editedAt?: Date;
  deleted?: boolean;
  ephemeral?: boolean; // Auto-delete messages
  location?: LocationData;
  attachments?: Attachment[];
  aiSuggestions?: AISuggestion[];
}

export interface MessageMetadata {
  deviceInfo?: string;
  appVersion?: string;
  locationAccuracy?: number;
  batteryLevel?: number;
  networkType?: string;
  encryptionKey?: string;
  deliveryReceipt?: boolean;
  readReceipt?: boolean;
}

export interface ReadReceipt {
  userId: string;
  readAt: Date;
  userName: string;
}

export interface MessageReaction {
  userId: string;
  userName: string;
  reaction: string; // emoji
  timestamp: Date;
}

export interface ConversationThread {
  id: string;
  name?: string;
  type: 'direct' | 'group' | 'broadcast' | 'channel';
  participants: ThreadParticipant[];
  lastMessage?: Message;
  lastActivity: Date;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  settings: ThreadSettings;
  metadata?: ThreadMetadata;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreadParticipant {
  userId: string;
  userName: string;
  role: 'admin' | 'member' | 'guest';
  joinedAt: Date;
  lastSeen?: Date;
  isOnline: boolean;
  permissions: string[];
}

export interface ThreadSettings {
  allowTicketCreation: boolean;
  autoLocationSharing: boolean;
  ephemeralMessages: boolean;
  ephemeralDuration: number; // hours
  aiAssistanceEnabled: boolean;
  smartSuggestionsEnabled: boolean;
}

export interface ThreadMetadata {
  relatedTickets?: string[];
  linkedProjects?: string[];
  geofenceId?: string;
  shiftId?: string;
  customFields?: Record<string, any>;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
  address?: string;
  placeId?: string;
  isLive?: boolean; // For live location sharing
  expiresAt?: Date; // For live location expiry
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  localPath?: string;
  uploadProgress?: number;
  metadata?: Record<string, any>;
}

export interface TicketFromMessage {
  id: string;
  messageId: string;
  threadId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  dueDate?: Date;
  attachments?: string[];
  location?: LocationData;
  relatedMessages: string[];
}

export interface AISuggestion {
  id: string;
  type: 'reply' | 'action' | 'ticket' | 'schedule' | 'location';
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
  relevantContext?: string[];
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  activity: string;
  location?: LocationData;
  deviceInfo?: string;
}

export interface VoiceMessage {
  id: string;
  duration: number; // in seconds
  waveform?: number[]; // Audio waveform data
  transcription?: string;
  language?: string;
  url: string;
  localPath?: string;
}

class CommunicationService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageQueue: Message[] = [];
  private currentUser: any = null;
  private presenceTimer: NodeJS.Timeout | null = null;
  private typingTimer: NodeJS.Timeout | null = null;
  private locationService = LocationService;

  // Event listeners
  private messageListeners: ((message: Message) => void)[] = [];
  private presenceListeners: ((presence: UserPresence) => void)[] = [];
  private typingListeners: ((data: { threadId: string; userId: string; isTyping: boolean }) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private threadUpdateListeners: ((thread: ConversationThread) => void)[] = [];

  constructor() {
    this.initializeCurrentUser();
  }

  private async initializeCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem('current_user');
      if (userData) {
        this.currentUser = JSON.parse(userData);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  }

  // Socket Connection Management
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      this.socket = io('http://localhost:3001', {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
      });

      this.setupSocketListeners();
      await this.processMessageQueue();
      
    } catch (error) {
      console.error('Socket connection failed:', error);
      throw error;
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionListeners(true);
      this.startPresenceUpdates();
      this.processMessageQueue();
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected = false;
      this.notifyConnectionListeners(false);
      this.stopPresenceUpdates();
    });

    this.socket.on('message', (message: Message) => {
      this.notifyMessageListeners(message);
    });

    this.socket.on('presence_update', (presence: UserPresence) => {
      this.notifyPresenceListeners(presence);
    });

    this.socket.on('typing', (data: { threadId: string; userId: string; isTyping: boolean }) => {
      this.notifyTypingListeners(data);
    });

    this.socket.on('thread_updated', (thread: ConversationThread) => {
      this.notifyThreadUpdateListeners(thread);
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.stopPresenceUpdates();
  }

  // Message Operations
  async sendMessage(threadId: string, content: string, type: Message['type'] = 'text', options?: {
    replyTo?: string;
    priority?: Message['priority'];
    ephemeral?: boolean;
    location?: LocationData;
    attachments?: Attachment[];
  }): Promise<Message> {
    const message: Message = {
      id: this.generateMessageId(),
      threadId,
      senderId: this.currentUser?.id || 'unknown',
      senderName: this.currentUser?.name || 'Unknown User',
      content,
      type,
      timestamp: new Date(),
      status: 'sending',
      priority: options?.priority || 'normal',
      readBy: [],
      reactions: [],
      replyTo: options?.replyTo,
      ephemeral: options?.ephemeral,
      location: options?.location,
      attachments: options?.attachments || [],
      aiSuggestions: [],
    };

    try {
      // Add to queue if not connected
      if (!this.isConnected) {
        this.messageQueue.push(message);
        return message;
      }

      // Send via Socket.IO for real-time delivery
      if (this.socket) {
        this.socket.emit('send_message', message);
      }

      // Also send via REST API for persistence
      const response = await ApiService.sendMessage(message);
      
      if (response.success) {
        message.status = 'sent';
        message.id = response.data.id; // Use server-generated ID
      } else {
        message.status = 'failed';
        throw new Error(response.error || 'Failed to send message');
      }

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      message.status = 'failed';
      throw error;
    }
  }

  async editMessage(messageId: string, newContent: string): Promise<boolean> {
    try {
      const response = await ApiService.updateMessage(messageId, {
        content: newContent,
        edited: true,
        editedAt: new Date(),
      });

      if (response.success && this.socket) {
        this.socket.emit('message_edited', { messageId, newContent });
      }

      return response.success;
    } catch (error) {
      console.error('Error editing message:', error);
      return false;
    }
  }

  async deleteMessage(messageId: string, deleteForEveryone = false): Promise<boolean> {
    try {
      const response = await ApiService.deleteMessage(messageId);

      if (response.success && this.socket) {
        this.socket.emit('message_deleted', { messageId, deleteForEveryone });
      }

      return response.success;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      const response = await ApiService.markMessageAsRead(messageId);

      if (response.success && this.socket) {
        this.socket.emit('message_read', { messageId, userId: this.currentUser?.id });
      }

      return response.success;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  // Thread Management
  async createThread(participants: string[], name?: string, type: ConversationThread['type'] = 'group'): Promise<ConversationThread> {
    try {
      const response = await ApiService.createThread({
        participants,
        name,
        type,
        createdBy: this.currentUser.id,
        settings: {
          allowTicketCreation: true,
          autoLocationSharing: false,
          ephemeralMessages: false,
          ephemeralDuration: 24,
          aiAssistanceEnabled: true,
          smartSuggestionsEnabled: true,
        },
      });

      if (response.success) {
        const thread = response.data;
        
        // Join the socket room for real-time updates
        if (this.socket) {
          this.socket.emit('join_thread', thread.id);
        }

        return thread;
      }
      
      throw new Error(response.error || 'Failed to create thread');
    } catch (error) {
      console.error('Error creating thread:', error);
      throw error;
    }
  }

  async getThreads(): Promise<ConversationThread[]> {
    try {
      const response = await ApiService.getThreads();
      return response.data || [];
    } catch (error) {
      console.error('Error fetching threads:', error);
      return [];
    }
  }

  async getMessages(threadId: string, limit: number = 50, before?: string): Promise<Message[]> {
    try {
      const response = await ApiService.getThreadMessages(threadId, {
        params: { limit, before },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async searchMessages(query: string, threadId?: string): Promise<Message[]> {
    try {
      const response = await ApiService.searchMessages({
        params: { q: query, threadId },
      });
      return response.data || [];
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  // Ticket Integration
  async createTicketFromMessage(messageId: string, ticketData: Partial<TicketFromMessage>): Promise<TicketFromMessage> {
    try {
      const response = await ApiService.createTicketFromMessage({
        messageId,
        ...ticketData,
        createdBy: this.currentUser?.id,
      });

      if (response.success) {
        return response.data;
      }
      
      throw new Error(response.error || 'Failed to create ticket');
    } catch (error) {
      console.error('Error creating ticket from message:', error);
      throw error;
    }
  }

  async createQuickTicket(threadId: string, title: string, description: string, priority: TicketFromMessage['priority'] = 'medium'): Promise<TicketFromMessage> {
    try {
      const location = await this.getCurrentLocation();
      
      const response = await ApiService.createChatTicket({
        threadId,
        title,
        description,
        priority,
        category: 'general',
        status: 'open',
        createdBy: this.currentUser?.id,
        location,
        relatedMessages: [],
      });

      if (response.success) {
        // Notify thread participants about new ticket
        if (this.socket) {
          this.socket.emit('ticket_created', {
            threadId,
            ticketId: response.data.id,
            title,
          });
        }

        return response.data;
      }
      
      throw new Error(response.error || 'Failed to create ticket');
    } catch (error) {
      console.error('Error creating quick ticket:', error);
      throw error;
    }
  }

  async updateTicketStatus(ticketId: string, status: TicketFromMessage['status'], comments?: string): Promise<boolean> {
    try {
      const response = await ApiService.updateTicketStatus(ticketId, {
        status,
        comments,
        updatedBy: this.currentUser?.id,
      });

      if (response.success && this.socket) {
        this.socket.emit('ticket_updated', {
          ticketId,
          status,
          updatedBy: this.currentUser?.id,
        });
      }

      return response.success;
    } catch (error) {
      console.error('Error updating ticket status:', error);
      return false;
    }
  }

  async assignTicket(ticketId: string, assignedTo: string): Promise<boolean> {
    try {
      const response = await ApiService.assignTicket(ticketId, {
        assignedTo,
        assignedBy: this.currentUser?.id,
      });

      if (response.success && this.socket) {
        this.socket.emit('ticket_assigned', {
          ticketId,
          assignedTo,
          assignedBy: this.currentUser?.id,
        });
      }

      return response.success;
    } catch (error) {
      console.error('Error assigning ticket:', error);
      return false;
    }
  }

  async getThreadTickets(threadId: string): Promise<TicketFromMessage[]> {
    try {
      const response = await ApiService.getThreadTickets(threadId);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching thread tickets:', error);
      return [];
    }
  }

  // AI Features
  async getSuggestions(threadId: string, context: string): Promise<AISuggestion[]> {
    try {
      const location = await this.getCurrentLocation();
      
      const response = await ApiService.generateAISuggestions({
        threadId,
        context,
        location,
        userProfile: this.currentUser,
      });

      return response.data || [];
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      return [];
    }
  }

  async getSmartReplies(messageId: string): Promise<string[]> {
    try {
      const response = await ApiService.getSmartMessageReplies(messageId);
      return response.data || [];
    } catch (error) {
      console.error('Error getting smart replies:', error);
      return [];
    }
  }

  // Presence & Typing Indicators
  async updatePresence(status: UserPresence['status'], activity: string = ''): Promise<void> {
    if (!this.socket || !this.isConnected) return;

    try {
      const location = await this.getCurrentLocation();
      
      const presence: UserPresence = {
        userId: this.currentUser?.id || '',
        status,
        lastSeen: new Date(),
        activity,
        location,
      };

      this.socket.emit('presence_update', presence);
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  setTyping(threadId: string, isTyping: boolean): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('typing', {
      threadId,
      userId: this.currentUser?.id,
      isTyping,
    });

    // Auto-stop typing after 5 seconds
    if (isTyping) {
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
      }
      
      this.typingTimer = setTimeout(() => {
        this.setTyping(threadId, false);
      }, 5000);
    }
  }

  // Voice Messages
  async sendVoiceMessage(threadId: string, audioFile: any, duration: number): Promise<Message> {
    try {
      // First upload the audio file
      const uploadResponse = await this.uploadFile(audioFile, 'voice');
      
      if (!uploadResponse.success) {
        throw new Error('Failed to upload voice message');
      }

      const voiceData: VoiceMessage = {
        id: this.generateMessageId(),
        duration,
        url: uploadResponse.data.url,
        localPath: audioFile.uri,
      };

      return await this.sendMessage(threadId, '', 'voice', {
        attachments: [{
          id: voiceData.id,
          name: `voice_${Date.now()}.mp3`,
          type: 'audio/mp3',
          size: audioFile.size || 0,
          url: voiceData.url,
          localPath: voiceData.localPath,
          metadata: { duration: voiceData.duration },
        }],
      });
    } catch (error) {
      console.error('Error sending voice message:', error);
      throw error;
    }
  }

  // Location Sharing
  async shareCurrentLocation(threadId: string): Promise<Message> {
    try {
      const location = await this.getCurrentLocation();
      
      return await this.sendMessage(threadId, 'Shared location', 'location', {
        location,
      });
    } catch (error) {
      console.error('Error sharing location:', error);
      throw error;
    }
  }

  async startLiveLocationSharing(threadId: string, duration: number = 60): Promise<void> {
    try {
      const location = await this.getCurrentLocation();
      if (!location) {
        throw new Error('Unable to get current location');
      }
      
      location.isLive = true;
      location.expiresAt = new Date(Date.now() + duration * 60 * 1000);

      await this.sendMessage(threadId, 'Started live location sharing', 'location', {
        location,
      });

      // Start location updates
      this.startLocationUpdates(threadId, duration);
    } catch (error) {
      console.error('Error starting live location sharing:', error);
      throw error;
    }
  }

  private async startLocationUpdates(threadId: string, duration: number): Promise<void> {
    let elapsed = 0;
    const interval = 30; // Update every 30 seconds

    const timer = setInterval(async () => {
      elapsed += interval;
      
      if (elapsed >= duration * 60) {
        clearInterval(timer);
        return;
      }

      try {
        const location = await this.getCurrentLocation();
        if (location) {
          location.isLive = true;

          if (this.socket) {
            this.socket.emit('location_update', {
              threadId,
              userId: this.currentUser?.id,
              location,
            });
          }
        }
      } catch (error) {
        console.error('Error updating live location:', error);
      }
    }, interval * 1000);
  }

  // File Upload
  async uploadFile(file: any, type: 'image' | 'document' | 'voice' | 'video' = 'document'): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('uploadedBy', this.currentUser?.id || '');

      const response = await ApiService.uploadChatAttachment(formData);
      return response;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  // Utility Methods
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getCurrentLocation(): Promise<LocationData | undefined> {
    try {
      const location = await this.locationService.getCurrentLocation();
      if (!location) return undefined;
      
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        speed: location.speed,
        heading: location.heading,
        timestamp: new Date(location.timestamp),
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return undefined;
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (!this.isConnected || this.messageQueue.length === 0) return;

    const queuedMessages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of queuedMessages) {
      try {
        await this.sendMessage(
          message.threadId,
          message.content,
          message.type,
          {
            replyTo: message.replyTo,
            priority: message.priority,
            ephemeral: message.ephemeral,
            location: message.location,
            attachments: message.attachments,
          }
        );
      } catch (error) {
        console.error('Error processing queued message:', error);
        // Re-add to queue if failed
        this.messageQueue.push(message);
      }
    }
  }

  private startPresenceUpdates(): void {
    if (this.presenceTimer) return;

    this.presenceTimer = setInterval(() => {
      this.updatePresence('online', 'Active in app');
    }, 30000); // Update every 30 seconds
  }

  private stopPresenceUpdates(): void {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  // Event Listener Management
  onMessage(listener: (message: Message) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      const index = this.messageListeners.indexOf(listener);
      if (index > -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }

  onPresenceUpdate(listener: (presence: UserPresence) => void): () => void {
    this.presenceListeners.push(listener);
    return () => {
      const index = this.presenceListeners.indexOf(listener);
      if (index > -1) {
        this.presenceListeners.splice(index, 1);
      }
    };
  }

  onTyping(listener: (data: { threadId: string; userId: string; isTyping: boolean }) => void): () => void {
    this.typingListeners.push(listener);
    return () => {
      const index = this.typingListeners.indexOf(listener);
      if (index > -1) {
        this.typingListeners.splice(index, 1);
      }
    };
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.push(listener);
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  onThreadUpdate(listener: (thread: ConversationThread) => void): () => void {
    this.threadUpdateListeners.push(listener);
    return () => {
      const index = this.threadUpdateListeners.indexOf(listener);
      if (index > -1) {
        this.threadUpdateListeners.splice(index, 1);
      }
    };
  }

  private notifyMessageListeners(message: Message): void {
    this.messageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }

  private notifyPresenceListeners(presence: UserPresence): void {
    this.presenceListeners.forEach(listener => {
      try {
        listener(presence);
      } catch (error) {
        console.error('Error in presence listener:', error);
      }
    });
  }

  private notifyTypingListeners(data: { threadId: string; userId: string; isTyping: boolean }): void {
    this.typingListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in typing listener:', error);
      }
    });
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  private notifyThreadUpdateListeners(thread: ConversationThread): void {
    this.threadUpdateListeners.forEach(listener => {
      try {
        listener(thread);
      } catch (error) {
        console.error('Error in thread update listener:', error);
      }
    });
  }
}

// Export singleton instance
const communicationService = new CommunicationService();
export default communicationService;
