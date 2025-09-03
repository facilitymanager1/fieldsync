/**
 * Advanced Storage Management Dashboard Component
 * Enterprise-grade file storage with encryption, versioning, and analytics
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  Alert,
  Switch,
  FormControlLabel,
  Paper,
  Tooltip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  History as HistoryIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Compress as CompressIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  FileCopy as CopyIcon,
  Link as LinkIcon,
  Backup as BackupIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

interface StorageFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isEncrypted: boolean;
  compressionRatio: number;
  checksum: string;
  owner: string;
  permissions: string;
  tags: string[];
  isPublic: boolean;
  downloadCount: number;
  status: 'active' | 'archived' | 'deleted' | 'processing';
}

interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  size: number;
  createdAt: Date;
  createdBy: string;
  changes: string;
  checksum: string;
}

interface ShareLink {
  id: string;
  fileId: string;
  token: string;
  expiresAt: Date;
  maxDownloads: number;
  currentDownloads: number;
  password?: string;
  permissions: string[];
  createdBy: string;
}

interface StorageQuota {
  total: number;
  used: number;
  available: number;
  files: number;
  versions: number;
}

interface LifecycleRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    age?: number;
    size?: number;
    type?: string;
    tags?: string[];
  };
  actions: {
    archive?: boolean;
    delete?: boolean;
    compress?: boolean;
    moveToTier?: string;
  };
}

export default function AdvancedStoragePage() {
  const [currentView, setCurrentView] = useState('files');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [lifecycleRules, setLifecycleRules] = useState<LifecycleRule[]>([]);
  const [quota, setQuota] = useState<StorageQuota>({
    total: 100 * 1024 * 1024 * 1024, // 100GB
    used: 65 * 1024 * 1024 * 1024,   // 65GB
    available: 35 * 1024 * 1024 * 1024, // 35GB
    files: 1250,
    versions: 3200,
  });
  
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [lifecycleDialogOpen, setLifecycleDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
  // Form states
  const [uploadForm, setUploadForm] = useState({
    encrypt: true,
    compress: true,
    tags: '',
    permissions: 'private',
  });
  
  const [shareForm, setShareForm] = useState({
    expiresIn: 7,
    maxDownloads: 10,
    password: '',
    allowPreview: true,
    allowDownload: true,
  });
  
  const [lifecycleForm, setLifecycleForm] = useState({
    name: '',
    enabled: true,
    conditions: {
      age: 30,
      size: 0,
      type: '',
      tags: '',
    },
    actions: {
      archive: false,
      delete: false,
      compress: false,
      moveToTier: '',
    },
  });
  
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null);
  const [analytics, setAnalytics] = useState<any>({});

  useEffect(() => {
    loadStorageData();
  }, [currentPath]);

  const loadStorageData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFiles(),
        loadShareLinks(),
        loadLifecycleRules(),
        loadAnalytics(),
      ]);
    } catch (error) {
      console.error('Failed to load storage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    // Simulate API call
    const mockFiles: StorageFile[] = [
      {
        id: '1',
        name: 'Project Report.pdf',
        size: 2048576,
        type: 'application/pdf',
        path: '/documents/',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 43200000),
        version: 3,
        isEncrypted: true,
        compressionRatio: 0.75,
        checksum: 'sha256:abc123...',
        owner: 'user123',
        permissions: 'rw-r--r--',
        tags: ['report', 'project', 'confidential'],
        isPublic: false,
        downloadCount: 15,
        status: 'active',
      },
      {
        id: '2',
        name: 'team-photo.jpg',
        size: 5242880,
        type: 'image/jpeg',
        path: '/images/',
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(Date.now() - 172800000),
        version: 1,
        isEncrypted: false,
        compressionRatio: 0.95,
        checksum: 'sha256:def456...',
        owner: 'user456',
        permissions: 'rw-rw-r--',
        tags: ['photo', 'team'],
        isPublic: true,
        downloadCount: 45,
        status: 'active',
      },
    ];
    setFiles(mockFiles);
  };

  const loadShareLinks = async () => {
    const mockLinks: ShareLink[] = [
      {
        id: '1',
        fileId: '1',
        token: 'abc123xyz',
        expiresAt: new Date(Date.now() + 7 * 86400000),
        maxDownloads: 10,
        currentDownloads: 3,
        permissions: ['download', 'preview'],
        createdBy: 'user123',
      },
    ];
    setShareLinks(mockLinks);
  };

  const loadLifecycleRules = async () => {
    const mockRules: LifecycleRule[] = [
      {
        id: '1',
        name: 'Archive old files',
        enabled: true,
        conditions: {
          age: 90,
          type: 'document',
        },
        actions: {
          archive: true,
          compress: true,
        },
      },
    ];
    setLifecycleRules(mockRules);
  };

  const loadAnalytics = async () => {
    const mockAnalytics = {
      storageGrowth: [
        { date: '2025-01-01', size: 60 },
        { date: '2025-01-02', size: 62 },
        { date: '2025-01-03', size: 65 },
      ],
      fileTypes: {
        documents: 40,
        images: 30,
        videos: 20,
        other: 10,
      },
      downloadStats: {
        today: 25,
        week: 180,
        month: 750,
      },
    };
    setAnalytics(mockAnalytics);
  };

  const handleFileUpload = async (files: FileList) => {
    try {
      setLoading(true);
      
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('encrypt', uploadForm.encrypt.toString());
      formData.append('compress', uploadForm.compress.toString());
      formData.append('tags', uploadForm.tags);
      formData.append('permissions', uploadForm.permissions);
      formData.append('path', currentPath);
      
      // API call to upload files
      console.log('Uploading files:', formData);
      
      await loadFiles();
      setUploadDialogOpen(false);
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    try {
      setLoading(true);
      
      const shareData = {
        fileId: selectedFile?.id,
        expiresIn: shareForm.expiresIn,
        maxDownloads: shareForm.maxDownloads,
        password: shareForm.password || undefined,
        permissions: [
          shareForm.allowPreview && 'preview',
          shareForm.allowDownload && 'download',
        ].filter(Boolean),
      };
      
      // API call to create share link
      console.log('Creating share link:', shareData);
      
      await loadShareLinks();
      setShareDialogOpen(false);
    } catch (error) {
      console.error('Failed to create share link:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFiles = async (fileIds: string[]) => {
    try {
      setLoading(true);
      
      // API call to delete files
      console.log('Deleting files:', fileIds);
      
      await loadFiles();
      setSelectedFiles([]);
    } catch (error) {
      console.error('Failed to delete files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (fileId: string) => {
    try {
      setLoading(true);
      
      // API call to download file
      console.log('Downloading file:', fileId);
      
    } catch (error) {
      console.error('Failed to download file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewVersions = async (fileId: string) => {
    try {
      setLoading(true);
      
      // Load file versions
      const mockVersions: FileVersion[] = [
        {
          id: '1',
          fileId,
          version: 3,
          size: 2048576,
          createdAt: new Date(Date.now() - 43200000),
          createdBy: 'user123',
          changes: 'Updated conclusion section',
          checksum: 'sha256:abc123...',
        },
        {
          id: '2',
          fileId,
          version: 2,
          size: 2000000,
          createdAt: new Date(Date.now() - 86400000),
          createdBy: 'user456',
          changes: 'Added new charts and graphs',
          checksum: 'sha256:def456...',
        },
      ];
      
      setVersions(mockVersions);
      setVersionsDialogOpen(true);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('document') || type.includes('word')) return '📝';
    if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📈';
    if (type.includes('zip') || type.includes('archive')) return '📦';
    return '📄';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'archived': return 'warning';
      case 'deleted': return 'error';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon /> Advanced Storage
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Files
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => setLifecycleDialogOpen(true)}
            >
              Lifecycle Rules
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsDialogOpen(true)}
            >
              Settings
            </Button>
          </Box>
        </Box>

        {/* Storage Quota */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Storage Usage</Typography>
              <Typography variant="body2" color="textSecondary">
                {formatFileSize(quota.used)} / {formatFileSize(quota.total)}
              </Typography>
            </Box>
            
            <LinearProgress
              variant="determinate"
              value={(quota.used / quota.total) * 100}
              sx={{ height: 8, borderRadius: 4, mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                📁 {quota.files.toLocaleString()} files
              </Typography>
              <Typography variant="body2">
                📝 {quota.versions.toLocaleString()} versions
              </Typography>
              <Typography variant="body2">
                💾 {formatFileSize(quota.available)} available
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Navigation */}
        <Box sx={{ mb: 3 }}>
          <Breadcrumbs>
            <Link underline="hover" color="inherit" onClick={() => setCurrentPath('/')}>
              Root
            </Link>
            {currentPath.split('/').filter(Boolean).map((segment, index, array) => (
              <Link
                key={index}
                underline="hover"
                color={index === array.length - 1 ? "text.primary" : "inherit"}
                onClick={() => setCurrentPath('/' + array.slice(0, index + 1).join('/') + '/')}
              >
                {segment}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>

        {/* Tabs */}
        <Tabs value={currentView} onChange={(e, v) => setCurrentView(v)} sx={{ mb: 3 }}>
          <Tab value="files" label="Files" icon={<FileIcon />} />
          <Tab value="shares" label="Shared Links" icon={<ShareIcon />} />
          <Tab value="lifecycle" label="Lifecycle" icon={<ScheduleIcon />} />
          <Tab value="analytics" label="Analytics" icon={<AnalyticsIcon />} />
        </Tabs>

        {/* Files View */}
        {currentView === 'files' && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {/* File Actions */}
              {selectedFiles.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2">
                        {selectedFiles.length} file(s) selected
                      </Typography>
                      
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => selectedFiles.forEach(handleDownloadFile)}
                      >
                        Download
                      </Button>
                      
                      <Button
                        size="small"
                        startIcon={<ShareIcon />}
                        onClick={() => setShareDialogOpen(true)}
                      >
                        Share
                      </Button>
                      
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        color="error"
                        onClick={() => handleDeleteFiles(selectedFiles)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )}
              
              {/* Files Table */}
              <Card>
                <CardContent>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            {/* Select All Checkbox */}
                          </TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Size</TableCell>
                          <TableCell>Modified</TableCell>
                          <TableCell>Version</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {files.map((file) => (
                          <TableRow key={file.id}>
                            <TableCell padding="checkbox">
                              {/* File checkbox */}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h6">
                                  {getFileIcon(file.type)}
                                </Typography>
                                <Box>
                                  <Typography variant="body2">{file.name}</Typography>
                                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                    {file.isEncrypted && (
                                      <Chip label="Encrypted" size="small" color="primary" />
                                    )}
                                    {file.compressionRatio < 1 && (
                                      <Chip
                                        label={`${Math.round((1 - file.compressionRatio) * 100)}% compressed`}
                                        size="small"
                                        color="secondary"
                                      />
                                    )}
                                    {file.tags.map(tag => (
                                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                                    ))}
                                  </Box>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>{formatFileSize(file.size)}</TableCell>
                            <TableCell>{file.updatedAt.toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                onClick={() => handleViewVersions(file.id)}
                              >
                                v{file.version}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={file.status}
                                size="small"
                                color={getStatusColor(file.status)}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="Download">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownloadFile(file.id)}
                                  >
                                    <DownloadIcon />
                                  </IconButton>
                                </Tooltip>
                                
                                <Tooltip title="Share">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSelectedFile(file);
                                      setShareDialogOpen(true);
                                    }}
                                  >
                                    <ShareIcon />
                                  </IconButton>
                                </Tooltip>
                                
                                <Tooltip title="Versions">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleViewVersions(file.id)}
                                  >
                                    <HistoryIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Shared Links View */}
        {currentView === 'shares' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Share Links
              </Typography>
              
              <List>
                {shareLinks.map((link) => {
                  const file = files.find(f => f.id === link.fileId);
                  return (
                    <ListItem key={link.id} divider>
                      <ListItemText
                        primary={file?.name || 'Unknown file'}
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              Token: {link.token}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Expires: {link.expiresAt.toLocaleDateString()} • 
                              Downloads: {link.currentDownloads}/{link.maxDownloads}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" startIcon={<CopyIcon />}>
                          Copy Link
                        </Button>
                        <Button size="small" color="error" startIcon={<DeleteIcon />}>
                          Revoke
                        </Button>
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Lifecycle Rules View */}
        {currentView === 'lifecycle' && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Lifecycle Rules</Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setLifecycleDialogOpen(true)}
                >
                  Add Rule
                </Button>
              </Box>
              
              {lifecycleRules.map((rule) => (
                <Accordion key={rule.id}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      <Typography variant="subtitle1">{rule.name}</Typography>
                      <Switch checked={rule.enabled} size="small" />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" gutterBottom>
                      <strong>Conditions:</strong>
                    </Typography>
                    <Box sx={{ ml: 2, mb: 2 }}>
                      {rule.conditions.age && (
                        <Typography variant="body2">
                          • Age: {rule.conditions.age} days
                        </Typography>
                      )}
                      {rule.conditions.type && (
                        <Typography variant="body2">
                          • Type: {rule.conditions.type}
                        </Typography>
                      )}
                    </Box>
                    
                    <Typography variant="body2" gutterBottom>
                      <strong>Actions:</strong>
                    </Typography>
                    <Box sx={{ ml: 2 }}>
                      {rule.actions.archive && (
                        <Typography variant="body2">• Archive files</Typography>
                      )}
                      {rule.actions.compress && (
                        <Typography variant="body2">• Compress files</Typography>
                      )}
                      {rule.actions.delete && (
                        <Typography variant="body2">• Delete files</Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Analytics View */}
        {currentView === 'analytics' && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    File Type Distribution
                  </Typography>
                  
                  {analytics.fileTypes && (
                    <Box sx={{ mt: 2 }}>
                      {Object.entries(analytics.fileTypes).map(([type, percentage]) => (
                        <Box key={type} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'between', mb: 1 }}>
                            <Typography variant="body2">
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Typography>
                            <Typography variant="body2">{percentage}%</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percentage as number}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Download Statistics
                  </Typography>
                  
                  {analytics.downloadStats && (
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Today
                        </Typography>
                        <Typography variant="h6">
                          {analytics.downloadStats.today}
                        </Typography>
                      </Box>
                      
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          This Week
                        </Typography>
                        <Typography variant="h6">
                          {analytics.downloadStats.week}
                        </Typography>
                      </Box>
                      
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          This Month
                        </Typography>
                        <Typography variant="h6">
                          {analytics.downloadStats.month}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input
                type="file"
                multiple
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                style={{ marginBottom: 16 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={uploadForm.encrypt}
                    onChange={(e) => setUploadForm({ ...uploadForm, encrypt: e.target.checked })}
                  />
                }
                label="Encrypt files"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={uploadForm.compress}
                    onChange={(e) => setUploadForm({ ...uploadForm, compress: e.target.checked })}
                  />
                }
                label="Compress files"
              />
              
              <TextField
                label="Tags (comma-separated)"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                fullWidth
              />
              
              <FormControl fullWidth>
                <InputLabel>Permissions</InputLabel>
                <Select
                  value={uploadForm.permissions}
                  onChange={(e) => setUploadForm({ ...uploadForm, permissions: e.target.value })}
                >
                  <MenuItem value="private">Private</MenuItem>
                  <MenuItem value="team">Team Access</MenuItem>
                  <MenuItem value="public">Public</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={loading}>
              Upload
            </Button>
          </DialogActions>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create Share Link</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Expires in (days)"
                type="number"
                value={shareForm.expiresIn}
                onChange={(e) => setShareForm({ ...shareForm, expiresIn: parseInt(e.target.value) })}
                fullWidth
              />
              
              <TextField
                label="Maximum downloads"
                type="number"
                value={shareForm.maxDownloads}
                onChange={(e) => setShareForm({ ...shareForm, maxDownloads: parseInt(e.target.value) })}
                fullWidth
              />
              
              <TextField
                label="Password (optional)"
                type="password"
                value={shareForm.password}
                onChange={(e) => setShareForm({ ...shareForm, password: e.target.value })}
                fullWidth
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={shareForm.allowPreview}
                    onChange={(e) => setShareForm({ ...shareForm, allowPreview: e.target.checked })}
                  />
                }
                label="Allow preview"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={shareForm.allowDownload}
                    onChange={(e) => setShareForm({ ...shareForm, allowDownload: e.target.checked })}
                  />
                }
                label="Allow download"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateShareLink} variant="contained" disabled={loading}>
              Create Link
            </Button>
          </DialogActions>
        </Dialog>

        {/* Versions Dialog */}
        <Dialog open={versionsDialogOpen} onClose={() => setVersionsDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>File Versions</DialogTitle>
          <DialogContent>
            <List>
              {versions.map((version) => (
                <ListItem key={version.id} divider>
                  <ListItemText
                    primary={`Version ${version.version}`}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {formatFileSize(version.size)} • {version.createdAt.toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          By: {version.createdBy} • {version.changes}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" startIcon={<DownloadIcon />}>
                      Download
                    </Button>
                    <Button size="small" startIcon={<HistoryIcon />}>
                      Restore
                    </Button>
                  </Box>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVersionsDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
