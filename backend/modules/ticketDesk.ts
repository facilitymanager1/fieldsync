// Work-Order & Ticket Support Desk module
// Handles ticket CRUD, routing, queues
import { Request, Response } from 'express';
import { Ticket } from '../models/ticket';
import { User } from '../models/user';
import { auditLogger } from '../middleware/auditLogger';
import { notification } from './notification';

// Ticket Desk interfaces
export interface ITicketQueue {
  _id?: string;
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  autoAssignment: boolean;
  routingRules: IRoutingRule[];
  slaTemplate: string;
  assignmentStrategy: 'round_robin' | 'least_loaded' | 'skill_based' | 'priority_based';
  maxConcurrentTickets: number;
  escalationRules: IEscalationRule[];
  workingHours: {
    timezone: string;
    schedule: Record<string, { start: string; end: string; isWorkingDay: boolean }>;
  };
  agents: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoutingRule {
  _id?: string;
  name: string;
  conditions: IRoutingCondition[];
  actions: IRoutingAction[];
  priority: number;
  isActive: boolean;
}

export interface IRoutingCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'regex';
  value: any;
  caseSensitive?: boolean;
}

export interface IRoutingAction {
  type: 'assign_queue' | 'assign_agent' | 'set_priority' | 'add_tag' | 'send_notification';
  value: any;
  metadata?: Record<string, any>;
}

export interface IEscalationRule {
  _id?: string;
  name: string;
  condition: 'time_based' | 'sla_breach' | 'no_response' | 'manual';
  triggerAfter: number; // minutes
  escalateTo: 'queue' | 'agent' | 'manager';
  targetId: string;
  notificationTemplate?: string;
  isActive: boolean;
}

export interface ITicketMetrics {
  queueId: string;
  totalTickets: number;
  openTickets: number;
  assignedTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  averageResolutionTime: number;
  averageResponseTime: number;
  slaCompliance: number;
  agentWorkload: {
    agentId: string;
    activeTickets: number;
    completedToday: number;
    averageHandleTime: number;
  }[];
}

