/**
 * GraphQL SLA Resolvers
 * Handles SLA-related queries and mutations
 */

import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Context } from '../context';

const SLATemplateModel = mongoose.model('SLATemplate');
const SLATrackerModel = mongoose.model('SLATracker');

export const slaResolvers = {
  Query: {
    slaTemplate: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const template = await SLATemplateModel.findById(id);
        if (!template) {
          throw new GraphQLError('SLA template not found');
        }

        return template;
      } catch (error) {
        console.error('Error fetching SLA template:', error);
        throw new GraphQLError('Failed to fetch SLA template');
      }
    },

    slaTemplates: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const templates = await SLATemplateModel.find({ isActive: true });
        return templates;
      } catch (error) {
        console.error('Error fetching SLA templates:', error);
        throw new GraphQLError('Failed to fetch SLA templates');
      }
    },

    slaTracker: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const tracker = await SLATrackerModel.findById(id)
          .populate('ticket')
          .populate('template');

        if (!tracker) {
          throw new GraphQLError('SLA tracker not found');
        }

        return tracker;
      } catch (error) {
        console.error('Error fetching SLA tracker:', error);
        throw new GraphQLError('Failed to fetch SLA tracker');
      }
    },

    slaTrackers: async (_: any, { filter }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const query: any = {};
        
        if (filter) {
          Object.keys(filter).forEach(key => {
            query[key] = filter[key];
          });
        }

        const trackers = await SLATrackerModel.find(query)
          .populate('ticket')
          .populate('template')
          .sort({ createdAt: -1 });

        return trackers;
      } catch (error) {
        console.error('Error fetching SLA trackers:', error);
        throw new GraphQLError('Failed to fetch SLA trackers');
      }
    },
  },
};