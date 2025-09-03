// Knowledge Base & Training Routes
import express from 'express';
import KnowledgeBase from '../models/knowledgeBase';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

// POST /knowledge-base - Create a new article/training/quiz (Supervisor, Admin)
router.post('/', requireAuth, requireRole(['Supervisor', 'Admin']), async (req, res) => {
  try {
    const { title, content, type, tags, attachmentIds } = req.body;
    // Import getAttachmentById lazily to avoid circular deps
    const { getAttachmentById } = require('../modules/attachment');
    let attachments = [];
    if (Array.isArray(attachmentIds)) {
      attachments = attachmentIds.map((id: string) => getAttachmentById(id)).filter(Boolean);
    }
    const kb = new KnowledgeBase({ title, content, type, tags, attachments });
    await kb.save();
    res.status(201).json({ message: 'Knowledge base entry created', id: kb._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// GET /knowledge-base/summary - Demo summary for dashboard table (all authenticated roles)
router.get('/summary', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), (req, res) => {
  res.json({
    articles: [
      {
        id: '1',
        title: 'How to Use the Field App',
        category: 'Training',
        status: 'published',
        url: 'https://example.com/article1',
      },
      {
        id: '2',
        title: 'Safety Guidelines',
        category: 'Article',
        status: 'published',
        url: 'https://example.com/article2',
      },
      {
        id: '3',
        title: 'Equipment Checklist',
        category: 'Checklist',
        status: 'draft',
        url: 'https://example.com/article3',
      },
    ],
  });
});

// GET /knowledge-base/:id - Get an entry by ID (all authenticated roles)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const kb = await KnowledgeBase.findById(id);
    if (!kb) return res.status(404).json({ error: 'Entry not found' });
    res.json({ kb });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// GET /knowledge-base - List all entries (all authenticated roles)
router.get('/', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), async (req, res) => {
  try {
    const entries = await KnowledgeBase.find();
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

export default router;
