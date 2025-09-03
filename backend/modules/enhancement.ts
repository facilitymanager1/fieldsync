import { Request, Response } from 'express';

export function getEnhancements(req: Request, res: Response) {
  res.json({ enhancements: [] });
}

export function createEnhancement(req: Request, res: Response) {
  const { title, description, priority } = req.body;
  res.status(201).json({ 
    message: 'Enhancement created', 
    enhancement: { id: '1', title, description, priority, createdAt: new Date() }
  });
}

export function updateEnhancement(req: Request, res: Response) {
  const { id } = req.params;
  res.json({ message: 'Enhancement updated', id });
}

export function deleteEnhancement(req: Request, res: Response) {
  const { id } = req.params;
  res.json({ message: 'Enhancement deleted', id });
}
