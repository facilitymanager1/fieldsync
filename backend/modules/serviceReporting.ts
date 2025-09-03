// Service Reporting & Checklists module
// Handles dynamic forms, checklists, attachments
import { Request, Response } from 'express';

let reports = [
  {
    id: '1',
    staffId: '1',
    date: '2025-07-28',
    location: 'Main Office',
    status: 'completed',
    summary: 'Routine maintenance completed.',
  },
  {
    id: '2',
    staffId: '2',
    date: '2025-07-27',
    location: 'Warehouse',
    status: 'pending',
    summary: 'Inspection scheduled.',
  },
  {
    id: '3',
    staffId: '3',
    date: '2025-07-26',
    location: 'Remote Site',
    status: 'completed',
    summary: 'Equipment replaced.',
  },
];

export function getServiceReports(req: Request, res: Response) {
  res.json({ reports });
}

export function submitServiceReport(report: any) {
  // Import getAttachmentById lazily to avoid circular deps
  const { getAttachmentById } = require('./attachment');
  let attachments = [];
  if (Array.isArray(report.attachmentIds)) {
    attachments = report.attachmentIds.map((id: string) => getAttachmentById(id)).filter(Boolean);
  }
  reports.push({ ...report, id: (reports.length + 1).toString(), attachments });
}
