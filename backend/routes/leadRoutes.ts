// Lead Generation & Referral Engine Routes
import express from 'express';
import Lead from '../models/lead';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

// POST /lead - Create a new lead (Supervisor, Admin)
router.post('/', requireAuth, requireRole(['Supervisor', 'Admin']), async (req, res) => {
  try {
    const { leadId, name, contact, source, referredBy } = req.body;
    const lead = new Lead({ leadId, name, contact, source, referredBy });
    await lead.save();
    res.status(201).json({ message: 'Lead created', id: lead._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// GET /lead/:leadId - Get a lead by ID (Supervisor, Admin, Client)
router.get('/:leadId', requireAuth, requireRole(['Supervisor', 'Admin', 'Client']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findOne({ leadId });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// PATCH /lead/:leadId - Update lead status (Supervisor, Admin)
router.patch('/:leadId', requireAuth, requireRole(['Supervisor', 'Admin']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;
    const lead = await Lead.findOneAndUpdate({ leadId }, { status }, { new: true });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ message: 'Lead status updated', lead });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

export default router;
