// In-memory staff management logic for demo
import { Request, Response } from 'express';

let staffList = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@company.com',
    phone: '1234567890',
    role: 'Field Agent',
    status: 'active',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@company.com',
    phone: '2345678901',
    role: 'Supervisor',
    status: 'active',
  },
  {
    id: '3',
    name: 'Carol Lee',
    email: 'carol@company.com',
    phone: '3456789012',
    role: 'Field Agent',
    status: 'inactive',
  },
];

export function getStaff(req: Request, res: Response) {
  res.json({ staff: staffList });
}
