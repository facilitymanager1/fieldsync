/**
 * Advanced Storage Routes
 * RESTful API endpoints for file storage, encryption, and management
 */

import express from 'express';
import {
  uploadFile,
  downloadFile,
  deleteStorageFile,
  createFileVersion,
  restoreFileVersion,
  createFileShareLink,
  getStorageAnalytics
} from '../modules/storage';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// File Management Routes
router.post('/files', uploadFile);
router.get('/files/:fileId/download', downloadFile);
router.delete('/files/:fileId', deleteStorageFile);

// Version Management Routes
router.post('/files/:fileId/versions', createFileVersion);
router.post('/files/:fileId/versions/:versionId/restore', restoreFileVersion);

// Sharing Routes
router.post('/files/:fileId/share', createFileShareLink);

// Analytics Routes
router.get('/analytics', getStorageAnalytics);

export default router;
