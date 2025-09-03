"use client";

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
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Calendar,
  TimePicker,
  DatePicker,
  Checkbox,
  FormGroup
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  AccessTime as TimeIcon,
  DateRange as DateRangeIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  Assignment as AssignmentIcon,
  Event as EventIcon,
  Today as TodayIcon,
  CalendarMonth as CalendarIcon,
  Alarm as AlarmIcon,
  Work as WorkIcon,
  Weekend as WeekendIcon,
  EventAvailable as AvailableIcon,
  EventBusy as BusyIcon,
  SwapHoriz as SwapIcon,
  Repeat as RepeatIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { TimePicker as MuiTimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ProtectedRoute from '../../ProtectedRoute';

interface ShiftTemplate {
  id: string;
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  type: 'full-day' | 'half-day' | 'custom';
  breakDuration: number; // in minutes
  isActive: boolean;
  color: string;
  allowedRoles: string[];
  minimumStaff: number;
  maximumStaff: number;
  createdBy: string;
  createdAt: Date;
}

interface ShiftAssignment {
  id: string;
  shiftTemplateId: string;
  userId: string;
  userName: string;
  userRole: string;
  date: Date;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
  actualStartTime?: Date;
  actualEndTime?: Date;
  location?: string;
  notes?: string;
  swapRequested?: boolean;
  swapRequestedBy?: string;
}

interface ShiftPattern {
  id: string;
  name: string;
  description: string;
  shiftTemplates: string[];
  rotationDays: number;
  isActive: boolean;
  assignedTeams: string[];
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  avatar?: string;
  isActive: boolean;
  shiftPreferences: {
    preferredShifts: string[];
    unavailableDays: string[];
    maxHoursPerWeek: number;
  };
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
      id={`shifts-tabpanel-${index}`}
      aria-labelledby={`shifts-tab-${index}`}
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
    id: `shifts-tab-${index}`,
    'aria-controls': `shifts-tabpanel-${index}`,
  };
}

// Shift Template Management
interface ShiftTemplateManagementProps {
  shiftTemplates: ShiftTemplate[];
  onCreateTemplate: (template: any) => void;
  onUpdateTemplate: (templateId: string, template: any) => void;
  onDeleteTemplate: (templateId: string) => void;
}

