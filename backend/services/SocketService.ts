import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

// Extend Socket interface to include custom properties
declare module 'socket.io' {
  interface Socket {
    userId: string;
    userName: string;
    userRole: string;
  }
}

export interface SocketUser {
  id: string;
  socketId: string;
  name: string;
  role: string;
  activeThreads: Set<string>;
  lastSeen: Date;
}

class SocketService {
  private io: Server | null = null;
  private connectedUsers = new Map<string, SocketUser>();
  private userSockets = new Map<string, string>(); // userId -> socketId

  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: "*", // Configure appropriately for production
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    if (!this.io) return;

    // Authentication middleware
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('No token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        socket.userId = decoded.id;
        socket.userName = decoded.name;
        socket.userRole = decoded.role;
        next();
      } catch (error) {
        console.error('Socket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userName} connected: ${socket.id}`);
      
      // Add user to connected users
      const user: SocketUser = {
        id: socket.userId,
        socketId: socket.id,
        name: socket.userName,
        role: socket.userRole,
        activeThreads: new Set(),
        lastSeen: new Date(),
      };

      this.connectedUsers.set(socket.userId, user);
      this.userSockets.set(socket.userId, socket.id);

      // Broadcast user online status
      socket.broadcast.emit('user_online', {
        userId: socket.userId,
        userName: socket.userName,
        timestamp: new Date(),
      });

      // Handle joining thread rooms
      socket.on('join_thread', (threadId: string) => {
        socket.join(threadId);
        user.activeThreads.add(threadId);
        console.log(`User ${socket.userName} joined thread: ${threadId}`);
      });

      // Handle leaving thread rooms
      socket.on('leave_thread', (threadId: string) => {
        socket.leave(threadId);
        user.activeThreads.delete(threadId);
        console.log(`User ${socket.userName} left thread: ${threadId}`);
      });

      // Handle sending messages
      socket.on('send_message', (message) => {
        // Broadcast to all users in the thread
        socket.to(message.threadId).emit('message', {
          ...message,
          timestamp: new Date(),
        });

        // Store message in database (you'll need to implement this)
        // await MessageModel.create(message);
      });

      // Handle message editing
      socket.on('message_edited', (data) => {
        socket.to(data.threadId).emit('message_edited', {
          messageId: data.messageId,
          newContent: data.newContent,
          editedAt: new Date(),
          editedBy: socket.userId,
        });
      });

      // Handle message deletion
      socket.on('message_deleted', (data) => {
        socket.to(data.threadId).emit('message_deleted', {
          messageId: data.messageId,
          deletedBy: socket.userId,
          deleteForEveryone: data.deleteForEveryone,
          timestamp: new Date(),
        });
      });

      // Handle read receipts
      socket.on('message_read', (data) => {
        socket.to(data.threadId).emit('message_read', {
          messageId: data.messageId,
          readBy: socket.userId,
          readAt: new Date(),
        });
      });

      // Handle typing indicators
      socket.on('typing', (data) => {
        socket.to(data.threadId).emit('typing', {
          threadId: data.threadId,
          userId: socket.userId,
          userName: socket.userName,
          isTyping: data.isTyping,
        });
      });

      // Handle presence updates
      socket.on('presence_update', (presence) => {
        user.lastSeen = new Date();
        socket.broadcast.emit('presence_update', {
          ...presence,
          timestamp: new Date(),
        });
      });

      // Handle live location updates
      socket.on('location_update', (data) => {
        socket.to(data.threadId).emit('location_update', {
          threadId: data.threadId,
          userId: socket.userId,
          userName: socket.userName,
          location: data.location,
          timestamp: new Date(),
        });
      });

      // Handle ticket creation notifications
      socket.on('ticket_created', (data) => {
        socket.to(data.threadId).emit('ticket_created', {
          ...data,
          createdBy: socket.userId,
          createdByName: socket.userName,
          timestamp: new Date(),
        });
      });

      // Handle ticket updates
      socket.on('ticket_updated', (data) => {
        socket.to(data.threadId).emit('ticket_updated', {
          ...data,
          updatedByName: socket.userName,
          timestamp: new Date(),
        });
      });

      // Handle ticket assignments
      socket.on('ticket_assigned', (data) => {
        socket.to(data.threadId).emit('ticket_assigned', {
          ...data,
          assignedByName: socket.userName,
          timestamp: new Date(),
        });

        // Notify the assigned user if they're online
        const assignedUserSocketId = this.userSockets.get(data.assignedTo);
        if (assignedUserSocketId) {
          socket.to(assignedUserSocketId).emit('ticket_assigned_to_you', {
            ...data,
            assignedByName: socket.userName,
            timestamp: new Date(),
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userName} disconnected: ${socket.id}`);
        
        // Remove user from connected users
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.userId);

        // Broadcast user offline status
        socket.broadcast.emit('user_offline', {
          userId: socket.userId,
          userName: socket.userName,
          lastSeen: new Date(),
        });
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userName}:`, error);
      });
    });
  }

  // Utility methods for sending targeted messages
  sendToUser(userId: string, event: string, data: any): boolean {
    const socketId = this.userSockets.get(userId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  sendToThread(threadId: string, event: string, data: any): boolean {
    if (this.io) {
      this.io.to(threadId).emit(event, data);
      return true;
    }
    return false;
  }

  broadcastToAll(event: string, data: any): boolean {
    if (this.io) {
      this.io.emit(event, data);
      return true;
    }
    return false;
  }

  getConnectedUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values());
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  getUserActiveThreads(userId: string): string[] {
    const user = this.connectedUsers.get(userId);
    return user ? Array.from(user.activeThreads) : [];
  }

  // Graceful shutdown
  shutdown(): void {
    if (this.io) {
      this.io.close();
      this.connectedUsers.clear();
      this.userSockets.clear();
    }
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
