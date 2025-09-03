/**
 * GraphQL Site Resolvers
 * Handles site-related queries and mutations
 */

import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Context } from '../context';

const SiteModel = mongoose.model('Site');

export const siteResolvers = {
  Query: {
    site: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const site = await SiteModel.findById(id)
          .populate('tickets')
          .populate('shifts')
          .populate('staff');

        if (!site) {
          throw new GraphQLError('Site not found');
        }

        return site;
      } catch (error) {
        console.error('Error fetching site:', error);
        throw new GraphQLError('Failed to fetch site');
      }
    },

    sites: async (_: any, { pagination }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const { limit = 20, offset = 0, sortBy = 'name', sortOrder = 'ASC' } = pagination || {};
        const sort: any = {};
        sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

        const sites = await SiteModel.find({ isActive: true })
          .sort(sort)
          .limit(limit)
          .skip(offset);

        return sites;
      } catch (error) {
        console.error('Error fetching sites:', error);
        throw new GraphQLError('Failed to fetch sites');
      }
    },
  },

  Mutation: {
    createSite: async (_: any, { input }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      if (!['admin', 'supervisor'].includes(context.user.role)) {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const site = new SiteModel({
          ...input,
          isActive: true,
          createdBy: context.user._id,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await site.save();
        return site;
      } catch (error) {
        console.error('Error creating site:', error);
        throw new GraphQLError('Failed to create site');
      }
    },

    updateSite: async (_: any, { id, input }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      if (!['admin', 'supervisor'].includes(context.user.role)) {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const site = await SiteModel.findById(id);
        if (!site) {
          throw new GraphQLError('Site not found');
        }

        Object.assign(site, input, { updatedAt: new Date() });
        await site.save();
        
        return site;
      } catch (error) {
        console.error('Error updating site:', error);
        throw new GraphQLError('Failed to update site');
      }
    },

    deleteSite: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      if (context.user.role !== 'admin') {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const site = await SiteModel.findById(id);
        if (!site) {
          throw new GraphQLError('Site not found');
        }

        site.isActive = false;
        site.updatedAt = new Date();
        await site.save();

        return true;
      } catch (error) {
        console.error('Error deleting site:', error);
        throw new GraphQLError('Failed to delete site');
      }
    },
  },
};