// Default queue configurations
const DEFAULT_QUEUES: Record<string, ITicketQueue> = {
  'general-support': {
    name: 'General Support',
    description: 'General customer support requests',
    priority: 1,
    isActive: true,
    autoAssignment: true,
    routingRules: [
      {
        name: 'High Priority Routing',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'high' }
        ],
        actions: [
          { type: 'assign_queue', value: 'urgent-support' }
        ],
        priority: 1,
        isActive: true
      }
    ],
    slaTemplate: 'standard-sla',
    assignmentStrategy: 'least_loaded',
    maxConcurrentTickets: 5,
    escalationRules: [
      {
        name: 'First Response Escalation',
        condition: 'time_based',
        triggerAfter: 60, // 1 hour
        escalateTo: 'manager',
        targetId: 'manager-id',
        isActive: true
      }
    ],
    workingHours: {
      timezone: 'UTC',
      schedule: {
        monday: { start: '09:00', end: '17:00', isWorkingDay: true },
        tuesday: { start: '09:00', end: '17:00', isWorkingDay: true },
        wednesday: { start: '09:00', end: '17:00', isWorkingDay: true },
        thursday: { start: '09:00', end: '17:00', isWorkingDay: true },
        friday: { start: '09:00', end: '17:00', isWorkingDay: true },
        saturday: { start: '09:00', end: '13:00', isWorkingDay: false },
        sunday: { start: '09:00', end: '13:00', isWorkingDay: false }
      }
    },
    agents: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  'urgent-support': {
    name: 'Urgent Support',
    description: 'High priority and urgent support requests',
    priority: 10,
    isActive: true,
    autoAssignment: true,
    routingRules: [],
    slaTemplate: 'urgent-sla',
    assignmentStrategy: 'skill_based',
    maxConcurrentTickets: 3,
    escalationRules: [
      {
        name: 'Immediate Escalation',
        condition: 'time_based',
        triggerAfter: 15, // 15 minutes
        escalateTo: 'manager',
        targetId: 'senior-manager-id',
        isActive: true
      }
    ],
    workingHours: {
      timezone: 'UTC',
      schedule: {
        monday: { start: '00:00', end: '23:59', isWorkingDay: true },
        tuesday: { start: '00:00', end: '23:59', isWorkingDay: true },
        wednesday: { start: '00:00', end: '23:59', isWorkingDay: true },
        thursday: { start: '00:00', end: '23:59', isWorkingDay: true },
        friday: { start: '00:00', end: '23:59', isWorkingDay: true },
        saturday: { start: '00:00', end: '23:59', isWorkingDay: true },
        sunday: { start: '00:00', end: '23:59', isWorkingDay: true }
      }
    },
    agents: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  'technical-support': {
    name: 'Technical Support',
    description: 'Technical issues and system problems',
    priority: 5,
    isActive: true,
    autoAssignment: true,
    routingRules: [
      {
        name: 'System Issue Routing',
        conditions: [
          { field: 'category', operator: 'in', value: ['system', 'technical', 'bug'] }
        ],
        actions: [
          { type: 'add_tag', value: 'technical' },
          { type: 'set_priority', value: 'high' }
        ],
        priority: 1,
        isActive: true
      }
    ],
    slaTemplate: 'technical-sla',
    assignmentStrategy: 'skill_based',
    maxConcurrentTickets: 4,
    escalationRules: [
      {
        name: 'Technical Escalation',
        condition: 'sla_breach',
        triggerAfter: 120, // 2 hours
        escalateTo: 'agent',
        targetId: 'senior-tech-id',
        isActive: true
      }
    ],
    workingHours: {
      timezone: 'UTC',
      schedule: {
        monday: { start: '08:00', end: '18:00', isWorkingDay: true },
        tuesday: { start: '08:00', end: '18:00', isWorkingDay: true },
        wednesday: { start: '08:00', end: '18:00', isWorkingDay: true },
        thursday: { start: '08:00', end: '18:00', isWorkingDay: true },
        friday: { start: '08:00', end: '18:00', isWorkingDay: true },
        saturday: { start: '10:00', end: '14:00', isWorkingDay: false },
        sunday: { start: '10:00', end: '14:00', isWorkingDay: false }
      }
    },
    agents: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

/**
 * Create ticket with intelligent routing
 */
export async function createTicket(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const {
      title,
      description,
      category,
      priority = 'medium',
      customerId,
      location,
      dueDate,
      tags = [],
      attachments = [],
      metadata = {}
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title and description are required'
      });
    }

    // Create ticket object
    const ticketData = {
      title,
      description,
      category: category || 'general',
      priority,
      status: 'new',
      customerId: customerId || userId,
      reportedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      location,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags,
      attachments,
      metadata: {
        ...metadata,
        source: 'ticket_desk',
        routing: {
          originalQueue: null,
          routingHistory: []
        }
      }
    };

    // Apply intelligent routing
    const routingResult = await applyRoutingRules(ticketData);
    
    if (routingResult.queueId) {
      ticketData.metadata.routing.originalQueue = routingResult.queueId;
      ticketData.metadata.routing.routingHistory.push({
        action: 'routed_to_queue',
        queueId: routingResult.queueId,
        reason: routingResult.reason,
        timestamp: new Date()
      });
    }

    // Create ticket in database
    const ticket = await Ticket.create(ticketData);

    // Apply auto-assignment if enabled
    if (routingResult.queueId) {
      const queue = DEFAULT_QUEUES[routingResult.queueId];
      if (queue?.autoAssignment) {
        const assignmentResult = await autoAssignTicket(ticket._id.toString(), routingResult.queueId);
        if (assignmentResult.success) {
          await Ticket.findByIdAndUpdate(ticket._id, {
            assignedTo: assignmentResult.agentId,
            status: 'assigned',
            'metadata.assignment': {
              strategy: queue.assignmentStrategy,
              assignedAt: new Date(),
              assignedBy: 'system'
            }
          });
        }
      }
    }

    // Log ticket creation
    auditLogger.info('Ticket created via Ticket Desk', {
      userId,
      action: 'CREATE_TICKET_DESK',
      resource: 'ticket',
      resourceId: ticket._id.toString(),
      changes: ticketData
    });

    // Send notifications
    if (routingResult.queueId) {
      await notifyQueueAgents(routingResult.queueId, ticket._id.toString());
    }

    res.status(201).json({
      success: true,
      message: 'Ticket created and routed successfully',
      data: {
        ticket: await Ticket.findById(ticket._id)
          .populate('customerId', 'name email')
          .populate('assignedTo', 'name email')
          .lean(),
        routing: routingResult
      }
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create ticket'
    });
  }
}

/**
 * Get ticket queues
 */
export async function getTicketQueues(req: Request, res: Response) {
  try {
    const queues = await Promise.all(
      Object.entries(DEFAULT_QUEUES).map(async ([id, queue]) => {
        const metrics = await calculateQueueMetrics(id);
        return {
          id,
          ...queue,
          metrics
        };
      })
    );

    res.json({
      success: true,
      data: {
        queues,
        count: queues.length
      }
    });

  } catch (error) {
    console.error('Error getting ticket queues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ticket queues'
    });
  }
}

/**
 * Get queue metrics and analytics
 */
export async function getQueueMetrics(req: Request, res: Response) {
  try {
    const { queueId } = req.params;
    const { period = '24h' } = req.query;

    if (!DEFAULT_QUEUES[queueId]) {
      return res.status(404).json({
        success: false,
        error: 'Queue not found'
      });
    }

    const metrics = await calculateQueueMetrics(queueId, period as string);

    res.json({
      success: true,
      data: { metrics }
    });

  } catch (error) {
    console.error('Error getting queue metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue metrics'
    });
  }
}

