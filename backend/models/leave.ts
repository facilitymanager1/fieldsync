// Leave Management Model
// Stores leave requests and balances for staff
import { Schema, model, Document } from 'mongoose';

export interface ILeave extends Document {
  staffId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  appliedAt: Date;
  approvedBy?: string;
}

const LeaveSchema = new Schema<ILeave>({
  staffId: { type: String, required: true, index: true },
  leaveType: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reason: { type: String },
  appliedAt: { type: Date, default: Date.now },
  approvedBy: { type: String },
});

export default model<ILeave>('Leave', LeaveSchema);
