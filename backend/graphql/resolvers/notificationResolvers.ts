/**
 * GraphQL Notification Resolvers
 * Handles notification-related queries and mutations
 */

import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Context } from '../context';

const NotificationModel = mongoose.model('Notification');

export const notificationResolvers = {
  Query: {
    myNotifications: async (_: any, { unreadOnly, pagination }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const query: any = { recipient: context.user._id };
        
        if (unreadOnly) {
          query.isRead = false;
        }

        const { limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination || {};
        const sort: any = {};
        sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

        const notifications = await NotificationModel.find(query)
          .populate('recipient')
          .sort(sort)
          .limit(limit)
          .skip(offset);

        return notifications;
      } catch (error) {
        console.error('Error fetching notifications:', error);
        throw new GraphQLError('Failed to fetch notifications');
      }
    },

    unreadNotificationCount: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const count = await NotificationModel.countDocuments({
          recipient: context.user._id,
          isRead: false
        });

        return count;
      } catch (error) {
        console.error('Error fetching unread notification count:', error);
        throw new GraphQLError('Failed to fetch unread notification count');
      }
    },
  },

  Mutation: {
    markNotificationAsRead: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const notification = await NotificationModel.findById(id);
        if (!notification) {
          throw new GraphQLError('Notification not found');
        }

        // Check if user owns this notification
        if (notification.recipient.toString() !== context.user._id.toString()) {
          throw new GraphQLError('Insufficient permissions');
        }

        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();

        return notification.populate('recipient');
      } catch (error) {
        console.error('Error marking notification as read:', error);
        throw new GraphQLError('Failed to mark notification as read');
      }
    },

    markAllNotificationsAsRead: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        await NotificationModel.updateMany(
          { 
            recipient: context.user._id, 
            isRead: false 
          },
          { 
            isRead: true, 
            readAt: new Date() 
          }
        );

        return true;
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw new GraphQLError('Failed to mark all notifications as read');
      }
    },
  },

  Subscription: {
    notificationReceived: {
      subscribe: () => {
        // Implementation for notification subscription
        // This would use pubsub mechanism
      }
    },
  },
};