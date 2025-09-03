// Knowledge Base & Training Model
// Stores articles, training materials, and quizzes

import { Schema, model, Document } from 'mongoose';
import { Attachment } from './attachment';

export interface IKnowledgeBase extends Document {
  title: string;
  content: string;
  type: 'article' | 'training' | 'quiz';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  attachments?: Attachment[];
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['article', 'training', 'quiz'], required: true },
  tags: [{ type: String }],
  attachments: [{
    id: String,
    filename: String,
    url: String,
    uploadedBy: String,
    uploadedAt: Date,
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);
