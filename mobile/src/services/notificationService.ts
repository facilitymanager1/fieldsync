/**
 * Notification Service - Real-time notifications for approval workflow
 * Handles push notifications, in-app alerts, and notification management
 */

import { Platform } from 'react-native';
import { ApprovalNotification } from '../types/approval';

// API Base URL
const API_BASE_URL = process.env.REACT_NATIVE_API_URL || 'http://localhost:3000/api';

interface NotificationPermissions {
  enabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface NotificationFilters {
  types?: string[];
  roles?: string[];
  isRead?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

class NotificationService {
  private listeners: ((notifications: ApprovalNotification[]) => void)[] = [];
  private websocket: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize notification service
   */
  async initialize(): Promise<void> {
    try {
      await this.requestPermissions();
      await this.setupWebSocketConnection();
      await this.registerForPushNotifications();
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<NotificationPermissions> {
    try {
      // This would integrate with expo-notifications or react-native-push-notification
      // For now, returning a mock response
      const permissions: NotificationPermissions = {
        enabled: true,
        pushEnabled: true,
        soundEnabled: true,
        vibrationEnabled: Platform.OS === 'android'
      };

      return permissions;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return {
        enabled: false,
        pushEnabled: false,
        soundEnabled: false,
        vibrationEnabled: false
      };
    }
  }

  /**
   * Register for push notifications
   */
  private async registerForPushNotifications(): Promise<void> {
    try {
      // This would use expo-notifications to get the push token
      // const { status } = await Notifications.requestPermissionsAsync();
      // if (status !== 'granted') return;
      
      // const token = (await Notifications.getExpoPushTokenAsync()).data;
      // await this.savePushToken(token);
      
      console.log('Push notification registration would happen here');
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  }

  /**
   * Setup WebSocket connection for real-time notifications
   */
  private async setupWebSocketConnection(): Promise<void> {
    try {
      const wsUrl = `ws://localhost:3001/notifications`; // WebSocket server
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('WebSocket connected for notifications');
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleRealtimeNotification(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('WebSocket disconnected, attempting reconnection...');
        this.scheduleReconnection();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error setting up WebSocket connection:', error);
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnection(): void {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(async () => {
      if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
        await this.setupWebSocketConnection();
      }
    }, 5000);
  }

  /**
   * Handle real-time notification
   */
  private handleRealtimeNotification(data: any): void {
    try {
      const notification: ApprovalNotification = {
        id: data.id,
        type: data.type,
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        message: data.message,
        recipientRole: data.recipientRole,
        recipientId: data.recipientId,
        isRead: false,
        createdAt: new Date(data.createdAt),
        actionUrl: data.actionUrl
      };

      // Show in-app notification
      this.showInAppNotification(notification);

      // Notify listeners
      this.notifyListeners([notification]);

    } catch (error) {
      console.error('Error handling real-time notification:', error);
    }
  }

  /**
   * Show in-app notification
   */
  private showInAppNotification(notification: ApprovalNotification): void {
    // This would use a toast library or custom notification component
    console.log('In-app notification:', notification.message);
    
    // You could integrate with libraries like:
    // - react-native-toast-message
    // - react-native-flash-message
    // - Custom notification overlay
  }

  /**
   * Get notifications for current user
   */
  async getNotifications(filters: NotificationFilters = {}): Promise<{
    notifications: ApprovalNotification[];
    unreadCount: number;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (filters.types && filters.types.length > 0) {
        queryParams.append('types', filters.types.join(','));
      }
      if (filters.roles && filters.roles.length > 0) {
        queryParams.append('roles', filters.roles.join(','));
      }
      if (filters.isRead !== undefined) {
        queryParams.append('isRead', filters.isRead.toString());
      }
      if (filters.fromDate) {
        queryParams.append('fromDate', filters.fromDate.toISOString());
      }
      if (filters.toDate) {
        queryParams.append('toDate', filters.toDate.toISOString());
      }

      const response = await fetch(`${API_BASE_URL}/notifications?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw new Error('Failed to fetch notifications');
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw new Error('Failed to mark notification as read');
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw new Error('Failed to mark all notifications as read');
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error deleting notification:', error);
      throw new Error('Failed to delete notification');
    }
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<NotificationPermissions> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
        method: 'GET',
        headers: {
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error fetching notification settings:', error);
      throw new Error('Failed to fetch notification settings');
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: Partial<NotificationPermissions>): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw new Error('Failed to update notification settings');
    }
  }

  /**
   * Subscribe to notification updates
   */
  subscribe(listener: (notifications: ApprovalNotification[]) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(notifications: ApprovalNotification[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(notifications);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * Send custom notification (admin/system use)
   */
  async sendNotification(data: {
    type: string;
    message: string;
    recipientRole?: string;
    recipientId?: string;
    employeeId?: string;
    employeeName?: string;
    actionUrl?: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error sending notification:', error);
      throw new Error('Failed to send notification');
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    this.listeners = [];
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string> {
    // This should integrate with your authentication system
    try {
      // Import your auth service here
      // const { authService } = await import('./authService');
      // return await authService.getToken();
      
      // Placeholder - replace with actual auth token retrieval
      return 'Bearer your-auth-token';
    } catch (error) {
      throw new Error('Authentication required');
    }
  }

  /**
   * Save push notification token
   */
  private async savePushToken(token: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/notifications/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }
}

export const notificationService = new NotificationService();