/**
 * Assign ticket to agent manually
 */
export async function assignTicketToAgent(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;
    const { agentId, queueId, reason } = req.body;
    const userId = req.user?.id;

    if (!agentId && !queueId) {
      return res.status(400).json({
        success: false,
        error: 'Either agent ID or queue ID is required'
      });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const updateData: any = {
      updatedAt: new Date(),
      'metadata.assignment': {
        assignedAt: new Date(),
        assignedBy: userId,
        reason: reason || 'Manual assignment'
      }
    };

    if (agentId) {
      updateData.assignedTo = agentId;
      updateData.status = 'assigned';
    }

    if (queueId) {
      updateData['metadata.routing.currentQueue'] = queueId;
    }

    await Ticket.findByIdAndUpdate(ticketId, updateData);

    // Log assignment
    auditLogger.info('Ticket manually assigned', {
      userId,
      action: 'ASSIGN_TICKET',
      resource: 'ticket',
      resourceId: ticketId,
      changes: { agentId, queueId, reason }
    });

    // Notify assigned agent
    if (agentId) {
      await notification.sendNotification({
        userId: agentId,
        title: 'New Ticket Assigned',
        message: `Ticket "${ticket.title}" has been assigned to you`,
        type: 'info',
        priority: ticket.priority === 'high' ? 'high' : 'medium',
        actionUrl: `/dashboard/tickets/${ticketId}`
      });
    }

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      data: {
        ticket: await Ticket.findById(ticketId)
          .populate('assignedTo', 'name email')
          .lean()
      }
    });

  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign ticket'
    });
  }
}

/**
 * Bulk update tickets
 */
export async function bulkUpdateTickets(req: Request, res: Response) {
  try {
    const { ticketIds, updates } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ticket IDs array is required'
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates object is required'
      });
    }

    const updateData = {
      ...updates,
      updatedAt: new Date(),
      'metadata.bulkUpdate': {
        updatedBy: userId,
        updatedAt: new Date(),
        ticketsCount: ticketIds.length
      }
    };

    const result = await Ticket.updateMany(
      { _id: { $in: ticketIds } },
      updateData
    );

    // Log bulk update
    auditLogger.info('Bulk ticket update', {
      userId,
      action: 'BULK_UPDATE_TICKETS',
      resource: 'ticket',
      metadata: {
        ticketIds,
        updates,
        modifiedCount: result.modifiedCount
      }
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} tickets updated successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    });

  } catch (error) {
    console.error('Error bulk updating tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update tickets'
    });
  }
}

/**
 * Transfer ticket between queues
 */
export async function transferTicket(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;
    const { targetQueueId, reason, unassign = false } = req.body;
    const userId = req.user?.id;

    if (!targetQueueId) {
      return res.status(400).json({
        success: false,
        error: 'Target queue ID is required'
      });
    }

    if (!DEFAULT_QUEUES[targetQueueId]) {
      return res.status(404).json({
        success: false,
        error: 'Target queue not found'
      });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const updateData: any = {
      updatedAt: new Date(),
      'metadata.routing.currentQueue': targetQueueId
    };

    // Add to routing history
    const routingHistory = ticket.metadata?.routing?.routingHistory || [];
    routingHistory.push({
      action: 'transferred',
      fromQueue: ticket.metadata?.routing?.currentQueue,
      toQueue: targetQueueId,
      reason: reason || 'Manual transfer',
      transferredBy: userId,
      timestamp: new Date()
    });
    updateData['metadata.routing.routingHistory'] = routingHistory;

    // Unassign if requested
    if (unassign) {
      updateData.assignedTo = null;
      updateData.status = 'new';
    }

    await Ticket.findByIdAndUpdate(ticketId, updateData);

    // Auto-assign in new queue if enabled
    const targetQueue = DEFAULT_QUEUES[targetQueueId];
    if (targetQueue.autoAssignment && unassign) {
      const assignmentResult = await autoAssignTicket(ticketId, targetQueueId);
      if (assignmentResult.success) {
        await Ticket.findByIdAndUpdate(ticketId, {
          assignedTo: assignmentResult.agentId,
          status: 'assigned'
        });
      }
    }

    // Log transfer
    auditLogger.info('Ticket transferred between queues', {
      userId,
      action: 'TRANSFER_TICKET',
      resource: 'ticket',
      resourceId: ticketId,
      changes: { targetQueueId, reason, unassign }
    });

    res.json({
      success: true,
      message: 'Ticket transferred successfully',
      data: {
        ticket: await Ticket.findById(ticketId)
          .populate('assignedTo', 'name email')
          .lean()
      }
    });

  } catch (error) {
    console.error('Error transferring ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transfer ticket'
    });
  }
}

