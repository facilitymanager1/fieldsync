import mongoose, { Schema, Document } from 'mongoose';

export interface TicketHistory {
  action: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  performedBy: string;
  timestamp: Date;
  comment?: string;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface Ticket extends Document {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: 'Maintenance' | 'Repair' | 'Installation' | 'Inspection' | 'Emergency' | 'Other';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed' | 'Cancelled';
  severity: 'Minor' | 'Major' | 'Critical';
  
  // Assignment and ownership
  createdBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  assignedTeam?: string;
  
  // Location and site information
  siteId?: string;
  location?: {
    name: string;
    address: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // Timing and SLA
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  slaDeadline?: Date;
  slaTimer: number;
  
  // Resolution information
  resolution?: string;
  resolutionDate?: Date;
  customerSatisfaction?: number; // 1-5 rating
  
  // Related data
  attachments: TicketAttachment[];
  history: TicketHistory[];
  relatedTickets?: string[];
  tags: string[];
  
  // Custom fields for different industries
  customFields?: { [key: string]: any };
}

const TicketHistorySchema = new Schema({
  action: { type: String, required: true },
  field: { type: String },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  comment: { type: String }
});

const TicketAttachmentSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const TicketSchema: Schema = new Schema({
  ticketNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  category: {
    type: String,
    required: true,
    enum: ['Maintenance', 'Repair', 'Installation', 'Inspection', 'Emergency', 'Other'],
    index: true
  },
  priority: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium',
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Cancelled'],
    default: 'Open',
    index: true
  },
  severity: {
    type: String,
    enum: ['Minor', 'Major', 'Critical'],
    default: 'Minor'
  },
  
  // Assignment
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assignedTeam: {
    type: String,
    index: true
  },
  
  // Location
  siteId: {
    type: String,
    index: true
  },
  location: {
    name: { type: String },
    address: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  
  // Timing
  dueDate: { type: Date, index: true },
  estimatedHours: { type: Number, min: 0 },
  actualHours: { type: Number, min: 0 },
  slaDeadline: { type: Date, index: true },
  slaTimer: { type: Number, default: 0 },
  
  // Resolution
  resolution: { type: String, maxlength: 2000 },
  resolutionDate: { type: Date },
  customerSatisfaction: { type: Number, min: 1, max: 5 },
  
  // Related data
  attachments: [TicketAttachmentSchema],
  history: [TicketHistorySchema],
  relatedTickets: [{ type: String }],
  tags: [{ type: String, index: true }],
  
  customFields: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
TicketSchema.index({ ticketNumber: 1 });
TicketSchema.index({ status: 1, priority: 1 });
TicketSchema.index({ createdBy: 1, status: 1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ category: 1, createdAt: -1 });
TicketSchema.index({ dueDate: 1, status: 1 });
TicketSchema.index({ slaDeadline: 1 });
TicketSchema.index({ tags: 1 });
TicketSchema.index({ createdAt: -1 });

// Auto-generate ticket number
TicketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Ticket').countDocuments({
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.ticketNumber = `TK-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export default mongoose.model<Ticket>('Ticket', TicketSchema);
