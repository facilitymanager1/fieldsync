import express from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../modules/authentication';
import { handleUpload, getAttachment } from '../modules/attachment';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload attachment (all authenticated roles)
router.post('/upload', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), upload.single('file'), handleUpload);

// Get attachment by id (all authenticated roles)
router.get('/:id', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), getAttachment);

export default router;
