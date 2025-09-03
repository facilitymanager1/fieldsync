'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  LinearProgress,
  Badge,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Pending as PendingIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedDate: Date;
  approvedBy?: string;
  approvedDate?: Date;
  comments?: string;
}

interface LeaveBalance {
  leaveType: string;
  allocated: number;
  used: number;
  remaining: number;
  carryForward: number;
}

// Tab Panel Component
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
      id={`leave-tabpanel-${index}`}
      aria-labelledby={`leave-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `leave-tab-${index}`,
    'aria-controls': `leave-tabpanel-${index}`,
  };
}

// Leave Application Form Component
interface LeaveApplicationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (leaveData: any) => void;
  editingLeave?: LeaveRequest | null;
}

const LeaveApplicationForm: React.FC<LeaveApplicationFormProps> = ({
  open,
  onClose,
  onSubmit,
  editingLeave
}) => {
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    reason: '',
    emergencyContact: '',
    handoverNotes: ''
  });

  const leaveTypes = [
    { value: 'casual', label: 'Casual Leave' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'annual', label: 'Annual Leave' },
    { value: 'maternity', label: 'Maternity Leave' },
    { value: 'paternity', label: 'Paternity Leave' },
    { value: 'emergency', label: 'Emergency Leave' },
    { value: 'unpaid', label: 'Unpaid Leave' }
  ];

  useEffect(() => {
    if (editingLeave) {
      setFormData({
        leaveType: editingLeave.leaveType,
        startDate: editingLeave.startDate,
        endDate: editingLeave.endDate,
        reason: editingLeave.reason,
        emergencyContact: '',
        handoverNotes: ''
      });
    } else {
      setFormData({
        leaveType: '',
        startDate: null,
        endDate: null,
        reason: '',
        emergencyContact: '',
        handoverNotes: ''
      });
    }
  }, [editingLeave, open]);

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const timeDiff = formData.endDate.getTime() - formData.startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      return daysDiff > 0 ? daysDiff : 0;
    }
    return 0;
  };

  const handleSubmit = () => {
    const leaveData = {
      ...formData,
      days: calculateDays(),
      status: 'pending',
      appliedDate: new Date()
    };
    onSubmit(leaveData);
    onClose();
  };

  const isFormValid = formData.leaveType && formData.startDate && formData.endDate && formData.reason;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editingLeave ? 'Edit Leave Request' : 'Apply for Leave'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Leave Type</InputLabel>
              <Select
                value={formData.leaveType}
                onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                label="Leave Type"
              >
                {leaveTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={formData.startDate}
                onChange={(date) => setFormData({ ...formData, startDate: date })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="End Date"
                value={formData.endDate}
                onChange={(date) => setFormData({ ...formData, endDate: date })}
                minDate={formData.startDate || undefined}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
          </Grid>

          {formData.startDate && formData.endDate && (
            <Grid item xs={12}>
              <Alert severity="info">
                Total days requested: {calculateDays()} days
              </Alert>
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason for Leave"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Please provide a detailed reason for your leave request..."
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Emergency Contact"
              value={formData.emergencyContact}
              onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
              placeholder="Contact number during leave"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Handover Notes"
              value={formData.handoverNotes}
              onChange={(e) => setFormData({ ...formData, handoverNotes: e.target.value })}
              placeholder="Any work handover notes for colleagues..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!isFormValid}
        >
          {editingLeave ? 'Update Request' : 'Submit Application'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Leave Approval Component (for supervisors/admins)
interface LeaveApprovalProps {
  leaveRequest: LeaveRequest;
  onApprove: (id: string, comments: string) => void;
  onReject: (id: string, comments: string) => void;
}

const LeaveApproval: React.FC<LeaveApprovalProps> = ({ leaveRequest, onApprove, onReject }) => {
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');

  const handleApprovalAction = (actionType: 'approve' | 'reject') => {
    setAction(actionType);
    setApprovalDialog(true);
  };

  const handleSubmitApproval = () => {
    if (action === 'approve') {
      onApprove(leaveRequest.id, comments);
    } else {
      onReject(leaveRequest.id, comments);
    }
    setApprovalDialog(false);
    setComments('');
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton
          size="small"
          color="success"
          onClick={() => handleApprovalAction('approve')}
          disabled={leaveRequest.status !== 'pending'}
        >
          <ApproveIcon />
        </IconButton>
        <IconButton
          size="small"
          color="error"
          onClick={() => handleApprovalAction('reject')}
          disabled={leaveRequest.status !== 'pending'}
        >
          <RejectIcon />
        </IconButton>
        <IconButton size="small" color="primary">
          <ViewIcon />
        </IconButton>
      </Box>

      <Dialog open={approvalDialog} onClose={() => setApprovalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {action === 'approve' ? 'Approve' : 'Reject'} Leave Request
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Employee: {leaveRequest.employeeName}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Leave Type: {leaveRequest.leaveType} | Days: {leaveRequest.days}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Period: {leaveRequest.startDate.toLocaleDateString()} - {leaveRequest.endDate.toLocaleDateString()}
            </Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Comments (Optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={`Add comments for ${action}al...`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmitApproval} 
            variant="contained" 
            color={action === 'approve' ? 'success' : 'error'}
          >
            {action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Main Leave Management Component
const LeaveManagementPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [leaveApplicationDialog, setLeaveApplicationDialog] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [userRole] = useState<'employee' | 'supervisor' | 'admin'>('supervisor'); // Mock role

  // Mock data
  useEffect(() => {
    // Mock leave balances
    setLeaveBalances([
      { leaveType: 'Annual Leave', allocated: 21, used: 8, remaining: 13, carryForward: 5 },
      { leaveType: 'Sick Leave', allocated: 10, used: 2, remaining: 8, carryForward: 0 },
      { leaveType: 'Casual Leave', allocated: 12, used: 4, remaining: 8, carryForward: 2 },
      { leaveType: 'Personal Leave', allocated: 5, used: 1, remaining: 4, carryForward: 0 }
    ]);

    // Mock leave requests
    setLeaveRequests([
      {
        id: '1',
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        leaveType: 'annual',
        startDate: new Date('2025-08-15'),
        endDate: new Date('2025-08-20'),
        days: 6,
        reason: 'Family vacation',
        status: 'pending',
        appliedDate: new Date('2025-08-01')
      },
      {
        id: '2',
        employeeId: 'EMP002',
        employeeName: 'Jane Smith',
        leaveType: 'sick',
        startDate: new Date('2025-08-05'),
        endDate: new Date('2025-08-07'),
        days: 3,
        reason: 'Medical appointment and recovery',
        status: 'approved',
        appliedDate: new Date('2025-08-03'),
        approvedBy: 'Manager',
        approvedDate: new Date('2025-08-04')
      },
      {
        id: '3',
        employeeId: 'EMP003',
        employeeName: 'Mike Johnson',
        leaveType: 'casual',
        startDate: new Date('2025-08-10'),
        endDate: new Date('2025-08-10'),
        days: 1,
        reason: 'Personal work',
        status: 'rejected',
        appliedDate: new Date('2025-08-08'),
        approvedBy: 'Manager',
        approvedDate: new Date('2025-08-09'),
        comments: 'Insufficient notice period'
      }
    ]);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleLeaveApplication = (leaveData: any) => {
    const newLeave: LeaveRequest = {
      id: Date.now().toString(),
      employeeId: 'EMP001', // Current user
      employeeName: 'Current User',
      ...leaveData
    };
    setLeaveRequests([newLeave, ...leaveRequests]);
  };

  const handleApproveLeave = (id: string, comments: string) => {
    setLeaveRequests(prev =>
      prev.map(leave =>
        leave.id === id
          ? {
              ...leave,
              status: 'approved' as const,
              approvedBy: 'Current Manager',
              approvedDate: new Date(),
              comments
            }
          : leave
      )
    );
  };

  const handleRejectLeave = (id: string, comments: string) => {
    setLeaveRequests(prev =>
      prev.map(leave =>
        leave.id === id
          ? {
              ...leave,
              status: 'rejected' as const,
              approvedBy: 'Current Manager',
              approvedDate: new Date(),
              comments
            }
          : leave
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <ApproveIcon />;
      case 'rejected': return <RejectIcon />;
      case 'pending': return <PendingIcon />;
      default: return <PendingIcon />;
    }
  };

  const pendingCount = leaveRequests.filter(req => req.status === 'pending').length;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Leave Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Apply for leaves, track balances, and manage approvals
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="leave tabs">
            <Tab
              label="Apply Leave"
              icon={<CalendarIcon />}
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              label="My Requests"
              icon={<PersonIcon />}
              iconPosition="start"
              {...a11yProps(1)}
            />
            {(userRole === 'supervisor' || userRole === 'admin') && (
              <Tab
                label={
                  <Badge badgeContent={pendingCount} color="error">
                    Approvals
                  </Badge>
                }
                icon={<AdminIcon />}
                iconPosition="start"
                {...a11yProps(2)}
              />
            )}
            <Tab
              label="Leave Balance"
              icon={<HistoryIcon />}
              iconPosition="start"
              {...a11yProps(3)}
            />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6">Apply for Leave</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setLeaveApplicationDialog(true)}
            >
              New Leave Request
            </Button>
          </Box>

          {/* Quick Leave Balance Overview */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {leaveBalances.slice(0, 4).map((balance, index) => (
              <Grid item xs={12} md={3} key={index}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {balance.remaining}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {balance.leaveType} Remaining
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(balance.used / balance.allocated) * 100}
                      sx={{ mt: 2 }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      {balance.used} of {balance.allocated} used
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Recent Applications */}
          <Typography variant="h6" gutterBottom>
            Recent Applications
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Leave Type</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell align="center">Days</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaveRequests.slice(0, 5).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.leaveType}</TableCell>
                    <TableCell>{request.startDate.toLocaleDateString()}</TableCell>
                    <TableCell>{request.endDate.toLocaleDateString()}</TableCell>
                    <TableCell align="center">{request.days}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                        icon={getStatusIcon(request.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => setEditingLeave(request)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Typography variant="h6" gutterBottom>
            My Leave Requests
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Applied Date</TableCell>
                  <TableCell>Leave Type</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell align="center">Days</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Comments</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.appliedDate.toLocaleDateString()}</TableCell>
                    <TableCell>{request.leaveType}</TableCell>
                    <TableCell>
                      {request.startDate.toLocaleDateString()} - {request.endDate.toLocaleDateString()}
                    </TableCell>
                    <TableCell align="center">{request.days}</TableCell>
                    <TableCell>{request.reason}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                        icon={getStatusIcon(request.status)}
                      />
                    </TableCell>
                    <TableCell>{request.comments || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {(userRole === 'supervisor' || userRole === 'admin') && (
          <TabPanel value={currentTab} index={2}>
            <Typography variant="h6" gutterBottom>
              Leave Approvals
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Leave Type</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell align="center">Days</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Applied Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.employeeName}</TableCell>
                      <TableCell>{request.leaveType}</TableCell>
                      <TableCell>
                        {request.startDate.toLocaleDateString()} - {request.endDate.toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">{request.days}</TableCell>
                      <TableCell>{request.reason}</TableCell>
                      <TableCell>{request.appliedDate.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={request.status}
                          color={getStatusColor(request.status)}
                          size="small"
                          icon={getStatusIcon(request.status)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <LeaveApproval
                          leaveRequest={request}
                          onApprove={handleApproveLeave}
                          onReject={handleRejectLeave}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        )}

        <TabPanel value={currentTab} index={userRole === 'employee' ? 2 : 3}>
          <Typography variant="h6" gutterBottom>
            Leave Balance Overview
          </Typography>
          <Grid container spacing={3}>
            {leaveBalances.map((balance, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {balance.leaveType}
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Allocated</Typography>
                        <Typography variant="body2">{balance.allocated} days</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Used</Typography>
                        <Typography variant="body2">{balance.used} days</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="primary" fontWeight="bold">
                          Remaining
                        </Typography>
                        <Typography variant="body2" color="primary" fontWeight="bold">
                          {balance.remaining} days
                        </Typography>
                      </Box>
                      {balance.carryForward > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="textSecondary">
                            Carry Forward
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {balance.carryForward} days
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(balance.used / balance.allocated) * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                      color={balance.remaining > 5 ? 'success' : balance.remaining > 2 ? 'warning' : 'error'}
                    />
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      {((balance.used / balance.allocated) * 100).toFixed(1)}% utilized
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>
      </Paper>

      {/* Leave Application Dialog */}
      <LeaveApplicationForm
        open={leaveApplicationDialog || editingLeave !== null}
        onClose={() => {
          setLeaveApplicationDialog(false);
          setEditingLeave(null);
        }}
        onSubmit={handleLeaveApplication}
        editingLeave={editingLeave}
      />
    </Container>
  );
};

export default LeaveManagementPage;
