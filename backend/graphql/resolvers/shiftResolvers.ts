/**
 * GraphQL Shift Resolvers
 * Handles shift-related queries and mutations
 */

import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Context } from '../context';

const ShiftModel = mongoose.model('Shift');
const StaffModel = mongoose.model('Staff');

export const shiftResolvers = {
  Query: {
    shift: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const shift = await ShiftModel.findById(id)
          .populate('staff')
          .populate('site');

        if (!shift) {
          throw new GraphQLError('Shift not found');
        }

        return shift;
      } catch (error) {
        console.error('Error fetching shift:', error);
        throw new GraphQLError('Failed to fetch shift');
      }
    },

    shifts: async (_: any, { filter, pagination }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const query: any = {};

        if (filter) {
          // Apply filters based on the filter object
          Object.keys(filter).forEach(key => {
            query[key] = filter[key];
          });
        }

        const { limit = 20, offset = 0, sortBy = 'startTime', sortOrder = 'DESC' } = pagination || {};
        const sort: any = {};
        sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

        const [shifts, totalCount] = await Promise.all([
          ShiftModel.find(query)
            .populate('staff')
            .populate('site')
            .sort(sort)
            .limit(limit)
            .skip(offset),
          ShiftModel.countDocuments(query)
        ]);

        return {
          shifts,
          totalCount,
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0
        };
      } catch (error) {
        console.error('Error fetching shifts:', error);
        throw new GraphQLError('Failed to fetch shifts');
      }
    },

    myShifts: async (_: any, { filter, pagination }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        // Get staff record for current user
        const staff = await StaffModel.findOne({ user: context.user._id });
        if (!staff) {
          throw new GraphQLError('Staff record not found');
        }

        const query: any = { staff: staff._id };

        if (filter) {
          Object.keys(filter).forEach(key => {
            query[key] = filter[key];
          });
        }

        const { limit = 20, offset = 0, sortBy = 'startTime', sortOrder = 'DESC' } = pagination || {};
        const sort: any = {};
        sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

        const [shifts, totalCount] = await Promise.all([
          ShiftModel.find(query)
            .populate('staff')
            .populate('site')
            .sort(sort)
            .limit(limit)
            .skip(offset),
          ShiftModel.countDocuments(query)
        ]);

        return {
          shifts,
          totalCount,
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0
        };
      } catch (error) {
        console.error('Error fetching user shifts:', error);
        throw new GraphQLError('Failed to fetch user shifts');
      }
    },

    currentShift: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const staff = await StaffModel.findOne({ user: context.user._id });
        if (!staff) {
          return null;
        }

        const currentShift = await ShiftModel.findOne({
          staff: staff._id,
          status: 'active'
        })
        .populate('staff')
        .populate('site');

        return currentShift;
      } catch (error) {
        console.error('Error fetching current shift:', error);
        throw new GraphQLError('Failed to fetch current shift');
      }
    },
  },

  Mutation: {
    createShift: async (_: any, { input }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      if (!['admin', 'supervisor'].includes(context.user.role)) {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const shift = new ShiftModel({
          ...input,
          staff: input.staffId,
          site: input.siteId,
          status: 'scheduled',
          breaks: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await shift.save();
        return shift.populate(['staff', 'site']);
      } catch (error) {
        console.error('Error creating shift:', error);
        throw new GraphQLError('Failed to create shift');
      }
    },

    startShift: async (_: any, { shiftId }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const shift = await ShiftModel.findById(shiftId).populate('staff');
        if (!shift) {
          throw new GraphQLError('Shift not found');
        }

        // Check if user can start this shift
        if (shift.staff.user.toString() !== context.user._id.toString()) {
          throw new GraphQLError('Cannot start another user\'s shift');
        }

        shift.status = 'active';
        shift.actualStartTime = new Date();
        shift.updatedAt = new Date();

        await shift.save();
        return shift.populate(['staff', 'site']);
      } catch (error) {
        console.error('Error starting shift:', error);
        throw new GraphQLError('Failed to start shift');
      }
    },

    endShift: async (_: any, { shiftId }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const shift = await ShiftModel.findById(shiftId).populate('staff');
        if (!shift) {
          throw new GraphQLError('Shift not found');
        }

        // Check if user can end this shift
        if (shift.staff.user.toString() !== context.user._id.toString()) {
          throw new GraphQLError('Cannot end another user\'s shift');
        }

        shift.status = 'completed';
        shift.actualEndTime = new Date();
        shift.updatedAt = new Date();

        // Calculate total duration
        if (shift.actualStartTime) {
          const duration = shift.actualEndTime.getTime() - shift.actualStartTime.getTime();
          shift.totalDuration = Math.floor(duration / (1000 * 60)); // minutes
        }

        await shift.save();
        return shift.populate(['staff', 'site']);
      } catch (error) {
        console.error('Error ending shift:', error);
        throw new GraphQLError('Failed to end shift');
      }
    },
  },
};