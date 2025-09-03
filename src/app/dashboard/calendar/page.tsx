/**
 * Enhanced Calendar Integration Dashboard Component
 * Full-featured calendar with external sync and scheduling
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
  Divider,
  Switch,
  FormControlLabel,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
  Sync as SyncIcon,
  Share as ShareIcon,
  GetApp as ExportIcon,
  Settings as SettingsIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Analytics as AnalyticsIcon,
  Warning as ConflictIcon,
  Google as GoogleIcon,
  Microsoft as MicrosoftIcon,
  CalendarToday,
} from '@mui/icons-material';
import {
  DatePicker,
  TimePicker,
  DateTimePicker,
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees: any[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  source: 'internal' | 'google' | 'outlook' | 'exchange';
}

interface CalendarProvider {
  id: string;
  name: string;
  type: 'google' | 'outlook' | 'exchange';
  syncEnabled: boolean;
  lastSync: Date;
}

interface Conflict {
  id: string;
  eventId1: string;
  eventId2: string;
  conflictType: 'overlap' | 'resource' | 'location';
  severity: 'minor' | 'major' | 'critical';
}

export default function EnhancedCalendarPage() {
  const [currentView, setCurrentView] = useState('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [providers, setProviders] = useState<CalendarProvider[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);

  // Form states
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startTime: new Date(),
    endTime: new Date(),
    location: '',
    attendees: '',
  });

  const [providerForm, setProviderForm] = useState({
    name: '',
    type: 'google',
    credentials: {},
  });

  const [meetingRequest, setMeetingRequest] = useState({
    title: '',
    duration: 60,
    requiredAttendees: '',
    preferredTimes: [new Date()],
    priority: 'medium',
  });

  const [analytics, setAnalytics] = useState<any>({});

  useEffect(() => {
    loadCalendarData();
  }, [selectedDate]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      // Load events, providers, and conflicts
      await Promise.all([
        loadEvents(),
        loadProviders(),
        loadConflicts(),
      ]);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    // Simulate API call
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Team Meeting',
        startTime: new Date(2025, 1, 3, 10, 0),
        endTime: new Date(2025, 1, 3, 11, 0),
        location: 'Conference Room A',
        attendees: [],
        status: 'confirmed',
        source: 'internal',
      },
      {
        id: '2',
        title: 'Client Presentation',
        startTime: new Date(2025, 1, 3, 14, 0),
        endTime: new Date(2025, 1, 3, 15, 30),
        location: 'Virtual',
        attendees: [],
        status: 'confirmed',
        source: 'google',
      },
    ];
    setEvents(mockEvents);
  };

  const loadProviders = async () => {
    const mockProviders: CalendarProvider[] = [
      {
        id: '1',
        name: 'Google Calendar',
        type: 'google',
        syncEnabled: true,
        lastSync: new Date(),
      },
      {
        id: '2',
        name: 'Outlook Calendar',
        type: 'outlook',
        syncEnabled: false,
        lastSync: new Date(Date.now() - 86400000),
      },
    ];
    setProviders(mockProviders);
  };

  const loadConflicts = async () => {
    const mockConflicts: Conflict[] = [
      {
        id: '1',
        eventId1: '1',
        eventId2: '2',
        conflictType: 'overlap',
        severity: 'minor',
      },
    ];
    setConflicts(mockConflicts);
  };

  const handleCreateEvent = async () => {
    try {
      setLoading(true);
      
      const newEvent = {
        ...eventForm,
        attendees: eventForm.attendees.split(',').map(email => ({ 
          email: email.trim(),
          status: 'pending' 
        })),
      };

      // API call to create event
      console.log('Creating event:', newEvent);
      
      await loadEvents();
      setEventDialogOpen(false);
      resetEventForm();
    } catch (error) {
      console.error('Failed to create event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCalendars = async () => {
    try {
      setLoading(true);
      
      // API call to sync calendars
      console.log('Syncing calendars...');
      
      await loadCalendarData();
    } catch (error) {
      console.error('Failed to sync calendars:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestMeetingTimes = async () => {
    try {
      setLoading(true);
      
      const suggestions = {
        ...meetingRequest,
        requiredAttendees: meetingRequest.requiredAttendees.split(',').map(id => id.trim()),
      };

      // API call to suggest meeting times
      console.log('Suggesting meeting times:', suggestions);
      
    } catch (error) {
      console.error('Failed to suggest meeting times:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCalendar = async (format: 'ical' | 'csv' | 'json') => {
    try {
      setLoading(true);
      
      // API call to export calendar
      console.log('Exporting calendar as:', format);
      
    } catch (error) {
      console.error('Failed to export calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetEventForm = () => {
    setEventForm({
      title: '',
      description: '',
      startTime: new Date(),
      endTime: new Date(),
      location: '',
      attendees: '',
    });
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'google': return <GoogleIcon />;
      case 'outlook': return <MicrosoftIcon />;
      default: return <CalendarIcon />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'major': return 'warning';
      case 'minor': return 'info';
      default: return 'default';
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarIcon /> Enhanced Calendar
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setEventDialogOpen(true)}
            >
              New Event
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleSyncCalendars}
              disabled={loading}
            >
              Sync
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => setMeetingDialogOpen(true)}
            >
              Find Time
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setProviderDialogOpen(true)}
            >
              Providers
            </Button>
          </Box>
        </Box>

        {/* Navigation Tabs */}
        <Tabs value={currentView} onChange={(e, v) => setCurrentView(v)} sx={{ mb: 3 }}>
          <Tab value="calendar" label="Calendar" icon={<CalendarIcon />} />
          <Tab value="events" label="Events" icon={<EventIcon />} />
          <Tab value="conflicts" label="Conflicts" icon={<ConflictIcon />} />
          <Tab value="analytics" label="Analytics" icon={<AnalyticsIcon />} />
        </Tabs>

        {/* Calendar View */}
        {currentView === 'calendar' && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Calendar View
                  </Typography>
                  
                  <DatePicker
                    label="Select Date"
                    value={selectedDate}
                    onChange={(date) => setSelectedDate(date || new Date())}
                    sx={{ mb: 2 }}
                  />
                  
                  {/* Simple calendar grid */}
                  <Box sx={{ mt: 2 }}>
                    {events.map((event) => (
                      <Card key={event.id} sx={{ mb: 1, p: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="subtitle2">{event.title}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              {event.startTime.toLocaleTimeString()} - {event.endTime.toLocaleTimeString()}
                            </Typography>
                            {event.location && (
                              <Typography variant="caption" color="textSecondary">
                                📍 {event.location}
                              </Typography>
                            )}
                          </Box>
                          <Chip
                            label={event.source}
                            size="small"
                            color={event.source === 'internal' ? 'primary' : 'secondary'}
                          />
                        </Box>
                      </Card>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Actions
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<ExportIcon />}
                      onClick={() => handleExportCalendar('ical')}
                      fullWidth
                    >
                      Export as iCal
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<ExportIcon />}
                      onClick={() => handleExportCalendar('csv')}
                      fullWidth
                    >
                      Export as CSV
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<ShareIcon />}
                      fullWidth
                    >
                      Share Calendar
                    </Button>
                  </Box>
                </CardContent>
              </Card>
              
              {/* Calendar Providers */}
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Calendar Providers
                  </Typography>
                  
                  <List>
                    {providers.map((provider) => (
                      <ListItem key={provider.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getProviderIcon(provider.type)}
                          <Box>
                            <Typography variant="body2">{provider.name}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              Last sync: {provider.lastSync.toLocaleDateString()}
                            </Typography>
                          </Box>
                          <Switch checked={provider.syncEnabled} size="small" />
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Events View */}
        {currentView === 'events' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                All Events
              </Typography>
              
              <List>
                {events.map((event) => (
                  <ListItem key={event.id}>
                    <ListItemText
                      primary={event.title}
                      secondary={`${event.startTime.toLocaleString()} - ${event.location || 'No location'}`}
                    />
                    <Chip
                      label={event.status}
                      size="small"
                      color={event.status === 'confirmed' ? 'success' : 'warning'}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Conflicts View */}
        {currentView === 'conflicts' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Schedule Conflicts
              </Typography>
              
              {conflicts.length === 0 ? (
                <Alert severity="success">No conflicts detected</Alert>
              ) : (
                <List>
                  {conflicts.map((conflict) => (
                    <ListItem key={conflict.id}>
                      <ListItemText
                        primary={`${conflict.conflictType} conflict`}
                        secondary="Two events overlap in time"
                      />
                      <Chip
                        label={conflict.severity}
                        size="small"
                        color={getSeverityColor(conflict.severity)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
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
                    Meeting Statistics
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">Total Events: {events.length}</Typography>
                    <Typography variant="body2">This Week: 12</Typography>
                    <Typography variant="body2">Average Duration: 45 mins</Typography>
                    <Typography variant="body2">Busiest Day: Tuesday</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Calendar Health
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">Sync Status: ✅ All synced</Typography>
                    <Typography variant="body2">Conflicts: {conflicts.length}</Typography>
                    <Typography variant="body2">Utilization: 65%</Typography>
                    <Typography variant="body2">Free Time: 35%</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Create Event Dialog */}
        <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Event Title"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                fullWidth
                required
              />
              
              <TextField
                label="Description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <DateTimePicker
                  label="Start Time"
                  value={eventForm.startTime}
                  onChange={(date) => setEventForm({ ...eventForm, startTime: date || new Date() })}
                  sx={{ flex: 1 }}
                />
                
                <DateTimePicker
                  label="End Time"
                  value={eventForm.endTime}
                  onChange={(date) => setEventForm({ ...eventForm, endTime: date || new Date() })}
                  sx={{ flex: 1 }}
                />
              </Box>
              
              <TextField
                label="Location"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                fullWidth
              />
              
              <TextField
                label="Attendees (comma-separated emails)"
                value={eventForm.attendees}
                onChange={(e) => setEventForm({ ...eventForm, attendees: e.target.value })}
                fullWidth
                helperText="Enter email addresses separated by commas"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEventDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} variant="contained" disabled={loading}>
              Create Event
            </Button>
          </DialogActions>
        </Dialog>

        {/* Meeting Time Suggestion Dialog */}
        <Dialog open={meetingDialogOpen} onClose={() => setMeetingDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Find Meeting Time</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Meeting Title"
                value={meetingRequest.title}
                onChange={(e) => setMeetingRequest({ ...meetingRequest, title: e.target.value })}
                fullWidth
                required
              />
              
              <TextField
                label="Duration (minutes)"
                type="number"
                value={meetingRequest.duration}
                onChange={(e) => setMeetingRequest({ ...meetingRequest, duration: parseInt(e.target.value) })}
                fullWidth
              />
              
              <TextField
                label="Required Attendees (comma-separated IDs)"
                value={meetingRequest.requiredAttendees}
                onChange={(e) => setMeetingRequest({ ...meetingRequest, requiredAttendees: e.target.value })}
                fullWidth
              />
              
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={meetingRequest.priority}
                  onChange={(e) => setMeetingRequest({ ...meetingRequest, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMeetingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSuggestMeetingTimes} variant="contained" disabled={loading}>
              Find Times
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
