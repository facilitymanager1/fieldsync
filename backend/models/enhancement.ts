// Advanced Enhancements & Future Roadmap Model
// Stores feature requests, enhancements, and roadmap items
import { Schema, model, Document } from 'mongoose';

export interface IEnhancement extends Document {
  title: string;
  description: string;
  status: 'planned' | 'in-progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const EnhancementSchema = new Schema<IEnhancement>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['planned', 'in-progress', 'completed'], default: 'planned' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default model<IEnhancement>('Enhancement', EnhancementSchema);
