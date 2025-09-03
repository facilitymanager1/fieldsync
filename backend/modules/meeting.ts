import { Request, Response } from 'express';

export function getMeetings(req: Request, res: Response) {
  res.json({ meetings: [] });
}

export function createMeeting(req: Request, res: Response) {
  const { title, date, participants } = req.body;
  res.status(201).json({ 
    message: 'Meeting created', 
    meeting: { id: '1', title, date, participants, createdAt: new Date() }
  });
}

export function updateMeeting(req: Request, res: Response) {
  const { id } = req.params;
  res.json({ message: 'Meeting updated', id });
}

export function deleteMeeting(req: Request, res: Response) {
  const { id } = req.params;
  res.json({ message: 'Meeting deleted', id });
}
