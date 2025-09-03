// Comprehensive Expense Management Data Models for FieldSync Backend
import mongoose from 'mongoose';

// Expense Entry Interface
export interface ExpenseEntry {
  id: string;
  staffId: string;
  amount: number;
  currency: string;
  category: 'travel' | 'meals' | 'accommodation' | 'fuel' | 'supplies' | 'maintenance' | 'parking' | 'tolls' | 'other';
  subcategory?: string;
  description: string;
  receiptPhoto?: string;
  additionalDocuments?: string[];
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
  };
  timestamp: Date;
  expenseDate: Date;
  status: 'draft' | 'submitted' | 'pending_review' | 'approved' | 'rejected' | 'paid';
  submittedAt?: Date;
  approvalWorkflow: ApprovalStep[];
  currentApprovalLevel: number;
  paymentInfo?: PaymentInfo;
  metadata: {
    deviceInfo?: any;
    mileage?: number;
    vehicleId?: string;
    projectId?: string;
    clientId?: string;
    isRecurring?: boolean;
    recurringPeriod?: 'weekly' | 'monthly' | 'quarterly';
  };
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Approval Workflow Step
export interface ApprovalStep {
  level: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  timestamp?: Date;
  comments?: string;
  approvalLimit?: number;
  isDelegated?: boolean;
  delegatedTo?: string;
}

// Payment Information
export interface PaymentInfo {
  method: 'bank_transfer' | 'check' | 'petty_cash' | 'corporate_card' | 'reimbursement';
  accountNumber?: string;
  transactionId?: string;
  paymentDate?: Date;
  processedBy?: string;
}

// Expense Policy Configuration
export interface ExpensePolicy {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  rules: PolicyRule[];
  approvalWorkflow: ApprovalWorkflowConfig[];
  applicableRoles: string[];
  effectiveDate: Date;
  expiryDate?: Date;
}

export interface PolicyRule {
  id: string;
  category: string;
  maxAmount?: number;
  requiresReceipt: boolean;
  requiresApproval: boolean;
  description: string;
  autoApprovalThreshold?: number;
}

export interface ApprovalWorkflowConfig {
  level: number;
  role: string;
  maxApprovalLimit?: number;
  isRequired: boolean;
  canDelegate: boolean;
}

// Expense Report
export interface ExpenseReport {
  id: string;
  reportNumber: string;
  staffId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  expenses: string[]; // Expense IDs
  totalAmount: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Database Schemas
const ExpenseEntrySchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  category: { 
    type: String, 
    enum: ['travel', 'meals', 'accommodation', 'fuel', 'supplies', 'maintenance', 'parking', 'tolls', 'other'],
    required: true 
  },
  subcategory: String,
  description: { type: String, required: true },
  receiptPhoto: String,
  additionalDocuments: [String],
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: Number,
    address: String,
  },
  timestamp: { type: Date, default: Date.now },
  expenseDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'pending_review', 'approved', 'rejected', 'paid'],
    default: 'draft',
    index: true
  },
  submittedAt: Date,
  approvalWorkflow: [{
    level: { type: Number, required: true },
    approverId: { type: String, required: true },
    approverName: { type: String, required: true },
    approverRole: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'delegated'],
      default: 'pending'
    },
    timestamp: Date,
    comments: String,
    approvalLimit: Number,
    isDelegated: { type: Boolean, default: false },
    delegatedTo: String,
  }],
  currentApprovalLevel: { type: Number, default: 0 },
  paymentInfo: {
    method: { 
      type: String, 
      enum: ['bank_transfer', 'check', 'petty_cash', 'corporate_card', 'reimbursement']
    },
    accountNumber: String,
    transactionId: String,
    paymentDate: Date,
    processedBy: String,
  },
  metadata: {
    deviceInfo: mongoose.Schema.Types.Mixed,
    mileage: Number,
    vehicleId: String,
    projectId: String,
    clientId: String,
    isRecurring: { type: Boolean, default: false },
    recurringPeriod: { type: String, enum: ['weekly', 'monthly', 'quarterly'] },
  },
  tags: [String],
  notes: String,
}, {
  timestamps: true,
});

const ExpensePolicySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  isActive: { type: Boolean, default: true },
  rules: [{
    id: { type: String, required: true },
    category: { type: String, required: true },
    maxAmount: Number,
    requiresReceipt: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: true },
    description: String,
    autoApprovalThreshold: Number,
  }],
  approvalWorkflow: [{
    level: { type: Number, required: true },
    role: { type: String, required: true },
    maxApprovalLimit: Number,
    isRequired: { type: Boolean, default: true },
    canDelegate: { type: Boolean, default: false },
  }],
  applicableRoles: [String],
  effectiveDate: { type: Date, required: true },
  expiryDate: Date,
}, {
  timestamps: true,
});

const ExpenseReportSchema = new mongoose.Schema({
  reportNumber: { type: String, required: true, unique: true },
  staffId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseEntry' }],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'approved', 'rejected', 'paid'],
    default: 'draft',
    index: true
  },
  submittedAt: Date,
  approvedAt: Date,
  approvedBy: String,
}, {
  timestamps: true,
});

// Indexes for performance
ExpenseEntrySchema.index({ staffId: 1, status: 1 });
ExpenseEntrySchema.index({ expenseDate: 1 });
ExpenseEntrySchema.index({ category: 1, status: 1 });
ExpenseEntrySchema.index({ 'metadata.projectId': 1 });

ExpenseReportSchema.index({ staffId: 1, status: 1 });
ExpenseReportSchema.index({ startDate: 1, endDate: 1 });

// Models
export const ExpenseEntryModel = mongoose.model('ExpenseEntry', ExpenseEntrySchema);
export const ExpensePolicyModel = mongoose.model('ExpensePolicy', ExpensePolicySchema);
export const ExpenseReportModel = mongoose.model('ExpenseReport', ExpenseReportSchema);
