// Lead Generation & Referral Engine Model
// Stores leads and referrals for business development
import { Schema, model, Document } from 'mongoose';

export interface ILead extends Document {
  leadId: string;
  name: string;
  contact: string;
  source: string;
  referredBy?: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  createdAt: Date;
}

const LeadSchema = new Schema<ILead>({
  leadId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  source: { type: String, required: true },
  referredBy: { type: String },
  status: { type: String, enum: ['new', 'contacted', 'converted', 'closed'], default: 'new' },
  createdAt: { type: Date, default: Date.now },
});

export default model<ILead>('Lead', LeadSchema);
