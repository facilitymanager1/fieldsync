/**
 * Ticket/Work Order Management for FieldSync
 * Handles complete ticket lifecycle with production data persistence
 */

import Ticket from '../models/ticket';
import { Request, Response } from 'express';

// Create a new ticket
export async function createTicket(req: Request, res: Response) {
  try {
    const ticketData = req.body;
    const userId = (req as any).user.id;

    // Auto-assign ticket number if not provided
    if (!ticketData.ticketNumber) {
      const lastTicket = await Ticket.findOne().sort({ ticketNumber: -1 });
      const nextNumber = lastTicket ? lastTicket.ticketNumber + 1 : 1;
      ticketData.ticketNumber = nextNumber;
    }

    // Set creator
    ticketData.createdBy = userId;
    ticketData.assignedTo = ticketData.assignedTo || userId;

    const ticket = new Ticket(ticketData);
    await ticket.save();

    // Populate references for response
    await ticket.populate([
      { path: 'createdBy', select: 'profile.firstName profile.lastName email' },
      { path: 'assignedTo', select: 'profile.firstName profile.lastName email' },
      { path: 'client', select: 'name email' }
    ]);

    res.status(201).json({ 
      message: 'Ticket created successfully',
      ticket 
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get all tickets with filtering and pagination
export async function getTickets(req: Request, res: Response) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      assignedTo,
      client,
      search
    } = req.query;

    const filter: any = {};

    // Apply filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (client) filter.client = client;

    // Search in title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const tickets = await Ticket.find(filter)
      .populate([
        { path: 'createdBy', select: 'profile.firstName profile.lastName email' },
        { path: 'assignedTo', select: 'profile.firstName profile.lastName email' },
        { path: 'client', select: 'name email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Ticket.countDocuments(filter);

    res.json({
      tickets,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get single ticket by ID
export async function getTicketById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id)
      .populate([
        { path: 'createdBy', select: 'profile.firstName profile.lastName email' },
        { path: 'assignedTo', select: 'profile.firstName profile.lastName email' },
        { path: 'client', select: 'name email phone address' }
      ]);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ ticket });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update ticket
export async function updateTicket(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user.id;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Track status changes
    if (updates.status && updates.status !== ticket.status) {
      ticket.statusHistory.push({
        status: updates.status,
        changedBy: userId,
        timestamp: new Date(),
        notes: updates.statusNotes || ''
      });
    }

    // Update fields
    Object.assign(ticket, updates);
    ticket.updatedBy = userId;
    
    await ticket.save();

    // Populate for response
    await ticket.populate([
      { path: 'createdBy', select: 'profile.firstName profile.lastName email' },
      { path: 'assignedTo', select: 'profile.firstName profile.lastName email' },
      { path: 'client', select: 'name email' }
    ]);

    res.json({ 
      message: 'Ticket updated successfully',
      ticket 
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update ticket status (legacy compatibility)
export async function updateTicketStatus(req: Request, res: Response) {
  try {
    const { ticketId, status, updatedBy } = req.body;
    const userId = (req as any).user?.id || updatedBy;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Track status change
    ticket.statusHistory.push({
      status,
      changedBy: userId,
      timestamp: new Date(),
      notes: req.body.notes || ''
    });

    ticket.status = status;
    ticket.updatedBy = userId;
    await ticket.save();

    res.json({ 
      message: 'Status updated', 
      ticket 
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Assign ticket (legacy compatibility)
export async function assignTicket(req: Request, res: Response) {
  try {
    const { ticketId, assignee, updatedBy } = req.body;
    const userId = (req as any).user?.id || updatedBy;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    ticket.assignedTo = assignee;
    ticket.updatedBy = userId;
    await ticket.save();

    await ticket.populate('assignedTo', 'profile.firstName profile.lastName email');

    res.json({ 
      message: 'Ticket assigned', 
      ticket 
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete ticket
export async function deleteTicket(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Add comment to ticket
export async function addComment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { text, isInternal = false } = req.body;
    const userId = (req as any).user.id;

    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    ticket.comments.push({
      text,
      author: userId,
      isInternal,
      timestamp: new Date()
    });

    await ticket.save();

    // Get the updated ticket with populated data
    await ticket.populate([
      { path: 'comments.author', select: 'profile.firstName profile.lastName email' }
    ]);

    res.json({ 
      message: 'Comment added successfully',
      ticket 
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get ticket statistics
export async function getTicketStats(req: Request, res: Response) {
  try {
    const stats = await Ticket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Ticket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await Ticket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent activity
    const recentTickets = await Ticket.find()
      .populate('assignedTo', 'profile.firstName profile.lastName')
      .sort({ updatedAt: -1 })
      .limit(5);

    res.json({
      statusStats: stats,
      priorityStats,
      categoryStats,
      recentActivity: recentTickets
    });
  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