const ShiftTemplateManagement: React.FC<ShiftTemplateManagementProps> = ({
  shiftTemplates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate
}) => {
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    type: 'full-day',
    startTime: new Date(),
    endTime: new Date(),
    breakDuration: 60,
    color: '#1976d2',
    allowedRoles: [] as string[],
    minimumStaff: 1,
    maximumStaff: 5
  });

  const shiftTypes = [
    { value: 'full-day', label: 'Full Day (8+ hours)', duration: 480 },
    { value: 'half-day', label: 'Half Day (4 hours)', duration: 240 },
    { value: 'custom', label: 'Custom Duration', duration: 0 }
  ];

  const roles = ['Admin', 'Supervisor', 'FieldTech', 'SiteStaff', 'Security'];
  const colors = ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#0288d1', '#689f38'];

  const handleOpenDialog = (template?: ShiftTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateFormData({
        name: template.name,
        description: template.description,
        type: template.type,
        startTime: template.startTime,
        endTime: template.endTime,
        breakDuration: template.breakDuration,
        color: template.color,
        allowedRoles: template.allowedRoles,
        minimumStaff: template.minimumStaff,
        maximumStaff: template.maximumStaff
      });
    } else {
      setEditingTemplate(null);
      setTemplateFormData({
        name: '',
        description: '',
        type: 'full-day',
        startTime: new Date(),
        endTime: new Date(),
        breakDuration: 60,
        color: '#1976d2',
        allowedRoles: [],
        minimumStaff: 1,
        maximumStaff: 5
      });
    }
    setTemplateDialog(true);
  };

  const handleSaveTemplate = () => {
    const duration = templateFormData.endTime.getTime() - templateFormData.startTime.getTime();
    const templateData = {
      ...templateFormData,
      duration: Math.floor(duration / (1000 * 60)), // Convert to minutes
      isActive: true
    };

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, templateData);
    } else {
      onCreateTemplate(templateData);
    }
    setTemplateDialog(false);
  };

  const handleTypeChange = (type: string) => {
    const selectedType = shiftTypes.find(t => t.value === type);
    if (selectedType && selectedType.duration > 0) {
      const start = new Date();
      start.setHours(9, 0, 0, 0); // Default 9 AM start
      const end = new Date(start.getTime() + selectedType.duration * 60000);
      
      setTemplateFormData({
        ...templateFormData,
        type,
        startTime: start,
        endTime: end
      });
    } else {
      setTemplateFormData({ ...templateFormData, type });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">Shift Templates</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Create Template
          </Button>
        </Box>

        <Grid container spacing={3}>
          {shiftTemplates.map((template) => (
            <Grid item xs={12} md={6} lg={4} key={template.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: template.color
                      }}
                    />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {template.name}
                    </Typography>
                    <Chip
                      label={template.type.replace('-', ' ')}
                      size="small"
                      color="primary"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {template.description}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TimeIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">
                      {formatTime(template.startTime)} - {formatTime(template.endTime)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ScheduleIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">
                      Duration: {calculateDuration(template.startTime, template.endTime)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <GroupIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">
                      Staff: {template.minimumStaff}-{template.maximumStaff}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                    {template.allowedRoles.map((role) => (
                      <Chip key={role} label={role} size="small" variant="outlined" />
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton size="small" onClick={() => handleOpenDialog(template)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small">
                        <CopyIcon />
                      </IconButton>
                    </Box>
                    <Switch
                      checked={template.isActive}
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Template Creation Dialog */}
        <Dialog open={templateDialog} onClose={() => setTemplateDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingTemplate ? 'Edit Shift Template' : 'Create New Shift Template'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Shift Type</InputLabel>
                  <Select
                    value={templateFormData.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    label="Shift Type"
                  >
                    {shiftTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <MuiTimePicker
                  label="Start Time"
                  value={templateFormData.startTime}
                  onChange={(newValue) => newValue && setTemplateFormData({ ...templateFormData, startTime: newValue })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <MuiTimePicker
                  label="End Time"
                  value={templateFormData.endTime}
                  onChange={(newValue) => newValue && setTemplateFormData({ ...templateFormData, endTime: newValue })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Break Duration (minutes)"
                  value={templateFormData.breakDuration}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, breakDuration: parseInt(e.target.value) })}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Color</InputLabel>
                  <Select
                    value={templateFormData.color}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, color: e.target.value })}
                    label="Color"
                  >
                    {colors.map((color) => (
                      <MenuItem key={color} value={color}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              backgroundColor: color
                            }}
                          />
                          {color}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Minimum Staff"
                  value={templateFormData.minimumStaff}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, minimumStaff: parseInt(e.target.value) })}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum Staff"
                  value={templateFormData.maximumStaff}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, maximumStaff: parseInt(e.target.value) })}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Allowed Roles</Typography>
                <FormGroup row>
                  {roles.map((role) => (
                    <FormControlLabel
                      key={role}
                      control={
                        <Checkbox
                          checked={templateFormData.allowedRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTemplateFormData({
                                ...templateFormData,
                                allowedRoles: [...templateFormData.allowedRoles, role]
                              });
                            } else {
                              setTemplateFormData({
                                ...templateFormData,
                                allowedRoles: templateFormData.allowedRoles.filter(r => r !== role)
                              });
                            }
                          }}
                        />
                      }
                      label={role}
                    />
                  ))}
                </FormGroup>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTemplateDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} variant="contained">
              {editingTemplate ? 'Update' : 'Create'} Template
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

// Shift Scheduling Component
interface ShiftSchedulingProps {
  shiftTemplates: ShiftTemplate[];
  shiftAssignments: ShiftAssignment[];
  staffMembers: StaffMember[];
  onCreateAssignment: (assignment: any) => void;
  onUpdateAssignment: (assignmentId: string, assignment: any) => void;
}

