'use client';

// Comprehensive Meeting Minutes Management Dashboard
// Features: Recording, transcription, action items, templates, analytics
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Fab,
  Tooltip,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Assignment as ActionIcon,
  RecordVoiceOver as RecordIcon,
  Transcribe as TranscribeIcon,
  SmartToy as AIIcon,
  Analytics as AnalyticsIcon,
  Template as TemplateIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  CheckCircle as CompleteIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Assignment as TaskIcon,
  ExpandMore as ExpandMoreIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format } from 'date-fns';

interface MeetingMinutes {
  meetingId: string;
  title: string;
  date: Date;
  startTime: Date;
  endTime?: Date;
  location: string;
  meetingType: string;
  organizer: {
    userId: string;
    name: string;
    role: string;
  };
  attendees: Array<{
    userId: string;
    name: string;
    role: string;
    status: string;
  }>;
  agenda: Array<{
    id: string;
    title: string;
    description: string;
    timeAllocated: number;
    presenter: string;
    completed: boolean;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    assignee: {
      userId: string;
      name: string;
    };
    dueDate: Date;
    priority: string;
    status: string;
  }>;
  status: string;
  recording?: {
    status: string;
    duration: number;
  };
  transcription?: {
    text: string;
    confidence: number;
    summary: string;
  };
  aiSummary?: {
    keyPoints: string[];
    mainDecisions: string[];
    nextSteps: string[];
    effectiveness: number;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`meeting-tabpanel-${index}`}
    aria-labelledby={`meeting-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const MeetingMinutesManagement: React.FC = () => {
  // State Management
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingMinutes | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    meetingType: '',
    dateRange: { start: null, end: null }
  });

  // Form State
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    date: new Date(),
    startTime: new Date(),
    location: '',
    meetingType: 'other',
    attendees: [],
    agenda: []
  });

  // Mock Data
  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    const mockMeetings: MeetingMinutes[] = [
      {
        meetingId: '1',
        title: 'Weekly Team Standup',
        date: new Date(),
        startTime: new Date(),
        location: 'Conference Room A',
        meetingType: 'standup',
        organizer: {
          userId: '1',
          name: 'John Manager',
          role: 'Supervisor'
        },
        attendees: [
          { userId: '1', name: 'John Manager', role: 'Supervisor', status: 'present' },
          { userId: '2', name: 'Jane Developer', role: 'FieldTech', status: 'present' },
          { userId: '3', name: 'Bob Analyst', role: 'FieldTech', status: 'late' }
        ],
        agenda: [
          {
            id: '1',
            title: 'Project Updates',
            description: 'Review current project status',
            timeAllocated: 15,
            presenter: 'Jane Developer',
            completed: true
          },
          {
            id: '2',
            title: 'Blockers Discussion',
            description: 'Identify and address any blockers',
            timeAllocated: 10,
            presenter: 'Bob Analyst',
            completed: false
          }
        ],
        actionItems: [
          {
            id: '1',
            title: 'Update project documentation',
            assignee: { userId: '2', name: 'Jane Developer' },
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            priority: 'high',
            status: 'pending'
          },
          {
            id: '2',
            title: 'Schedule client review',
            assignee: { userId: '1', name: 'John Manager' },
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            priority: 'medium',
            status: 'in_progress'
          }
        ],
        status: 'completed',
        recording: {
          status: 'ready',
          duration: 1800 // 30 minutes
        },
        transcription: {
          text: 'Meeting transcription content...',
          confidence: 0.87,
          summary: 'Team discussed project progress and identified key blockers'
        },
        aiSummary: {
          keyPoints: [
            'Project on track for Q4 delivery',
            'Need additional testing resources',
            'Client feedback incorporated'
          ],
          mainDecisions: [
            'Proceed with current timeline',
            'Hire additional QA engineer'
          ],
          nextSteps: [
            'Complete documentation update',
            'Schedule client review meeting'
          ],
          effectiveness: 8
        }
      }
    ];
    setMeetings(mockMeetings);
  };

  // Recording Functions
  const startRecording = async (meetingId: string) => {
    setIsRecording(true);
    setRecordingTime(0);
    
    // Start timer
    const timer = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    // Mock API call
    setTimeout(() => {
      clearInterval(timer);
      console.log(`Recording started for meeting ${meetingId}`);
    }, 1000);
  };

  const stopRecording = async (meetingId: string) => {
    setIsRecording(false);
    
    // Mock processing
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      console.log(`Recording stopped for meeting ${meetingId}. Processing transcription...`);
    }, 2000);
  };

  // Status Helpers
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'default',
      'in_progress': 'warning',
      completed: 'success',
      cancelled: 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'success',
      medium: 'warning',
      high: 'error',
      urgent: 'error'
    };
    return colors[priority] || 'default';
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Render Functions
  const renderMeetingsList = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Meeting Minutes</Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              sx={{ mr: 1 }}
            >
              Filter
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateDialog(true)}
            >
              New Meeting
            </Button>
          </Box>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Meeting</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Attendees</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
                <TableCell>Action Items</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {meetings.map((meeting) => (
                <TableRow key={meeting.meetingId}>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">{meeting.title}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {meeting.location}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {format(new Date(meeting.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={meeting.meetingType}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <AvatarGroup max={3}>
                      {meeting.attendees.map((attendee) => (
                        <Avatar
                          key={attendee.userId}
                          sx={{ width: 24, height: 24 }}
                        >
                          {attendee.name.charAt(0)}
                        </Avatar>
                      ))}
                    </AvatarGroup>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={meeting.status}
                      color={getStatusColor(meeting.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedMeeting(meeting);
                        setShowDetailDialog(true);
                      }}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton size="small">
                      <EditIcon />
                    </IconButton>
                    {meeting.recording && (
                      <IconButton size="small">
                        <RecordIcon />
                      </IconButton>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      badgeContent={meeting.actionItems.filter(ai => ai.status === 'pending').length}
                      color="error"
                    >
                      <ActionIcon />
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  const renderActionItems = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Action Items Dashboard</Typography>
        
        <Grid container spacing={2}>
          {meetings.flatMap(meeting => 
            meeting.actionItems.map(item => (
              <Grid item xs={12} md={6} key={`${meeting.meetingId}-${item.id}`}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start">
                      <Box>
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          From: {meeting.title}
                        </Typography>
                      </Box>
                      <Chip
                        label={item.priority}
                        color={getPriorityColor(item.priority) as any}
                        size="small"
                      />
                    </Box>
                    
                    <Box mt={1}>
                      <Typography variant="body2">
                        Assigned to: {item.assignee.name}
                      </Typography>
                      <Typography variant="body2">
                        Due: {format(new Date(item.dueDate), 'MMM dd, yyyy')}
                      </Typography>
                    </Box>

                    <Box mt={1}>
                      <Chip
                        label={item.status}
                        color={getStatusColor(item.status) as any}
                        size="small"
                        icon={item.status === 'completed' ? <CompleteIcon /> : <TimeIcon />}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderAnalytics = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h4">12</Typography>
            <Typography color="textSecondary">Total Meetings</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h4">24h</Typography>
            <Typography color="textSecondary">Total Time</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h4">45</Typography>
            <Typography color="textSecondary">Action Items</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h4">87%</Typography>
            <Typography color="textSecondary">On-Time Rate</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderTemplates = () => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Meeting Templates</Typography>
          <Button variant="contained" startIcon={<AddIcon />}>
            New Template
          </Button>
        </Box>

        <Grid container spacing={2}>
          {[
            { name: 'Daily Standup', category: 'Agile', duration: 15 },
            { name: 'Sprint Planning', category: 'Agile', duration: 120 },
            { name: 'Client Review', category: 'Client', duration: 60 },
            { name: 'Team Retrospective', category: 'Agile', duration: 90 }
          ].map((template, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1">{template.name}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Category: {template.category}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Duration: {template.duration} minutes
                  </Typography>
                  <Box mt={1}>
                    <Button size="small" startIcon={<EditIcon />}>
                      Edit
                    </Button>
                    <Button size="small" startIcon={<AddIcon />}>
                      Use
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderMeetingDetail = () => {
    if (!selectedMeeting) return null;

    return (
      <Dialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            {selectedMeeting.title}
            <Box>
              {selectedMeeting.status === 'in_progress' && (
                <Box>
                  {isRecording ? (
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<StopIcon />}
                      onClick={() => stopRecording(selectedMeeting.meetingId)}
                    >
                      Stop Recording ({formatDuration(recordingTime)})
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<RecordIcon />}
                      onClick={() => startRecording(selectedMeeting.meetingId)}
                    >
                      Start Recording
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Agenda" />
            <Tab label="Action Items" />
            <Tab label="Transcription" />
            <Tab label="AI Summary" />
          </Tabs>

          <TabPanel value={currentTab} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Meeting Details</Typography>
                <Typography><strong>Date:</strong> {format(new Date(selectedMeeting.date), 'PPP')}</Typography>
                <Typography><strong>Location:</strong> {selectedMeeting.location}</Typography>
                <Typography><strong>Type:</strong> {selectedMeeting.meetingType}</Typography>
                <Typography><strong>Organizer:</strong> {selectedMeeting.organizer.name}</Typography>
                <Typography><strong>Status:</strong> 
                  <Chip 
                    label={selectedMeeting.status} 
                    color={getStatusColor(selectedMeeting.status) as any}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Attendees ({selectedMeeting.attendees.length})</Typography>
                <List dense>
                  {selectedMeeting.attendees.map((attendee) => (
                    <ListItem key={attendee.userId}>
                      <ListItemIcon>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {attendee.name.charAt(0)}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={attendee.name}
                        secondary={`${attendee.role} • ${attendee.status}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <Typography variant="h6" gutterBottom>Meeting Agenda</Typography>
            {selectedMeeting.agenda.map((item) => (
              <Accordion key={item.id}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" width="100%">
                    <Box flexGrow={1}>
                      <Typography variant="subtitle1">{item.title}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {item.timeAllocated} minutes • Presenter: {item.presenter}
                      </Typography>
                    </Box>
                    <Chip
                      label={item.completed ? 'Completed' : 'Pending'}
                      color={item.completed ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography>{item.description}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <Typography variant="h6" gutterBottom>Action Items</Typography>
            <Grid container spacing={2}>
              {selectedMeeting.actionItems.map((item) => (
                <Grid item xs={12} key={item.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start">
                        <Box>
                          <Typography variant="subtitle1">{item.title}</Typography>
                          <Typography variant="body2" color="textSecondary">
                            Assigned to: {item.assignee.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Due: {format(new Date(item.dueDate), 'PPP')}
                          </Typography>
                        </Box>
                        <Box>
                          <Chip
                            label={item.priority}
                            color={getPriorityColor(item.priority) as any}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          <Chip
                            label={item.status}
                            color={getStatusColor(item.status) as any}
                            size="small"
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            {selectedMeeting.transcription ? (
              <Box>
                <Box display="flex" alignItems="center" mb={2}>
                  <TranscribeIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Meeting Transcription</Typography>
                  <Chip
                    label={`${Math.round(selectedMeeting.transcription.confidence * 100)}% confidence`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Summary</Typography>
                  <Typography>{selectedMeeting.transcription.summary}</Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Full Transcription</Typography>
                  <Typography style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedMeeting.transcription.text}
                  </Typography>
                </Paper>
              </Box>
            ) : (
              <Box textAlign="center" py={4}>
                <TranscribeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  No transcription available
                </Typography>
                <Typography color="textSecondary">
                  Record the meeting to generate automatic transcription
                </Typography>
              </Box>
            )}
          </TabPanel>

          <TabPanel value={currentTab} index={4}>
            {selectedMeeting.aiSummary ? (
              <Box>
                <Box display="flex" alignItems="center" mb={2}>
                  <AIIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">AI-Generated Summary</Typography>
                  <Chip
                    label={`Effectiveness: ${selectedMeeting.aiSummary.effectiveness}/10`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Key Points</Typography>
                      <List dense>
                        {selectedMeeting.aiSummary.keyPoints.map((point, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={point} />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Main Decisions</Typography>
                      <List dense>
                        {selectedMeeting.aiSummary.mainDecisions.map((decision, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={decision} />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Next Steps</Typography>
                      <List dense>
                        {selectedMeeting.aiSummary.nextSteps.map((step, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={step} />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Box textAlign="center" py={4}>
                <AIIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  No AI summary available
                </Typography>
                <Typography color="textSecondary">
                  Complete the meeting recording to generate AI insights
                </Typography>
              </Box>
            )}
          </TabPanel>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
          <Button variant="contained" startIcon={<DownloadIcon />}>
            Export PDF
          </Button>
          <Button variant="contained" startIcon={<ShareIcon />}>
            Share
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Meeting Minutes Management
        </Typography>

        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }}>
          <Tab label="All Meetings" />
          <Tab label="Action Items" />
          <Tab label="Analytics" />
          <Tab label="Templates" />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          {renderMeetingsList()}
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          {renderActionItems()}
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          {renderAnalytics()}
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          {renderTemplates()}
        </TabPanel>

        {renderMeetingDetail()}

        {/* Recording Indicator */}
        {isRecording && (
          <Fab
            color="error"
            sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              animation: 'pulse 1s infinite'
            }}
          >
            <MicIcon />
          </Fab>
        )}

        {/* Loading Overlay */}
        {loading && (
          <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
            <LinearProgress />
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default MeetingMinutesManagement;
