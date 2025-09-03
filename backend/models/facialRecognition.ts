// Facial Recognition Attendance Model
// This model stores facial data and attendance logs for staff
import { Schema, model, Document } from 'mongoose';

export interface IFacialRecognition extends Document {
  staffId: string;
  faceEncoding: string; // Encoded facial data (could be base64 or vector)
  attendanceLogs: Array<{
    timestamp: Date;
    location: string;
    verified: boolean;
  }>;
}

const FacialRecognitionSchema = new Schema<IFacialRecognition>({
  staffId: { type: String, required: true, index: true },
  faceEncoding: { type: String, required: true },
  attendanceLogs: [
    {
      timestamp: { type: Date, required: true },
      location: { type: String, required: true },
      verified: { type: Boolean, default: false },
    },
  ],
});

export default model<IFacialRecognition>('FacialRecognition', FacialRecognitionSchema);
