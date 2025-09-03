/**
 * GraphQL User Resolvers
 * Handles user-related queries and mutations
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { GraphQLError } from 'graphql';
import { Context } from '../context';

const UserModel = mongoose.model('User');

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }
      
      try {
        return await UserModel.findById(context.user._id).populate('profile');
      } catch (error) {
        console.error('Error fetching current user:', error);
        throw new GraphQLError('Failed to fetch user');
      }
    },

    user: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const user = await UserModel.findById(id).populate('profile');
        if (!user) {
          throw new GraphQLError('User not found');
        }
        return user;
      } catch (error) {
        console.error('Error fetching user:', error);
        throw new GraphQLError('Failed to fetch user');
      }
    },

    users: async (_: any, { filter, pagination }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Check if user has permission to list users
      if (!['admin', 'supervisor'].includes(context.user.role)) {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const query: any = {};
        
        if (filter) {
          query.$or = [
            { name: { $regex: filter, $options: 'i' } },
            { email: { $regex: filter, $options: 'i' } }
          ];
        }

        const { limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination || {};
        const sort: any = {};
        sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

        const users = await UserModel
          .find(query)
          .populate('profile')
          .sort(sort)
          .limit(limit)
          .skip(offset);

        return users;
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new GraphQLError('Failed to fetch users');
      }
    },
  },

  Mutation: {
    createUser: async (_: any, { input }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Check if user has permission to create users
      if (!['admin'].includes(context.user.role)) {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        // Check if user with email already exists
        const existingUser = await UserModel.findOne({ email: input.email });
        if (existingUser) {
          throw new GraphQLError('User with this email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(input.password, 12);

        // Create user
        const user = new UserModel({
          ...input,
          password: hashedPassword,
          isActive: true,
          createdBy: context.user._id,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await user.save();
        return user.populate('profile');
      } catch (error) {
        console.error('Error creating user:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to create user');
      }
    },

    updateUser: async (_: any, { id, input }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const user = await UserModel.findById(id);
        if (!user) {
          throw new GraphQLError('User not found');
        }

        // Check permissions - admin can update anyone, users can update themselves
        if (context.user.role !== 'admin' && context.user._id.toString() !== id) {
          throw new GraphQLError('Insufficient permissions');
        }

        // Hash password if provided
        if (input.password) {
          input.password = await bcrypt.hash(input.password, 12);
        }

        Object.assign(user, input, { updatedAt: new Date() });
        await user.save();
        
        return user.populate('profile');
      } catch (error) {
        console.error('Error updating user:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to update user');
      }
    },

    deleteUser: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Only admins can delete users
      if (context.user.role !== 'admin') {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const user = await UserModel.findById(id);
        if (!user) {
          throw new GraphQLError('User not found');
        }

        // Soft delete by setting isActive to false
        user.isActive = false;
        user.updatedAt = new Date();
        await user.save();

        return true;
      } catch (error) {
        console.error('Error deleting user:', error);
        throw new GraphQLError('Failed to delete user');
      }
    },
  },

  User: {
    permissions: (parent: any) => {
      // Return permissions based on user role
      const rolePermissions: { [key: string]: string[] } = {
        admin: ['*'],
        supervisor: ['tickets:*', 'shifts:*', 'staff:read', 'sites:*'],
        field_tech: ['tickets:read', 'tickets:update', 'shifts:read', 'shifts:update'],
        site_staff: ['tickets:read', 'shifts:read'],
        client: ['tickets:read']
      };

      return rolePermissions[parent.role] || [];
    },
  },
};