/**
 * Onboarding Management Dashboard - Administrative interface for onboarding oversight
 * 
 * Features:
 * - Real-time onboarding status tracking
 * - Bulk onboarding operations
 * - Analytics and reporting
 * - Manual intervention capabilities
 * - Document review and approval
 * - Statutory verification management
 * - Compliance monitoring
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Badge,
  Alert,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Menu,
  MenuItem as DropdownMenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Notifications as NotificationsIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  DocumentScanner as DocumentScannerIcon,
  Timeline as TimelineIcon,
  PendingActions as PendingActionsIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';
import { format, parseISO, isValid } from 'date-fns';

// Chart components for analytics
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

interface OnboardingRecord {
  onboardingId: string;
  employeeName: string;
  designation: string;
  department: string;
  dateOfJoining: string;
  currentStep: string;
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: {
    percentage: number;
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
  };
  statutoryVerification: {
    epfoStatus: 'pending' | 'verified' | 'failed';
    esicStatus: 'pending' | 'verified' | 'failed';
  };
  biometricEnrollment: {
    faceEnrolled: boolean;
    fingerprintEnrolled: boolean;
  };
  documentsUploaded: number;
  totalDocuments: number;
  lastActivity: string;
  alerts: string[];
}

interface DashboardStats {
  totalOnboarding: number;
  activeOnboarding: number;
  completedToday: number;
  pendingActions: number;
  statutoryVerificationPending: number;
  documentsAwaitingReview: number;
  biometricEnrollmentPending: number;
  averageCompletionTime: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`onboarding-tabpanel-${index}`}
      aria-labelledby={`onboarding-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function OnboardingManagementDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingRecords, setOnboardingRecords] = useState<OnboardingRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [filteredRecords, setFilteredRecords] = useState<OnboardingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stepFilter, setStepFilter] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<OnboardingRecord | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Analytics data
  const [analyticsData, setAnalyticsData] = useState({
    completionTrends: [],
    stepCompletionRates: [],
    departmentBreakdown: [],
    statusDistribution: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    filterRecords();
  }, [onboardingRecords, searchQuery, statusFilter, stepFilter]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load dashboard statistics
      const statsResponse = await fetch('/api/onboarding/analytics/dashboard');
      const statsResult = await statsResponse.json();

      if (statsResult.success) {
        setDashboardStats(statsResult.data);
      }

      // Load onboarding records
      const recordsResponse = await fetch('/api/onboarding/list?limit=100');
      const recordsResult = await recordsResponse.json();

      if (recordsResult.success) {
        setOnboardingRecords(recordsResult.data.records);
      }

      // Load analytics data
      const analyticsResponse = await fetch('/api/onboarding/analytics/comprehensive');
      const analyticsResult = await analyticsResponse.json();

      if (analyticsResult.success) {
        setAnalyticsData(analyticsResult.data);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const filterRecords = () => {
    let filtered = onboardingRecords;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(record =>
        record.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.onboardingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.department.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.overallStatus === statusFilter);
    }

    // Apply step filter
    if (stepFilter !== 'all') {
      filtered = filtered.filter(record => record.currentStep === stepFilter);
    }

    setFilteredRecords(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const handleRecordAction = async (action: string, recordId: string) => {
    try {
      setError(null);
      
      switch (action) {
        case 'retry_verification':
          await fetch(`/api/onboarding/${recordId}/retry-statutory-verification`, {
            method: 'POST'
          });
          break;
        case 'mark_complete':
          await fetch(`/api/onboarding/${recordId}/complete`, {
            method: 'POST'
          });
          break;
        case 'reset_biometric':
          await fetch(`/api/onboarding/${recordId}/reset-biometric`, {
            method: 'POST'
          });
          break;
        default:
          break;
      }

      // Refresh data after action
      await refreshData();
    } catch (err) {
      setError(`Failed to perform action: ${action}`);
      console.error('Error performing action:', err);
    }
  };

  const renderDashboardOverview = () => (
    <Grid container spacing={3}>
      {/* Key Metrics */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PeopleIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Total Onboarding</Typography>
            </Box>
            <Typography variant="h3" color="primary">
              {dashboardStats?.totalOnboarding || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All time
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ScheduleIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="h6">Active</Typography>
            </Box>
            <Typography variant="h3" color="warning.main">
              {dashboardStats?.activeOnboarding || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              In progress
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6">Completed Today</Typography>
            </Box>
            <Typography variant="h3" color="success.main">
              {dashboardStats?.completedToday || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last 24 hours
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PendingActionsIcon color="error" sx={{ mr: 1 }} />
              <Typography variant="h6">Pending Actions</Typography>
            </Box>
            <Typography variant="h3" color="error.main">
              {dashboardStats?.pendingActions || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Require attention
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Additional Metrics */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Verification Status
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                  <Typography variant="h4" color="warning.contrastText">
                    {dashboardStats?.statutoryVerificationPending || 0}
                  </Typography>
                  <Typography variant="body2" color="warning.contrastText">
                    Statutory Verification Pending
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                  <Typography variant="h4" color="info.contrastText">
                    {dashboardStats?.biometricEnrollmentPending || 0}
                  </Typography>
                  <Typography variant="body2" color="info.contrastText">
                    Biometric Enrollment Pending
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Document Review
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h3" color="primary">
                {dashboardStats?.documentsAwaitingReview || 0}
              </Typography>
              <DocumentScannerIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Documents awaiting review
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={((dashboardStats?.documentsAwaitingReview || 0) / 100) * 100}
              sx={{ mt: 2 }}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Completion Trends Chart */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Onboarding Completion Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.completionTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="#4caf50" name="Completed" />
                <Line type="monotone" dataKey="started" stroke="#2196f3" name="Started" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderOnboardingRecords = () => (
    <Box>
      {/* Search and Filter Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search by name, ID, designation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
          }}
          sx={{ minWidth: 300 }}
        />
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Current Step</InputLabel>
          <Select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value)}
            label="Current Step"
          >
            <MenuItem value="all">All Steps</MenuItem>
            <MenuItem value="personal_info_collection">Personal Info</MenuItem>
            <MenuItem value="document_upload">Document Upload</MenuItem>
            <MenuItem value="biometric_enrollment">Biometric</MenuItem>
            <MenuItem value="statutory_verification">Statutory Verification</MenuItem>
            <MenuItem value="attendance_setup">Attendance Setup</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={refreshData}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>

        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => {/* Navigate to new onboarding */}}
        >
          New Onboarding
        </Button>
      </Box>

      {/* Records Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Current Step</TableCell>
              <TableCell>Statutory Status</TableCell>
              <TableCell>Documents</TableCell>
              <TableCell>Last Activity</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.map((record) => (
              <TableRow key={record.onboardingId} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                      {record.employeeName.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {record.employeeName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {record.onboardingId}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Typography variant="body2">{record.designation}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {record.department}
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={record.progress.percentage}
                      sx={{ width: 100, height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption">
                      {record.progress.percentage}%
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {record.progress.completedSteps}/{record.progress.totalSteps} steps
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <Chip
                    label={record.currentStep.replace(/_/g, ' ')}
                    color={getStatusColor(record.overallStatus) as any}
                    size="small"
                  />
                </TableCell>
                
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="EPFO Status">
                      <Chip
                        label="EPFO"
                        color={getVerificationStatusColor(record.statutoryVerification.epfoStatus) as any}
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                    <Tooltip title="ESIC Status">
                      <Chip
                        label="ESIC"
                        color={getVerificationStatusColor(record.statutoryVerification.esicStatus) as any}
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Typography variant="body2">
                    {record.documentsUploaded}/{record.totalDocuments}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(record.documentsUploaded / record.totalDocuments) * 100}
                    sx={{ width: 60, height: 4, borderRadius: 2 }}
                  />
                </TableCell>
                
                <TableCell>
                  <Typography variant="caption">
                    {isValid(parseISO(record.lastActivity)) 
                      ? format(parseISO(record.lastActivity), 'MMM dd, HH:mm')
                      : 'Unknown'
                    }
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="More Actions">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setActionMenuAnchor(e.currentTarget);
                          setSelectedRecord(record);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredRecords.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No onboarding records found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search or filter criteria
          </Typography>
        </Box>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
      >
        <DropdownMenuItem onClick={() => handleRecordAction('retry_verification', selectedRecord?.onboardingId || '')}>
          <ListItemIcon><RefreshIcon /></ListItemIcon>
          <ListItemText>Retry Statutory Verification</ListItemText>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRecordAction('reset_biometric', selectedRecord?.onboardingId || '')}>
          <ListItemIcon><SecurityIcon /></ListItemIcon>
          <ListItemText>Reset Biometric</ListItemText>
        </DropdownMenuItem>
        <Divider />
        <DropdownMenuItem onClick={() => handleRecordAction('mark_complete', selectedRecord?.onboardingId || '')}>
          <ListItemIcon><CheckCircleIcon /></ListItemIcon>
          <ListItemText>Mark Complete</ListItemText>
        </DropdownMenuItem>
      </Menu>
    </Box>
  );

  const renderAnalytics = () => (
    <Grid container spacing={3}>
      {/* Status Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.statusDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Step Completion Rates */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Step Completion Rates
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.stepCompletionRates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="step" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip />
                <Bar dataKey="completionRate" fill="#2196f3" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Department Breakdown */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Department-wise Onboarding
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.departmentBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Bar dataKey="total" fill="#4caf50" name="Total" />
                <Bar dataKey="completed" fill="#2196f3" name="Completed" />
                <Bar dataKey="pending" fill="#ff9800" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Onboarding Management Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive onboarding oversight and management
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab 
            icon={<DashboardIcon />} 
            label="Overview" 
            iconPosition="start"
          />
          <Tab 
            icon={<Badge badgeContent={onboardingRecords.length} color="primary"><PeopleIcon /></Badge>} 
            label="Records" 
            iconPosition="start"
          />
          <Tab 
            icon={<AnalyticsIcon />} 
            label="Analytics" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {renderDashboardOverview()}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {renderOnboardingRecords()}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {renderAnalytics()}
      </TabPanel>
    </Container>
  );
}
