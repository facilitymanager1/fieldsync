// Notification model for FieldSync backend
// Stores user/admin notification preferences and notification logs

import { Schema, model, Document } from 'mongoose';

export interface NotificationPreference {
  userId: string;
  type: string; // e.g. 'shift', 'leave', 'ticket', etc.
  enabled: boolean;
}

export interface NotificationLog {
  userId: string;
  type: string;
  message: string;
  sentAt: Date;
  via: 'email' | 'push' | 'sms';
}

export interface NotificationDoc extends Document {
  userId: string;
  preferences: NotificationPreference[];
  logs: NotificationLog[];
}

const NotificationSchema = new Schema<NotificationDoc>({
  userId: { type: String, required: true, unique: true },
  preferences: [
    {
      type: { type: String, required: true },
      enabled: { type: Boolean, default: true },
    },
  ],
  logs: [
    {
      userId: { type: String, required: true },
      type: { type: String, required: true },
      message: { type: String, required: true },
      sentAt: { type: Date, default: Date.now },
      via: { type: String, enum: ['email', 'push', 'sms'], required: true },
    },
  ],
});

export default model<NotificationDoc>('Notification', NotificationSchema);