// Utility functions

async function applyRoutingRules(ticketData: any): Promise<{ queueId?: string; reason: string }> {
  // Apply routing rules based on ticket properties
  for (const [queueId, queue] of Object.entries(DEFAULT_QUEUES)) {
    if (!queue.isActive) continue;

    for (const rule of queue.routingRules) {
      if (!rule.isActive) continue;

      const matches = rule.conditions.every(condition => {
        return evaluateCondition(ticketData, condition);
      });

      if (matches) {
        // Apply actions
        for (const action of rule.actions) {
          if (action.type === 'assign_queue') {
            return {
              queueId: action.value,
              reason: `Matched routing rule: ${rule.name}`
            };
          }
        }

        return {
          queueId,
          reason: `Matched routing rule: ${rule.name} in queue: ${queue.name}`
        };
      }
    }
  }

  // Default to general support queue
  return {
    queueId: 'general-support',
    reason: 'Default routing to general support'
  };
}

function evaluateCondition(ticketData: any, condition: IRoutingCondition): boolean {
  const fieldValue = getFieldValue(ticketData, condition.field);

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'contains':
      return typeof fieldValue === 'string' && 
             fieldValue.toLowerCase().includes(condition.value.toLowerCase());
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'greater_than':
      return fieldValue > condition.value;
    case 'less_than':
      return fieldValue < condition.value;
    case 'regex':
      return new RegExp(condition.value).test(fieldValue);
    default:
      return false;
  }
}

function getFieldValue(obj: any, field: string): any {
  return field.split('.').reduce((value, key) => value?.[key], obj);
}

async function autoAssignTicket(ticketId: string, queueId: string): Promise<{ success: boolean; agentId?: string }> {
  const queue = DEFAULT_QUEUES[queueId];
  if (!queue || !queue.autoAssignment) {
    return { success: false };
  }

  // Get available agents (simplified - would query actual agent availability)
  const availableAgents = await User.find({
    role: { $in: ['fieldtech', 'supervisor'] },
    isActive: true
  }).limit(5).lean();

  if (availableAgents.length === 0) {
    return { success: false };
  }

  // Simple round-robin assignment
  const selectedAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)];

  return {
    success: true,
    agentId: selectedAgent._id.toString()
  };
}

async function calculateQueueMetrics(queueId: string, period: string = '24h'): Promise<ITicketMetrics> {
  // Calculate time range
  const now = new Date();
  const periodHours = period === '7d' ? 168 : period === '30d' ? 720 : 24;
  const startTime = new Date(now.getTime() - (periodHours * 60 * 60 * 1000));

  // Mock metrics calculation (would use real database queries)
  const mockMetrics: ITicketMetrics = {
    queueId,
    totalTickets: Math.floor(Math.random() * 100) + 50,
    openTickets: Math.floor(Math.random() * 20) + 5,
    assignedTickets: Math.floor(Math.random() * 15) + 3,
    inProgressTickets: Math.floor(Math.random() * 10) + 2,
    resolvedTickets: Math.floor(Math.random() * 80) + 40,
    averageResolutionTime: Math.floor(Math.random() * 240) + 60, // minutes
    averageResponseTime: Math.floor(Math.random() * 30) + 5, // minutes
    slaCompliance: Math.floor(Math.random() * 20) + 80, // percentage
    agentWorkload: [
      {
        agentId: 'agent-1',
        activeTickets: Math.floor(Math.random() * 5) + 1,
        completedToday: Math.floor(Math.random() * 10) + 3,
        averageHandleTime: Math.floor(Math.random() * 60) + 30
      },
      {
        agentId: 'agent-2', 
        activeTickets: Math.floor(Math.random() * 5) + 1,
        completedToday: Math.floor(Math.random() * 10) + 3,
        averageHandleTime: Math.floor(Math.random() * 60) + 30
      }
    ]
  };

  return mockMetrics;
}

async function notifyQueueAgents(queueId: string, ticketId: string) {
  const queue = DEFAULT_QUEUES[queueId];
  if (!queue) return;

  // Get queue agents
  const agents = await User.find({
    _id: { $in: queue.agents },
    isActive: true
  }).select('_id name email');

  // Send notifications to all queue agents
  for (const agent of agents) {
    await notification.sendNotification({
      userId: agent._id.toString(),
      title: 'New Ticket in Queue',
      message: `A new ticket has been added to ${queue.name} queue`,
      type: 'info',
      priority: 'medium',
      actionUrl: `/dashboard/tickets/${ticketId}`
    });
  }
}

// Export functions
export {
  getTicketQueues,
  getQueueMetrics,
  assignTicketToAgent,
  bulkUpdateTickets,
  transferTicket,
  ITicketQueue,
  IRoutingRule,
  IEscalationRule,
  ITicketMetrics
};