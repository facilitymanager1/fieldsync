/**
 * Advanced Storage & Security Module
 * Handles encrypted storage, file management, versioning, and data lifecycle
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

// Advanced Storage Interfaces
export interface StorageItem {
  id: string;
  name: string;
  type: 'file' | 'document' | 'image' | 'video' | 'audio' | 'data';
  mimeType: string;
  size: number;
  path: string;
  encryptionKey?: string;
  encryptionAlgorithm: string;
  compressed: boolean;
  checksum: string;
  metadata: {
    originalName: string;
    uploadedBy: string;
    uploadedAt: Date;
    lastAccessed: Date;
    accessCount: number;
    tags: string[];
    description?: string;
    source: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
  };
  versions: StorageVersion[];
  retention: {
    policy: 'permanent' | 'temporary' | 'archive' | 'custom';
    expiresAt?: Date;
    autoDelete: boolean;
    archiveAfter?: Date;
  };
  access: {
    level: 'public' | 'private' | 'restricted' | 'confidential';
    permissions: StoragePermission[];
    shareLinks: ShareLink[];
  };
  status: 'active' | 'archived' | 'deleted' | 'corrupted';
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageVersion {
  versionId: string;
  versionNumber: number;
  path: string;
  size: number;
  checksum: string;
  changes: string;
  createdBy: string;
  createdAt: Date;
  restorable: boolean;
}

export interface StoragePermission {
  userId: string;
  role: string;
  permissions: ('read' | 'write' | 'delete' | 'share')[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface ShareLink {
  id: string;
  token: string;
  permissions: ('read' | 'download')[];
  expiresAt?: Date;
  maxAccess?: number;
  currentAccess: number;
  password?: string;
  createdBy: string;
  createdAt: Date;
}

export interface StorageVault {
  id: string;
  name: string;
  description: string;
  type: 'personal' | 'team' | 'project' | 'archive';
  ownerId: string;
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyId: string;
  };
  capacity: {
    limit: number; // bytes
    used: number; // bytes
    warning: number; // percentage
  };
  settings: {
    autoArchive: boolean;
    compression: boolean;
    deduplication: boolean;
    versioning: boolean;
    maxVersions: number;
  };
  permissions: StoragePermission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataRetentionPolicy {
  id: string;
  name: string;
  description: string;
  rules: RetentionRule[];
  scope: 'global' | 'vault' | 'type' | 'user';
  scopeId?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetentionRule {
  condition: {
    field: string;
    operator: 'equals' | 'contains' | 'older_than' | 'larger_than' | 'type_is';
    value: any;
  };
  action: {
    type: 'delete' | 'archive' | 'compress' | 'encrypt' | 'notify';
    delay: number; // days
    parameters?: any;
  };
  priority: number;
}

export interface EncryptionKey {
  id: string;
  algorithm: string;
  key: Buffer;
  iv: Buffer;
  salt: Buffer;
  createdAt: Date;
  lastUsed: Date;
  rotationSchedule?: Date;
  status: 'active' | 'rotated' | 'revoked';
}

// Database Schemas
const StorageItemSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  type: { type: String, enum: ['file', 'document', 'image', 'video', 'audio', 'data'], required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  encryptionKey: String,
  encryptionAlgorithm: { type: String, default: 'aes-256-gcm' },
  compressed: { type: Boolean, default: false },
  checksum: { type: String, required: true },
  metadata: {
    originalName: String,
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now },
    accessCount: { type: Number, default: 0 },
    tags: [String],
    description: String,
    source: String,
    relatedEntityId: String,
    relatedEntityType: String,
  },
  versions: [{
    versionId: String,
    versionNumber: Number,
    path: String,
    size: Number,
    checksum: String,
    changes: String,
    createdBy: String,
    createdAt: Date,
    restorable: Boolean,
  }],
  retention: {
    policy: { type: String, enum: ['permanent', 'temporary', 'archive', 'custom'], default: 'permanent' },
    expiresAt: Date,
    autoDelete: { type: Boolean, default: false },
    archiveAfter: Date,
  },
  access: {
    level: { type: String, enum: ['public', 'private', 'restricted', 'confidential'], default: 'private' },
    permissions: [{
      userId: String,
      role: String,
      permissions: [String],
      grantedBy: String,
      grantedAt: Date,
      expiresAt: Date,
    }],
    shareLinks: [{
      id: String,
      token: String,
      permissions: [String],
      expiresAt: Date,
      maxAccess: Number,
      currentAccess: Number,
      password: String,
      createdBy: String,
      createdAt: Date,
    }],
  },
  status: { type: String, enum: ['active', 'archived', 'deleted', 'corrupted'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const StorageVaultSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['personal', 'team', 'project', 'archive'], required: true },
  ownerId: { type: String, required: true },
  encryption: {
    enabled: { type: Boolean, default: true },
    algorithm: { type: String, default: 'aes-256-gcm' },
    keyId: String,
  },
  capacity: {
    limit: { type: Number, default: 10737418240 }, // 10GB default
    used: { type: Number, default: 0 },
    warning: { type: Number, default: 80 }, // 80%
  },
  settings: {
    autoArchive: { type: Boolean, default: true },
    compression: { type: Boolean, default: true },
    deduplication: { type: Boolean, default: true },
    versioning: { type: Boolean, default: true },
    maxVersions: { type: Number, default: 10 },
  },
  permissions: [{
    userId: String,
    role: String,
    permissions: [String],
    grantedBy: String,
    grantedAt: Date,
    expiresAt: Date,
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const DataRetentionPolicySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  rules: [{
    condition: {
      field: String,
      operator: String,
      value: mongoose.Schema.Types.Mixed,
    },
    action: {
      type: String,
      delay: Number,
      parameters: mongoose.Schema.Types.Mixed,
    },
    priority: Number,
  }],
  scope: { type: String, enum: ['global', 'vault', 'type', 'user'], default: 'global' },
  scopeId: String,
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const StorageItemModel = mongoose.model('StorageItem', StorageItemSchema);
const StorageVaultModel = mongoose.model('StorageVault', StorageVaultSchema);
const DataRetentionPolicyModel = mongoose.model('DataRetentionPolicy', DataRetentionPolicySchema);

class AdvancedStorageService {
  private readonly STORAGE_ROOT = process.env.STORAGE_ROOT || './storage';
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB

  private encryptionKeys: Map<string, EncryptionKey> = new Map();

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.STORAGE_ROOT, { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_ROOT, 'encrypted'), { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_ROOT, 'versions'), { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_ROOT, 'archive'), { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_ROOT, 'temp'), { recursive: true });
    } catch (error) {
      console.error('Storage initialization error:', error);
    }
  }

  // Encryption and Security
  private generateEncryptionKey(): EncryptionKey {
    const keyId = crypto.randomUUID();
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(32);

    const encryptionKey: EncryptionKey = {
      id: keyId,
      algorithm: this.ENCRYPTION_ALGORITHM,
      key,
      iv,
      salt,
      createdAt: new Date(),
      lastUsed: new Date(),
      status: 'active',
    };

    this.encryptionKeys.set(keyId, encryptionKey);
    return encryptionKey;
  }

  private async encryptData(data: Buffer, keyId?: string): Promise<{ encrypted: Buffer; keyId: string; authTag: Buffer }> {
    let encryptionKey: EncryptionKey;
    
    if (keyId && this.encryptionKeys.has(keyId)) {
      encryptionKey = this.encryptionKeys.get(keyId)!;
    } else {
      encryptionKey = this.generateEncryptionKey();
    }

    const cipher = crypto.createCipherGCM(this.ENCRYPTION_ALGORITHM, encryptionKey.key, encryptionKey.iv);
    
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    encryptionKey.lastUsed = new Date();
    
    return {
      encrypted,
      keyId: encryptionKey.id,
      authTag,
    };
  }

  private async decryptData(encryptedData: Buffer, keyId: string, authTag: Buffer): Promise<Buffer> {
    const encryptionKey = this.encryptionKeys.get(keyId);
    if (!encryptionKey) {
      throw new Error('Encryption key not found');
    }

    const decipher = crypto.createDecipherGCM(this.ENCRYPTION_ALGORITHM, encryptionKey.key, encryptionKey.iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    
    encryptionKey.lastUsed = new Date();
    return decrypted;
  }

  // Compression
  private async compressData(data: Buffer): Promise<Buffer> {
    const gzip = promisify(zlib.gzip);
    return gzip(data);
  }

  private async decompressData(compressedData: Buffer): Promise<Buffer> {
    const gunzip = promisify(zlib.gunzip);
    return gunzip(compressedData);
  }

  // Checksum calculation
  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // File Storage Operations
  async storeFile(fileData: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    uploadedBy: string;
    vaultId?: string;
    metadata?: any;
    encrypt?: boolean;
    compress?: boolean;
  }): Promise<ApiResponse> {
    try {
      // Validate file size
      if (fileData.buffer.length > this.MAX_FILE_SIZE) {
        return {
          success: false,
          message: 'File size exceeds maximum limit',
        };
      }

      let processedData = fileData.buffer;
      let compressed = false;
      let encryptionResult: any = null;

      // Apply compression if requested and beneficial
      if (fileData.compress && fileData.buffer.length > this.COMPRESSION_THRESHOLD) {
        processedData = await this.compressData(processedData);
        compressed = true;
      }

      // Apply encryption if requested
      if (fileData.encrypt !== false) { // Default to true
        encryptionResult = await this.encryptData(processedData);
        processedData = Buffer.concat([encryptionResult.encrypted, encryptionResult.authTag]);
      }

      // Generate unique filename and path
      const fileId = crypto.randomUUID();
      const extension = path.extname(fileData.originalName);
      const fileName = `${fileId}${extension}`;
      const filePath = path.join(
        this.STORAGE_ROOT,
        fileData.encrypt !== false ? 'encrypted' : 'files',
        fileName
      );

      // Save file to disk
      await fs.writeFile(filePath, processedData);

      // Calculate checksum of original data
      const checksum = this.calculateChecksum(fileData.buffer);

      // Determine file type
      const fileType = this.determineFileType(fileData.mimeType);

      // Create storage item record
      const storageItem = new StorageItemModel({
        id: fileId,
        name: fileData.originalName,
        type: fileType,
        mimeType: fileData.mimeType,
        size: fileData.buffer.length,
        path: filePath,
        encryptionKey: encryptionResult?.keyId,
        compressed,
        checksum,
        metadata: {
          originalName: fileData.originalName,
          uploadedBy: fileData.uploadedBy,
          ...fileData.metadata,
        },
        versions: [],
        access: {
          level: 'private',
          permissions: [{
            userId: fileData.uploadedBy,
            role: 'owner',
            permissions: ['read', 'write', 'delete', 'share'],
            grantedBy: fileData.uploadedBy,
            grantedAt: new Date(),
          }],
          shareLinks: [],
        },
      });

      await storageItem.save();

      // Update vault capacity if specified
      if (fileData.vaultId) {
        await this.updateVaultCapacity(fileData.vaultId, fileData.buffer.length);
      }

      return {
        success: true,
        data: {
          fileId,
          name: fileData.originalName,
          size: fileData.buffer.length,
          checksum,
          compressed,
          encrypted: fileData.encrypt !== false,
        },
        message: 'File stored successfully',
      };

    } catch (error: any) {
      console.error('Store file error:', error);
      return {
        success: false,
        message: 'Failed to store file',
        error: error?.message || 'Unknown error',
      };
    }
  }

  async retrieveFile(fileId: string, userId: string): Promise<ApiResponse> {
    try {
      const storageItem = await StorageItemModel.findOne({ 
        id: fileId,
        status: 'active' 
      });

      if (!storageItem) {
        return {
          success: false,
          message: 'File not found',
        };
      }

      // Check permissions
      const hasPermission = this.checkPermission(storageItem, userId, 'read');
      if (!hasPermission) {
        return {
          success: false,
          message: 'Access denied',
        };
      }

      // Read file from disk
      let fileData = await fs.readFile(storageItem.path);

      // Decrypt if encrypted
      if (storageItem.encryptionKey) {
        // Extract auth tag (last 16 bytes)
        const authTag = fileData.slice(-16);
        const encryptedData = fileData.slice(0, -16);
        
        fileData = await this.decryptData(encryptedData, storageItem.encryptionKey, authTag);
      }

      // Decompress if compressed
      if (storageItem.compressed) {
        fileData = await this.decompressData(fileData);
      }

      // Verify checksum
      const checksum = this.calculateChecksum(fileData);
      if (checksum !== storageItem.checksum) {
        return {
          success: false,
          message: 'File integrity check failed',
        };
      }

      // Update access tracking
      await StorageItemModel.findByIdAndUpdate(storageItem._id, {
        $set: { 'metadata.lastAccessed': new Date() },
        $inc: { 'metadata.accessCount': 1 },
      });

      return {
        success: true,
        data: {
          buffer: fileData,
          mimeType: storageItem.mimeType,
          size: storageItem.size,
          name: storageItem.metadata.originalName,
        },
        message: 'File retrieved successfully',
      };

    } catch (error: any) {
      console.error('Retrieve file error:', error);
      return {
        success: false,
        message: 'Failed to retrieve file',
        error: error?.message || 'Unknown error',
      };
    }
  }

  async deleteFile(fileId: string, userId: string, permanent: boolean = false): Promise<ApiResponse> {
    try {
      const storageItem = await StorageItemModel.findOne({ 
        id: fileId,
        status: { $ne: 'deleted' }
      });

      if (!storageItem) {
        return {
          success: false,
          message: 'File not found',
        };
      }

      // Check permissions
      const hasPermission = this.checkPermission(storageItem, userId, 'delete');
      if (!hasPermission) {
        return {
          success: false,
          message: 'Access denied',
        };
      }

      if (permanent) {
        // Permanently delete file
        try {
          await fs.unlink(storageItem.path);
        } catch (error) {
          console.error('Failed to delete file from disk:', error);
        }

        // Delete all versions
        for (const version of storageItem.versions) {
          try {
            await fs.unlink(version.path);
          } catch (error) {
            console.error('Failed to delete version file:', error);
          }
        }

        await StorageItemModel.findByIdAndDelete(storageItem._id);

        return {
          success: true,
          message: 'File permanently deleted',
        };

      } else {
        // Soft delete
        storageItem.status = 'deleted';
        storageItem.updatedAt = new Date();
        await storageItem.save();

        return {
          success: true,
          message: 'File moved to trash',
        };
      }

    } catch (error: any) {
      console.error('Delete file error:', error);
      return {
        success: false,
        message: 'Failed to delete file',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Version Management
  async createFileVersion(fileId: string, newData: Buffer, userId: string, changes: string): Promise<ApiResponse> {
    try {
      const storageItem = await StorageItemModel.findOne({ 
        id: fileId,
        status: 'active' 
      });

      if (!storageItem) {
        return {
          success: false,
          message: 'File not found',
        };
      }

      // Check permissions
      const hasPermission = this.checkPermission(storageItem, userId, 'write');
      if (!hasPermission) {
        return {
          success: false,
          message: 'Access denied',
        };
      }

      // Create version of current file
      const versionId = crypto.randomUUID();
      const versionNumber = storageItem.versions.length + 1;
      const versionPath = path.join(this.STORAGE_ROOT, 'versions', `${fileId}_v${versionNumber}`);

      // Copy current file to version path
      await fs.copyFile(storageItem.path, versionPath);

      // Add version record
      storageItem.versions.push({
        versionId,
        versionNumber,
        path: versionPath,
        size: storageItem.size,
        checksum: storageItem.checksum,
        changes,
        createdBy: userId,
        createdAt: new Date(),
        restorable: true,
      });

      // Process and save new file data
      let processedData = newData;
      let compressed = false;
      let encryptionResult: any = null;

      if (storageItem.compressed && newData.length > this.COMPRESSION_THRESHOLD) {
        processedData = await this.compressData(processedData);
        compressed = true;
      }

      if (storageItem.encryptionKey) {
        encryptionResult = await this.encryptData(processedData, storageItem.encryptionKey);
        processedData = Buffer.concat([encryptionResult.encrypted, encryptionResult.authTag]);
      }

      await fs.writeFile(storageItem.path, processedData);

      // Update storage item
      storageItem.size = newData.length;
      storageItem.checksum = this.calculateChecksum(newData);
      storageItem.updatedAt = new Date();

      // Cleanup old versions if limit exceeded
      const vault = await StorageVaultModel.findById(storageItem.metadata.vaultId);
      const maxVersions = vault?.settings.maxVersions || 10;

      if (storageItem.versions.length > maxVersions) {
        const versionsToRemove = storageItem.versions.splice(0, storageItem.versions.length - maxVersions);
        
        for (const version of versionsToRemove) {
          try {
            await fs.unlink(version.path);
          } catch (error) {
            console.error('Failed to delete old version:', error);
          }
        }
      }

      await storageItem.save();

      return {
        success: true,
        data: {
          versionId,
          versionNumber,
          totalVersions: storageItem.versions.length,
        },
        message: 'File version created successfully',
      };

    } catch (error: any) {
      console.error('Create file version error:', error);
      return {
        success: false,
        message: 'Failed to create file version',
        error: error?.message || 'Unknown error',
      };
    }
  }

  async restoreFileVersion(fileId: string, versionId: string, userId: string): Promise<ApiResponse> {
    try {
      const storageItem = await StorageItemModel.findOne({ 
        id: fileId,
        status: 'active' 
      });

      if (!storageItem) {
        return {
          success: false,
          message: 'File not found',
        };
      }

      // Check permissions
      const hasPermission = this.checkPermission(storageItem, userId, 'write');
      if (!hasPermission) {
        return {
          success: false,
          message: 'Access denied',
        };
      }

      // Find version
      const version = storageItem.versions.find(v => v.versionId === versionId);
      if (!version || !version.restorable) {
        return {
          success: false,
          message: 'Version not found or not restorable',
        };
      }

      // Create backup of current version
      await this.createFileVersion(fileId, await fs.readFile(storageItem.path), userId, 'Backup before restore');

      // Restore version
      await fs.copyFile(version.path, storageItem.path);
      
      storageItem.size = version.size;
      storageItem.checksum = version.checksum;
      storageItem.updatedAt = new Date();
      await storageItem.save();

      return {
        success: true,
        data: {
          restoredVersion: version.versionNumber,
        },
        message: 'File version restored successfully',
      };

    } catch (error: any) {
      console.error('Restore file version error:', error);
      return {
        success: false,
        message: 'Failed to restore file version',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Share Links
  async createShareLink(fileId: string, userId: string, options: {
    permissions: ('read' | 'download')[];
    expiresAt?: Date;
    maxAccess?: number;
    password?: string;
  }): Promise<ApiResponse> {
    try {
      const storageItem = await StorageItemModel.findOne({ 
        id: fileId,
        status: 'active' 
      });

      if (!storageItem) {
        return {
          success: false,
          message: 'File not found',
        };
      }

      // Check permissions
      const hasPermission = this.checkPermission(storageItem, userId, 'share');
      if (!hasPermission) {
        return {
          success: false,
          message: 'Access denied',
        };
      }

      const shareLink: ShareLink = {
        id: crypto.randomUUID(),
        token: crypto.randomBytes(32).toString('hex'),
        permissions: options.permissions,
        expiresAt: options.expiresAt,
        maxAccess: options.maxAccess,
        currentAccess: 0,
        password: options.password ? crypto.createHash('sha256').update(options.password).digest('hex') : undefined,
        createdBy: userId,
        createdAt: new Date(),
      };

      storageItem.access.shareLinks.push(shareLink);
      await storageItem.save();

      return {
        success: true,
        data: {
          shareId: shareLink.id,
          token: shareLink.token,
          url: `/api/storage/share/${shareLink.token}`,
        },
        message: 'Share link created successfully',
      };

    } catch (error: any) {
      console.error('Create share link error:', error);
      return {
        success: false,
        message: 'Failed to create share link',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Storage Analytics
  async getStorageAnalytics(userId: string, vaultId?: string): Promise<ApiResponse> {
    try {
      const query: any = {
        'metadata.uploadedBy': userId,
        status: 'active',
      };

      if (vaultId) {
        query['metadata.vaultId'] = vaultId;
      }

      const items = await StorageItemModel.find(query);

      const analytics = {
        totalFiles: items.length,
        totalSize: items.reduce((sum, item) => sum + item.size, 0),
        typeDistribution: {} as { [key: string]: number },
        sizeDistribution: {
          small: 0, // < 1MB
          medium: 0, // 1MB - 10MB
          large: 0, // 10MB - 100MB
          xlarge: 0, // > 100MB
        },
        accessPatterns: {
          mostAccessed: [] as any[],
          recentlyAccessed: [] as any[],
          neverAccessed: 0,
        },
        security: {
          encrypted: 0,
          compressed: 0,
          shared: 0,
        },
      };

      for (const item of items) {
        // Type distribution
        analytics.typeDistribution[item.type] = (analytics.typeDistribution[item.type] || 0) + 1;

        // Size distribution
        const sizeMB = item.size / (1024 * 1024);
        if (sizeMB < 1) analytics.sizeDistribution.small++;
        else if (sizeMB < 10) analytics.sizeDistribution.medium++;
        else if (sizeMB < 100) analytics.sizeDistribution.large++;
        else analytics.sizeDistribution.xlarge++;

        // Access patterns
        if (item.metadata.accessCount === 0) {
          analytics.accessPatterns.neverAccessed++;
        }

        // Security
        if (item.encryptionKey) analytics.security.encrypted++;
        if (item.compressed) analytics.security.compressed++;
        if (item.access.shareLinks.length > 0) analytics.security.shared++;
      }

      // Most accessed files
      analytics.accessPatterns.mostAccessed = items
        .sort((a, b) => b.metadata.accessCount - a.metadata.accessCount)
        .slice(0, 10)
        .map(item => ({
          id: item.id,
          name: item.name,
          accessCount: item.metadata.accessCount,
        }));

      // Recently accessed files
      analytics.accessPatterns.recentlyAccessed = items
        .sort((a, b) => b.metadata.lastAccessed.getTime() - a.metadata.lastAccessed.getTime())
        .slice(0, 10)
        .map(item => ({
          id: item.id,
          name: item.name,
          lastAccessed: item.metadata.lastAccessed,
        }));

      return {
        success: true,
        data: analytics,
        message: 'Storage analytics retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get storage analytics error:', error);
      return {
        success: false,
        message: 'Failed to retrieve storage analytics',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Utility Methods
  private determineFileType(mimeType: string): StorageItem['type'] {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
    return 'file';
  }

  private checkPermission(storageItem: any, userId: string, permission: string): boolean {
    // Check if user is owner
    if (storageItem.metadata.uploadedBy === userId) return true;

    // Check specific permissions
    const userPermission = storageItem.access.permissions.find(
      (p: any) => p.userId === userId && (!p.expiresAt || p.expiresAt > new Date())
    );

    return userPermission ? userPermission.permissions.includes(permission) : false;
  }

  private async updateVaultCapacity(vaultId: string, sizeChange: number): Promise<void> {
    try {
      await StorageVaultModel.findByIdAndUpdate(vaultId, {
        $inc: { 'capacity.used': sizeChange }
      });
    } catch (error) {
      console.error('Update vault capacity error:', error);
    }
  }
}

interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

// Export service instance
const storageService = new AdvancedStorageService();

// Route handlers
export async function uploadFile(req: Request, res: Response) {
  try {
    // File would be extracted from multipart/form-data in real implementation
    const fileData = {
      buffer: Buffer.from(req.body.data, 'base64'),
      originalName: req.body.originalName,
      mimeType: req.body.mimeType,
      uploadedBy: (req as any).user.id,
      vaultId: req.body.vaultId,
      metadata: req.body.metadata,
      encrypt: req.body.encrypt,
      compress: req.body.compress,
    };

    const result = await storageService.storeFile(fileData);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function downloadFile(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;

    const result = await storageService.retrieveFile(fileId, userId);
    
    if (result.success) {
      res.setHeader('Content-Type', result.data.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.data.name}"`);
      res.send(result.data.buffer);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function deleteStorageFile(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const { permanent } = req.query;
    const userId = (req as any).user.id;

    const result = await storageService.deleteFile(fileId, userId, permanent === 'true');
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function createFileVersion(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const { data, changes } = req.body;
    const userId = (req as any).user.id;

    const newData = Buffer.from(data, 'base64');
    
    const result = await storageService.createFileVersion(fileId, newData, userId, changes);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function restoreFileVersion(req: Request, res: Response) {
  try {
    const { fileId, versionId } = req.params;
    const userId = (req as any).user.id;

    const result = await storageService.restoreFileVersion(fileId, versionId, userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function createFileShareLink(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const userId = (req as any).user.id;

    const result = await storageService.createShareLink(fileId, userId, req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getStorageAnalytics(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { vaultId } = req.query;

    const result = await storageService.getStorageAnalytics(userId, vaultId as string);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}
