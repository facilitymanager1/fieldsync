/**
 * Notification Bell Component - Shows notification icon with unread count
 * Displays in header/navigation for quick access to notifications
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { NotificationCenter } from './NotificationCenter';
import { notificationService } from '../../services/notificationService';
import { ApprovalNotification } from '../../types/approval';

interface NotificationBellProps {
  onNotificationPress?: (notification: ApprovalNotification) => void;
  iconSize?: number;
  iconColor?: string;
  badgeColor?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNotificationPress,
  iconSize = 24,
  iconColor = '#1C1C1E',
  badgeColor = '#FF3B30',
}) => {
  const [showCenter, setShowCenter] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scaleAnim] = useState(new Animated.Value(1));

  // Load initial unread count
  useEffect(() => {
    loadUnreadCount();
  }, []);

  // Subscribe to notification updates
  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notifications) => {
      // Handle new notifications
      handleNewNotifications(notifications);
    });

    return unsubscribe;
  }, []);

  // Load unread count
  const loadUnreadCount = async () => {
    try {
      const result = await notificationService.getNotifications({
        isRead: false
      });
      setUnreadCount(result.unreadCount);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  // Handle new notifications
  const handleNewNotifications = (notifications: ApprovalNotification[]) => {
    if (notifications.length > 0) {
      // Update unread count
      setUnreadCount(prev => prev + notifications.filter(n => !n.isRead).length);
      
      // Animate bell to draw attention
      animateBell();
    }
  };

  // Animate bell icon
  const animateBell = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Handle bell press
  const handleBellPress = () => {
    setShowCenter(true);
  };

  // Handle notification center close
  const handleCenterClose = () => {
    setShowCenter(false);
    // Refresh unread count when center closes
    loadUnreadCount();
  };

  // Format count display
  const getCountDisplay = (count: number): string => {
    if (count === 0) return '';
    if (count > 99) return '99+';
    return count.toString();
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.bellContainer}
        onPress={handleBellPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Ionicons
            name={unreadCount > 0 ? "notifications" : "notifications-outline"}
            size={iconSize}
            color={iconColor}
          />
        </Animated.View>

        {unreadCount > 0 && (
          <View style={[
            styles.badge,
            { backgroundColor: badgeColor }
          ]}>
            <Animated.Text style={styles.badgeText}>
              {getCountDisplay(unreadCount)}
            </Animated.Text>
          </View>
        )}
      </TouchableOpacity>

      <NotificationCenter
        visible={showCenter}
        onClose={handleCenterClose}
        onNotificationPress={onNotificationPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});