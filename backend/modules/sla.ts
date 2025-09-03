import { Request, Response } from 'express';

export function getSLAs(req: Request, res: Response) {
  res.json({ slas: [] });
}

export function createSLA(req: Request, res: Response) {
  const { name, description, targetTime } = req.body;
  res.status(201).json({ 
    message: 'SLA created', 
    sla: { id: '1', name, description, targetTime, createdAt: new Date() }
  });
}

export function updateSLA(req: Request, res: Response) {
  const { id } = req.params;
  res.json({ message: 'SLA updated', id });
}

export function deleteSLA(req: Request, res: Response) {
  const { id } = req.params;
  res.json({ message: 'SLA deleted', id });
}
