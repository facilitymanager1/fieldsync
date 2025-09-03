// Attachment model for file uploads
export interface Attachment {
  id: string;
  filename: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  ticketId?: string;
  reportId?: string;
  knowledgeBaseId?: string;
}
