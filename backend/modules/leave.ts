// Leave Management Business Logic
import { Request, Response } from 'express';
import { getUserNotificationPreferences, sendEmailNotification } from './notification';

// In-memory leave store (replace with DB in production)
let leaves: any[] = [];

export function requestLeave(req: Request, res: Response) {
  const { staffId, leaveType, startDate, endDate, reason } = req.body;
  const leave = {
    id: (leaves.length + 1).toString(),
    staffId,
    leaveType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    status: 'pending',
    reason,
    appliedAt: new Date(),
    approvedBy: null,
  };
  leaves.push(leave);
  res.status(201).json({ message: 'Leave requested', leave });
}

export async function approveLeave(req: Request, res: Response) {
  const { leaveId, status, approvedBy } = req.body; // status: 'approved' | 'rejected'
  const leave = leaves.find(l => l.id === leaveId);
  if (!leave) return res.status(404).json({ error: 'Leave request not found' });
  leave.status = status;
  leave.approvedBy = approvedBy;

  // Notification logic
  // In production, fetch staff email from DB
  const staffEmail = leave.staffId + '@example.com';
  const prefs = await getUserNotificationPreferences(leave.staffId);
  const leavePref = prefs.find((p: any) => p.type === 'leave');
  if (!leavePref || leavePref.enabled) {
    await sendEmailNotification(
      staffEmail,
      `Your leave request was ${status}`,
      `Your leave from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} was ${status} by ${approvedBy}.`
    );
  }

  res.json({ message: `Leave ${status}`, leave });
}

export function getLeaves(req: Request, res: Response) {
  res.json({ leaves });
}
