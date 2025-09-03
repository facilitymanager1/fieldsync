/**
 * GraphQL Ticket Resolvers
 * Handles ticket-related queries and mutations
 */

import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Context } from '../context';

const TicketModel = mongoose.model('Ticket');
const SiteModel = mongoose.model('Site');
const UserModel = mongoose.model('User');

export const ticketResolvers = {
  Query: {
    ticket: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const ticket = await TicketModel.findById(id)
          .populate('site')
          .populate('assignedTo')
          .populate('createdBy')
          .populate('comments.author')
          .populate('attachments');

        if (!ticket) {
          throw new GraphQLError('Ticket not found');
        }

        return ticket;
      } catch (error) {
        console.error('Error fetching ticket:', error);
        throw new GraphQLError('Failed to fetch ticket');
      }
    },

    tickets: async (_: any, { filter, pagination }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const query: any = {};

        // Apply filters
        if (filter) {
          if (filter.status) query.status = filter.status;
          if (filter.priority) query.priority = filter.priority;
          if (filter.category) query.category = filter.category;
          if (filter.siteId) query.site = filter.siteId;
          if (filter.assignedToId) query.assignedTo = filter.assignedToId;
          if (filter.createdBy) query.createdBy = filter.createdBy;
          if (filter.dateRange) {
            query.createdAt = {
              $gte: filter.dateRange.start,
              $lte: filter.dateRange.end
            };
          }
        }

        // Role-based access control
        if (context.user.role === 'client') {
          // Clients can only see tickets for their sites
          const userSites = await SiteModel.find({ contactEmail: context.user.email });
          query.site = { $in: userSites.map(site => site._id) };
        } else if (context.user.role === 'field_tech') {
          // Field techs can see assigned tickets or tickets at their sites
          query.$or = [
            { assignedTo: context.user._id },
            { site: { $in: context.user.assignedSites || [] } }
          ];
        }

        const { limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination || {};
        const sort: any = {};
        sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

        const [tickets, totalCount] = await Promise.all([
          TicketModel.find(query)
            .populate('site')
            .populate('assignedTo')
            .populate('createdBy')
            .sort(sort)
            .limit(limit)
            .skip(offset),
          TicketModel.countDocuments(query)
        ]);

        return {
          tickets,
          totalCount,
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0
        };
      } catch (error) {
        console.error('Error fetching tickets:', error);
        throw new GraphQLError('Failed to fetch tickets');
      }
    },

    myTickets: async (_: any, { filter, pagination }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const query: any = {
          $or: [
            { assignedTo: context.user._id },
            { createdBy: context.user._id }
          ]
        };

        // Apply additional filters
        if (filter) {
          if (filter.status) query.status = filter.status;
          if (filter.priority) query.priority = filter.priority;
          if (filter.category) query.category = filter.category;
        }

        const { limit = 20, offset = 0, sortBy = 'updatedAt', sortOrder = 'DESC' } = pagination || {};
        const sort: any = {};
        sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

        const [tickets, totalCount] = await Promise.all([
          TicketModel.find(query)
            .populate('site')
            .populate('assignedTo')
            .populate('createdBy')
            .sort(sort)
            .limit(limit)
            .skip(offset),
          TicketModel.countDocuments(query)
        ]);

        return {
          tickets,
          totalCount,
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0
        };
      } catch (error) {
        console.error('Error fetching user tickets:', error);
        throw new GraphQLError('Failed to fetch user tickets');
      }
    },
  },

  Mutation: {
    createTicket: async (_: any, { input }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        // Verify site exists
        const site = await SiteModel.findById(input.siteId);
        if (!site) {
          throw new GraphQLError('Site not found');
        }

        // Verify assigned user if provided
        if (input.assignedToId) {
          const assignedUser = await UserModel.findById(input.assignedToId);
          if (!assignedUser) {
            throw new GraphQLError('Assigned user not found');
          }
        }

        const ticket = new TicketModel({
          ...input,
          site: input.siteId,
          assignedTo: input.assignedToId || null,
          createdBy: context.user._id,
          status: 'open',
          comments: [],
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await ticket.save();
        return ticket.populate(['site', 'assignedTo', 'createdBy']);
      } catch (error) {
        console.error('Error creating ticket:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to create ticket');
      }
    },

    updateTicket: async (_: any, { id, input }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const ticket = await TicketModel.findById(id);
        if (!ticket) {
          throw new GraphQLError('Ticket not found');
        }

        // Check permissions
        const canEdit = context.user.role === 'admin' ||
                       context.user.role === 'supervisor' ||
                       ticket.assignedTo?.toString() === context.user._id.toString() ||
                       ticket.createdBy.toString() === context.user._id.toString();

        if (!canEdit) {
          throw new GraphQLError('Insufficient permissions');
        }

        Object.assign(ticket, input, { updatedAt: new Date() });
        await ticket.save();

        return ticket.populate(['site', 'assignedTo', 'createdBy']);
      } catch (error) {
        console.error('Error updating ticket:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to update ticket');
      }
    },

    assignTicket: async (_: any, { ticketId, userId }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Only admins and supervisors can assign tickets
      if (!['admin', 'supervisor'].includes(context.user.role)) {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const [ticket, assignedUser] = await Promise.all([
          TicketModel.findById(ticketId),
          UserModel.findById(userId)
        ]);

        if (!ticket) {
          throw new GraphQLError('Ticket not found');
        }
        if (!assignedUser) {
          throw new GraphQLError('User not found');
        }

        ticket.assignedTo = userId;
        ticket.status = 'assigned';
        ticket.updatedAt = new Date();
        
        await ticket.save();
        return ticket.populate(['site', 'assignedTo', 'createdBy']);
      } catch (error) {
        console.error('Error assigning ticket:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to assign ticket');
      }
    },

    resolveTicket: async (_: any, { ticketId, resolution }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const ticket = await TicketModel.findById(ticketId);
        if (!ticket) {
          throw new GraphQLError('Ticket not found');
        }

        // Check if user can resolve this ticket
        const canResolve = context.user.role === 'admin' ||
                          context.user.role === 'supervisor' ||
                          ticket.assignedTo?.toString() === context.user._id.toString();

        if (!canResolve) {
          throw new GraphQLError('Insufficient permissions');
        }

        ticket.status = 'resolved';
        ticket.resolution = resolution;
        ticket.resolvedAt = new Date();
        ticket.updatedAt = new Date();

        await ticket.save();
        return ticket.populate(['site', 'assignedTo', 'createdBy']);
      } catch (error) {
        console.error('Error resolving ticket:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to resolve ticket');
      }
    },

    addTicketComment: async (_: any, { ticketId, content }: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      try {
        const ticket = await TicketModel.findById(ticketId);
        if (!ticket) {
          throw new GraphQLError('Ticket not found');
        }

        const comment = {
          id: new mongoose.Types.ObjectId(),
          content,
          author: context.user._id,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        ticket.comments.push(comment);
        ticket.updatedAt = new Date();
        
        await ticket.save();
        await ticket.populate('comments.author');
        
        return comment;
      } catch (error) {
        console.error('Error adding ticket comment:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to add comment');
      }
    },

    deleteTicket: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Only admins can delete tickets
      if (context.user.role !== 'admin') {
        throw new GraphQLError('Insufficient permissions');
      }

      try {
        const result = await TicketModel.findByIdAndDelete(id);
        if (!result) {
          throw new GraphQLError('Ticket not found');
        }

        return true;
      } catch (error) {
        console.error('Error deleting ticket:', error);
        throw new GraphQLError('Failed to delete ticket');
      }
    },
  },

  Subscription: {
    ticketUpdated: {
      subscribe: () => {
        // Implementation for ticket update subscription
        // This would use pubsub mechanism
      }
    },

    ticketCreated: {
      subscribe: () => {
        // Implementation for ticket creation subscription
        // This would use pubsub mechanism
      }
    },

    ticketAssigned: {
      subscribe: () => {
        // Implementation for ticket assignment subscription
        // This would use pubsub mechanism
      }
    },
  },
};