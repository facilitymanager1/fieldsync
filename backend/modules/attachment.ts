import { Request, Response } from 'express';
import { Attachment } from '../models/attachment';
import { AuthenticatedRequest } from '../middleware/auth';

// Extend Request interface for file uploads
interface FileUploadRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

// In-memory attachment store
const attachments: Attachment[] = [];

export function handleUpload(req: FileUploadRequest, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const id = (attachments.length + 1).toString();
  const attachment: Attachment = {
    id,
    filename: req.file.originalname,
    url: `/api/attachments/${id}`,
    uploadedBy: req.user?.username || 'unknown',
    uploadedAt: new Date(),
  };
  // Store file buffer in memory (not for production!)
  (attachment as any).buffer = req.file.buffer;
  attachments.push(attachment);
  res.status(201).json({ attachment });
}

export function getAttachment(req: Request, res: Response) {
  const { id } = req.params;
  const attachment = attachments.find(a => a.id === id);
  if (!attachment) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send((attachment as any).buffer);
}

export function getAttachmentById(id: string): Attachment | undefined {
  return attachments.find(a => a.id === id);
}
