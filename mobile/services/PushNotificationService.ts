import { Platform } from 'react-native';
// import PushNotification from 'react-native-push-notification';

// Mock PushNotification for compilation - replace with actual import when package is installed
const PushNotification = {
  configure: (config: any) => {},
  createChannel: (config: any, callback: (created: boolean) => void) => callback(true),
  getApplicationIconBadgeNumber: (callback: (count: number) => void) => callback(0),
  setApplicationIconBadgeNumber: (count: number) => {},
  localNotification: (config: any) => {},
  cancelAllLocalNotifications: () => {},
  cancelLocalNotifications: (config: any) => {},
  requestPermissions: () => Promise.resolve({}),
};

class PushNotificationService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve) => {
      PushNotification.configure({
        // Called when Token is generated (iOS and Android)
        onRegister: (token: any) => {
          console.log('Push notification token:', token);
          this.sendTokenToServer(token.token);
        },

        // Called when a remote or local notification is opened or received
        onNotification: (notification: any) => {
          console.log('Notification received:', notification);
          this.handleNotification(notification);
        },

        // Called when Registered Action is pressed and invokeApp is false
        onAction: (notification: any) => {
          console.log('Notification action:', notification.action);
        },

        // Called when the user fails to register for remote notifications
        onRegistrationError: (err: any) => {
          console.error('Push notification registration error:', err);
        },

        // iOS only properties
        permissions: {
          alert: true,
          badge: true,
          sound: true,
        },

        // Should the initial notification be popped automatically
        popInitialNotification: true,

        // Request permissions on app start
        requestPermissions: Platform.OS === 'ios',
      });

      // Create default channels for Android
      if (Platform.OS === 'android') {
        this.createDefaultChannels();
      }

      this.initialized = true;
      resolve();
    });
  }

  private createDefaultChannels(): void {
    PushNotification.createChannel(
      {
        channelId: 'default',
        channelName: 'Default Notifications',
        channelDescription: 'Default notifications channel',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Default channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'urgent',
        channelName: 'Urgent Notifications',
        channelDescription: 'Urgent notifications channel',
        playSound: true,
        soundName: 'default',
        importance: 5,
        vibrate: true,
      },
      (created) => console.log(`Urgent channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'location',
        channelName: 'Location Updates',
        channelDescription: 'Location tracking notifications',
        playSound: false,
        importance: 2,
        vibrate: false,
      },
      (created) => console.log(`Location channel created: ${created}`)
    );
  }

  private async sendTokenToServer(token: string): Promise<void> {
    try {
      // Send token to backend for user association
      // This would be implemented when we have user context
      console.log('TODO: Send token to server:', token);
    } catch (error) {
      console.error('Failed to send token to server:', error);
    }
  }

  private handleNotification(notification: any): void {
    // Handle different types of notifications
    switch (notification.data?.type) {
      case 'ticket_assigned':
        this.handleTicketNotification(notification);
        break;
      case 'location_update':
        this.handleLocationNotification(notification);
        break;
      case 'emergency':
        this.handleEmergencyNotification(notification);
        break;
      default:
        console.log('Unknown notification type:', notification);
    }
  }

  private handleTicketNotification(notification: any): void {
    console.log('Handling ticket notification:', notification);
    // Navigate to ticket screen or show relevant UI
  }

  private handleLocationNotification(notification: any): void {
    console.log('Handling location notification:', notification);
    // Update location or show location-related UI
  }

  private handleEmergencyNotification(notification: any): void {
    console.log('Handling emergency notification:', notification);
    // Show emergency alert or navigate to emergency screen
  }

  // Public methods for sending notifications
  showLocalNotification(title: string, message: string, data?: any): void {
    PushNotification.localNotification({
      title,
      message,
      data,
      channelId: 'default',
    });
  }

  showUrgentNotification(title: string, message: string, data?: any): void {
    PushNotification.localNotification({
      title,
      message,
      data,
      channelId: 'urgent',
      priority: 'high',
      vibrate: true,
      playSound: true,
    });
  }

  showLocationNotification(message: string): void {
    PushNotification.localNotification({
      title: 'Location Update',
      message,
      channelId: 'location',
      ongoing: true,
      priority: 'low',
    });
  }

  cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  cancelNotification(id: string): void {
    PushNotification.cancelLocalNotifications({ id });
  }

  getBadgeCount(): Promise<number> {
    return new Promise((resolve) => {
      PushNotification.getApplicationIconBadgeNumber((count) => {
        resolve(count);
      });
    });
  }

  setBadgeCount(count: number): void {
    PushNotification.setApplicationIconBadgeNumber(count);
  }

  requestPermissions(): Promise<any> {
    return PushNotification.requestPermissions();
  }
}

export default new PushNotificationService();