const ShiftScheduling: React.FC<ShiftSchedulingProps> = ({
  shiftTemplates,
  shiftAssignments,
  staffMembers,
  onCreateAssignment,
  onUpdateAssignment
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [bulkScheduleDialog, setBulkScheduleDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const getDayAssignments = (date: Date) => {
    return shiftAssignments.filter(assignment => 
      assignment.date.toDateString() === date.toDateString()
    );
  };

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'confirmed': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'missed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const renderDailyView = () => {
    const assignments = getDayAssignments(selectedDate);
    const groupedByTemplate = assignments.reduce((acc, assignment) => {
      const template = shiftTemplates.find(t => t.id === assignment.shiftTemplateId);
      if (template) {
        if (!acc[template.id]) {
          acc[template.id] = { template, assignments: [] };
        }
        acc[template.id].assignments.push(assignment);
      }
      return acc;
    }, {} as Record<string, { template: ShiftTemplate; assignments: ShiftAssignment[] }>);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Schedule for {selectedDate.toLocaleDateString()}
        </Typography>
        
        {Object.values(groupedByTemplate).map(({ template, assignments }) => (
          <Card key={template.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: template.color
                  }}
                />
                <Typography variant="h6">{template.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {template.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                  {template.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                {assignments.map((assignment) => (
                  <Grid item xs={12} md={6} key={assignment.id}>
                    <Paper sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {assignment.userName[0]}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2">{assignment.userName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {assignment.userRole}
                          </Typography>
                        </Box>
                        <Chip
                          label={assignment.status}
                          size="small"
                          color={getStatusColor(assignment.status)}
                        />
                      </Box>
                      {assignment.location && (
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          Location: {assignment.location}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              
              {assignments.length < template.maximumStaff && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => setScheduleDialog(true)}
                >
                  Add Staff
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        
        {Object.keys(groupedByTemplate).length === 0 && (
          <Alert severity="info">
            No shifts scheduled for this date.
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              sx={{ ml: 2 }}
              onClick={() => setScheduleDialog(true)}
            >
              Schedule Shift
            </Button>
          </Alert>
        )}
      </Box>
    );
  };

  const renderWeeklyView = () => {
    const weekDates = getWeekDates(selectedDate);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Week of {weekDates[0].toLocaleDateString()}
        </Typography>
        
        <Grid container spacing={1}>
          {weekDates.map((date, index) => {
            const assignments = getDayAssignments(date);
            return (
              <Grid item xs={12/7} key={date.toISOString()}>
                <Paper
                  sx={{
                    p: 1,
                    minHeight: 200,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                  onClick={() => setSelectedDate(date)}
                >
                  <Typography variant="subtitle2" align="center">
                    {dayNames[index]}
                  </Typography>
                  <Typography variant="h6" align="center" gutterBottom>
                    {date.getDate()}
                  </Typography>
                  
                  {assignments.map((assignment) => {
                    const template = shiftTemplates.find(t => t.id === assignment.shiftTemplateId);
                    return (
                      <Box
                        key={assignment.id}
                        sx={{
                          backgroundColor: template?.color || 'grey.300',
                          color: 'white',
                          p: 0.5,
                          mb: 0.5,
                          borderRadius: 1,
                          fontSize: '0.75rem'
                        }}
                      >
                        {assignment.userName.split(' ')[0]}
                      </Box>
                    );
                  })}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={viewMode === 'daily' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('daily')}
            >
              Daily
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('weekly')}
            >
              Weekly
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('monthly')}
            >
              Monthly
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RepeatIcon />}
              onClick={() => setBulkScheduleDialog(true)}
            >
              Bulk Schedule
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setScheduleDialog(true)}
            >
              Schedule Shift
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <DateCalendar
                value={selectedDate}
                onChange={(newValue) => newValue && setSelectedDate(newValue)}
              />
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={9}>
            <Paper sx={{ p: 3, minHeight: 400 }}>
              {viewMode === 'daily' && renderDailyView()}
              {viewMode === 'weekly' && renderWeeklyView()}
              {viewMode === 'monthly' && (
                <Typography>Monthly view coming soon...</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

// Main Shift Configuration Page
const ShiftConfigurationPage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([]);

  // Mock data initialization
  useEffect(() => {
    // Mock shift templates
    setShiftTemplates([
      {
        id: '1',
        name: 'Morning Shift',
        description: 'Standard morning shift for facility operations',
        startTime: new Date(2025, 0, 1, 8, 0),
        endTime: new Date(2025, 0, 1, 16, 0),
        duration: 480,
        type: 'full-day',
        breakDuration: 60,
        isActive: true,
        color: '#1976d2',
        allowedRoles: ['FieldTech', 'SiteStaff', 'Supervisor'],
        minimumStaff: 2,
        maximumStaff: 5,
        createdBy: 'admin',
        createdAt: new Date()
      },
      {
        id: '2',
        name: 'Evening Shift',
        description: 'Evening shift for extended coverage',
        startTime: new Date(2025, 0, 1, 16, 0),
        endTime: new Date(2025, 0, 1, 24, 0),
        duration: 480,
        type: 'full-day',
        breakDuration: 60,
        isActive: true,
        color: '#388e3c',
        allowedRoles: ['FieldTech', 'SiteStaff'],
        minimumStaff: 1,
        maximumStaff: 3,
        createdBy: 'admin',
        createdAt: new Date()
      },
      {
        id: '3',
        name: 'Half Day - Morning',
        description: 'Half day morning shift',
        startTime: new Date(2025, 0, 1, 8, 0),
        endTime: new Date(2025, 0, 1, 12, 0),
        duration: 240,
        type: 'half-day',
        breakDuration: 30,
        isActive: true,
        color: '#f57c00',
        allowedRoles: ['SiteStaff'],
        minimumStaff: 1,
        maximumStaff: 2,
        createdBy: 'admin',
        createdAt: new Date()
      }
    ]);

    // Mock staff members
    setStaffMembers([
      {
        id: '1',
        name: 'John Doe',
        role: 'FieldTech',
        department: 'Operations',
        email: 'john.doe@company.com',
        phone: '555-0101',
        isActive: true,
        shiftPreferences: {
          preferredShifts: ['1'],
          unavailableDays: [],
          maxHoursPerWeek: 40
        }
      },
      {
        id: '2',
        name: 'Jane Smith',
        role: 'SiteStaff',
        department: 'Security',
        email: 'jane.smith@company.com',
        phone: '555-0102',
        isActive: true,
        shiftPreferences: {
          preferredShifts: ['2'],
          unavailableDays: ['Sunday'],
          maxHoursPerWeek: 35
        }
      },
      {
        id: '3',
        name: 'Mike Johnson',
        role: 'Supervisor',
        department: 'Operations',
        email: 'mike.johnson@company.com',
        phone: '555-0103',
        isActive: true,
        shiftPreferences: {
          preferredShifts: ['1', '2'],
          unavailableDays: [],
          maxHoursPerWeek: 45
        }
      }
    ]);

    // Mock shift assignments
    setShiftAssignments([
      {
        id: '1',
        shiftTemplateId: '1',
        userId: '1',
        userName: 'John Doe',
        userRole: 'FieldTech',
        date: new Date(),
        status: 'scheduled',
        location: 'Building A'
      },
      {
        id: '2',
        shiftTemplateId: '1',
        userId: '3',
        userName: 'Mike Johnson',
        userRole: 'Supervisor',
        date: new Date(),
        status: 'confirmed',
        location: 'Building A'
      },
      {
        id: '3',
        shiftTemplateId: '2',
        userId: '2',
        userName: 'Jane Smith',
        userRole: 'SiteStaff',
        date: new Date(),
        status: 'scheduled',
        location: 'Main Entrance'
      }
    ]);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleCreateTemplate = (templateData: any) => {
    const newTemplate: ShiftTemplate = {
      id: Date.now().toString(),
      ...templateData,
      createdBy: 'current-user',
      createdAt: new Date()
    };
    setShiftTemplates([...shiftTemplates, newTemplate]);
  };

  const handleUpdateTemplate = (templateId: string, templateData: any) => {
    setShiftTemplates(prev =>
      prev.map(template =>
        template.id === templateId
          ? { ...template, ...templateData }
          : template
      )
    );
  };

  const handleDeleteTemplate = (templateId: string) => {
    setShiftTemplates(prev => prev.filter(template => template.id !== templateId));
  };

  const handleCreateAssignment = (assignmentData: any) => {
    const newAssignment: ShiftAssignment = {
      id: Date.now().toString(),
      ...assignmentData,
      status: 'scheduled'
    };
    setShiftAssignments([...shiftAssignments, newAssignment]);
  };

  const handleUpdateAssignment = (assignmentId: string, assignmentData: any) => {
    setShiftAssignments(prev =>
      prev.map(assignment =>
        assignment.id === assignmentId
          ? { ...assignment, ...assignmentData }
          : assignment
      )
    );
  };

  return (
    <ProtectedRoute allowed={['Admin', 'Supervisor']}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Shift Configuration & Scheduling
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Comprehensive shift management with templates, scheduling, and staff assignments
          </Typography>
        </Box>

        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={handleTabChange} aria-label="shift tabs">
              <Tab
                label="Shift Templates"
                icon={<ScheduleIcon />}
                iconPosition="start"
                {...a11yProps(0)}
              />
              <Tab
                label="Scheduling"
                icon={<CalendarIcon />}
                iconPosition="start"
                {...a11yProps(1)}
              />
              <Tab
                label="Staff Management"
                icon={<GroupIcon />}
                iconPosition="start"
                {...a11yProps(2)}
              />
              <Tab
                label="Shift Patterns"
                icon={<RepeatIcon />}
                iconPosition="start"
                {...a11yProps(3)}
              />
            </Tabs>
          </Box>

          <TabPanel value={currentTab} index={0}>
            <ShiftTemplateManagement
              shiftTemplates={shiftTemplates}
              onCreateTemplate={handleCreateTemplate}
              onUpdateTemplate={handleUpdateTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <ShiftScheduling
              shiftTemplates={shiftTemplates}
              shiftAssignments={shiftAssignments}
              staffMembers={staffMembers}
              onCreateAssignment={handleCreateAssignment}
              onUpdateAssignment={handleUpdateAssignment}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <Typography variant="h6" gutterBottom>Staff Management</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Manage staff availability, preferences, and shift assignments.
            </Alert>
            
            <Grid container spacing={3}>
              {staffMembers.map((staff) => (
                <Grid item xs={12} md={6} lg={4} key={staff.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar>{staff.name[0]}</Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6">{staff.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {staff.role} • {staff.department}
                          </Typography>
                        </Box>
                        <Chip
                          label={staff.isActive ? 'Active' : 'Inactive'}
                          color={staff.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="body2" gutterBottom>
                        Max Hours/Week: {staff.shiftPreferences.maxHoursPerWeek}
                      </Typography>
                      
                      <Typography variant="body2" gutterBottom>
                        Preferred Shifts: {staff.shiftPreferences.preferredShifts.length}
                      </Typography>
                      
                      {staff.shiftPreferences.unavailableDays.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Unavailable: {staff.shiftPreferences.unavailableDays.join(', ')}
                        </Typography>
                      )}
                      
                      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                        <Button size="small" startIcon={<EditIcon />}>
                          Edit
                        </Button>
                        <Button size="small" startIcon={<ScheduleIcon />}>
                          Schedule
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <Typography variant="h6" gutterBottom>Shift Patterns & Rotation</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Create recurring shift patterns and rotation schedules for teams.
            </Alert>
            
            <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 3 }}>
              Create Shift Pattern
            </Button>
            
            <Typography variant="body1" color="text.secondary">
              Shift pattern management coming soon...
            </Typography>
          </TabPanel>
        </Paper>
      </Container>
    </ProtectedRoute>
  );
};

export default ShiftConfigurationPage;
