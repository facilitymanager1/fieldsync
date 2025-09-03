'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  FormGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Grid,
  Alert,
  Snackbar,
  Tab,
  Tabs,
  Avatar,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    department: string;
    role: string;
    timezone: string;
    language: string;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
    ticketUpdates: boolean;
    shiftReminders: boolean;
    leaveApprovals: boolean;
    systemMaintenance: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    primaryColor: string;
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
    showAnimations: boolean;
  };
  privacy: {
    locationSharing: boolean;
    profileVisibility: 'public' | 'team' | 'private';
    activityTracking: boolean;
    dataRetention: number; // days
  };
  integrations: {
    googleCalendar: boolean;
    microsoftOutlook: boolean;
    slack: boolean;
    teams: boolean;
  };
}

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@fieldsync.com',
      phone: '+1 (555) 123-4567',
      department: 'Field Operations',
      role: 'Field Technician',
      timezone: 'America/New_York',
      language: 'en-US',
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      ticketUpdates: true,
      shiftReminders: true,
      leaveApprovals: true,
      systemMaintenance: false,
    },
    appearance: {
      theme: 'light',
      primaryColor: '#1976d2',
      fontSize: 'medium',
      compactMode: false,
      showAnimations: true,
    },
    privacy: {
      locationSharing: true,
      profileVisibility: 'team',
      activityTracking: true,
      dataRetention: 90,
    },
    integrations: {
      googleCalendar: false,
      microsoftOutlook: false,
      slack: false,
      teams: false,
    },
  });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load settings from API
  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(prev => ({ ...prev, ...data.data }));
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSettingChange = (section: keyof UserSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      
      if (data.success) {
        setSnackbar({
          open: true,
          message: 'Settings saved successfully!',
          severity: 'success',
        });
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save settings. Please try again.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      profile: settings.profile, // Keep profile data
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        ticketUpdates: true,
        shiftReminders: true,
        leaveApprovals: true,
        systemMaintenance: false,
      },
      appearance: {
        theme: 'light',
        primaryColor: '#1976d2',
        fontSize: 'medium',
        compactMode: false,
        showAnimations: true,
      },
      privacy: {
        locationSharing: true,
        profileVisibility: 'team',
        activityTracking: true,
        dataRetention: 90,
      },
      integrations: {
        googleCalendar: false,
        microsoftOutlook: false,
        slack: false,
        teams: false,
      },
    });
    setSnackbar({
      open: true,
      message: 'Settings reset to defaults',
      severity: 'success',
    });
  };

  const TabPanel: React.FC<{ children: React.ReactNode; value: number; index: number }> = ({ children, value, index }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Account Settings
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage your profile, preferences, and system configuration
        </Typography>
      </Box>

      <Card>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<PersonIcon />} label="Profile" />
            <Tab icon={<NotificationsIcon />} label="Notifications" />
            <Tab icon={<PaletteIcon />} label="Appearance" />
            <Tab icon={<SecurityIcon />} label="Privacy & Security" />
            <Tab icon={<StorageIcon />} label="Integrations" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Profile Tab */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Avatar
                    sx={{ width: 120, height: 120, mx: 'auto', mb: 2, fontSize: '3rem' }}
                  >
                    {settings.profile.firstName.charAt(0)}{settings.profile.lastName.charAt(0)}
                  </Avatar>
                  <Button variant="outlined" startIcon={<EditIcon />}>
                    Change Photo
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      value={settings.profile.firstName}
                      onChange={(e) => handleSettingChange('profile', 'firstName', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      value={settings.profile.lastName}
                      onChange={(e) => handleSettingChange('profile', 'lastName', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={settings.profile.email}
                      onChange={(e) => handleSettingChange('profile', 'email', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={settings.profile.phone}
                      onChange={(e) => handleSettingChange('profile', 'phone', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Department"
                      value={settings.profile.department}
                      onChange={(e) => handleSettingChange('profile', 'department', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Timezone</InputLabel>
                      <Select
                        value={settings.profile.timezone}
                        onChange={(e) => handleSettingChange('profile', 'timezone', e.target.value)}
                      >
                        <MenuItem value="America/New_York">Eastern Time</MenuItem>
                        <MenuItem value="America/Chicago">Central Time</MenuItem>
                        <MenuItem value="America/Denver">Mountain Time</MenuItem>
                        <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                        <MenuItem value="UTC">UTC</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={settings.profile.language}
                        onChange={(e) => handleSettingChange('profile', 'language', e.target.value)}
                      >
                        <MenuItem value="en-US">English (US)</MenuItem>
                        <MenuItem value="en-GB">English (UK)</MenuItem>
                        <MenuItem value="es-ES">Spanish</MenuItem>
                        <MenuItem value="fr-FR">French</MenuItem>
                        <MenuItem value="de-DE">German</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Delivery Methods
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.emailNotifications}
                        onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                      />
                    }
                    label="Email Notifications"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.pushNotifications}
                        onChange={(e) => handleSettingChange('notifications', 'pushNotifications', e.target.checked)}
                      />
                    }
                    label="Push Notifications"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.smsNotifications}
                        onChange={(e) => handleSettingChange('notifications', 'smsNotifications', e.target.checked)}
                      />
                    }
                    label="SMS Notifications"
                  />
                </FormGroup>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Notification Types
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.ticketUpdates}
                        onChange={(e) => handleSettingChange('notifications', 'ticketUpdates', e.target.checked)}
                      />
                    }
                    label="Ticket Updates"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.shiftReminders}
                        onChange={(e) => handleSettingChange('notifications', 'shiftReminders', e.target.checked)}
                      />
                    }
                    label="Shift Reminders"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.leaveApprovals}
                        onChange={(e) => handleSettingChange('notifications', 'leaveApprovals', e.target.checked)}
                      />
                    }
                    label="Leave Approvals"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.systemMaintenance}
                        onChange={(e) => handleSettingChange('notifications', 'systemMaintenance', e.target.checked)}
                      />
                    }
                    label="System Maintenance"
                  />
                </FormGroup>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Appearance Tab */}
          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    value={settings.appearance.theme}
                    onChange={(e) => handleSettingChange('appearance', 'theme', e.target.value)}
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="auto">Auto (System)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Font Size</InputLabel>
                  <Select
                    value={settings.appearance.fontSize}
                    onChange={(e) => handleSettingChange('appearance', 'fontSize', e.target.value)}
                  >
                    <MenuItem value="small">Small</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="large">Large</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Primary Color"
                  type="color"
                  value={settings.appearance.primaryColor}
                  onChange={(e) => handleSettingChange('appearance', 'primaryColor', e.target.value)}
                  sx={{ mb: 3 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.appearance.compactMode}
                        onChange={(e) => handleSettingChange('appearance', 'compactMode', e.target.checked)}
                      />
                    }
                    label="Compact Mode"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.appearance.showAnimations}
                        onChange={(e) => handleSettingChange('appearance', 'showAnimations', e.target.checked)}
                      />
                    }
                    label="Show Animations"
                  />
                </FormGroup>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Privacy & Security Tab */}
          <TabPanel value={activeTab} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Privacy Settings
                </Typography>
                <FormGroup sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.privacy.locationSharing}
                        onChange={(e) => handleSettingChange('privacy', 'locationSharing', e.target.checked)}
                      />
                    }
                    label="Location Sharing"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.privacy.activityTracking}
                        onChange={(e) => handleSettingChange('privacy', 'activityTracking', e.target.checked)}
                      />
                    }
                    label="Activity Tracking"
                  />
                </FormGroup>

                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Profile Visibility</InputLabel>
                  <Select
                    value={settings.privacy.profileVisibility}
                    onChange={(e) => handleSettingChange('privacy', 'profileVisibility', e.target.value)}
                  >
                    <MenuItem value="public">Public</MenuItem>
                    <MenuItem value="team">Team Only</MenuItem>
                    <MenuItem value="private">Private</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Data Retention (days)"
                  type="number"
                  value={settings.privacy.dataRetention}
                  onChange={(e) => handleSettingChange('privacy', 'dataRetention', parseInt(e.target.value))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Security
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{ mb: 2 }}
                  onClick={() => setPasswordDialog(true)}
                >
                  Change Password
                </Button>
                <Button variant="outlined" fullWidth sx={{ mb: 2 }}>
                  Enable Two-Factor Authentication
                </Button>
                <Button variant="outlined" fullWidth sx={{ mb: 2 }}>
                  Download Data
                </Button>
                <Button variant="outlined" color="error" fullWidth>
                  Delete Account
                </Button>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Integrations Tab */}
          <TabPanel value={activeTab} index={4}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Connected Services
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Google Calendar"
                  secondary="Sync your shifts and meetings"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.integrations.googleCalendar}
                    onChange={(e) => handleSettingChange('integrations', 'googleCalendar', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Microsoft Outlook"
                  secondary="Sync with Outlook calendar"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.integrations.microsoftOutlook}
                    onChange={(e) => handleSettingChange('integrations', 'microsoftOutlook', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Slack"
                  secondary="Receive notifications in Slack"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.integrations.slack}
                    onChange={(e) => handleSettingChange('integrations', 'slack', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Microsoft Teams"
                  secondary="Teams integration for communication"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.integrations.teams}
                    onChange={(e) => handleSettingChange('integrations', 'teams', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </TabPanel>

          {/* Action Buttons */}
          <Divider sx={{ my: 3 }} />
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={resetToDefaults}>
              Reset to Defaults
            </Button>
            <Button
              variant="contained"
              onClick={saveSettings}
              disabled={loading}
              startIcon={loading ? undefined : <CheckIcon />}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Current Password"
            type="password"
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="New Password"
            type="password"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Confirm New Password"
            type="password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialog(false)}>Cancel</Button>
          <Button variant="contained">Change Password</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SettingsPage;