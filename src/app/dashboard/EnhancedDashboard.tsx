import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Avatar,
  Button,
  LinearProgress,
  Paper,
  Fab,
  Badge,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import InteractiveMap from './InteractiveMap';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  LocationOn as LocationIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Notifications as NotificationsIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Map as MapIcon,
  Chat as ChatIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

// Mock data - replace with real API calls
const mockData = {
  attendance: {
    checkedIn: 23,
    total: 30,
    percentage: 77,
    anomalies: 2
  },
  visits: {
    scheduled: 45,
    completed: 32,
    pending: 13,
    completionRate: 71
  },
  expenses: {
    pending: 8,
    thisMonth: 12450,
    lastMonth: 11200
  },
  performance: [
    { name: 'Mon', visits: 12, distance: 45 },
    { name: 'Tue', visits: 15, distance: 52 },
    { name: 'Wed', visits: 8, distance: 38 },
    { name: 'Thu', visits: 18, distance: 65 },
    { name: 'Fri', visits: 14, distance: 48 },
    { name: 'Sat', visits: 10, distance: 32 },
    { name: 'Sun', visits: 6, distance: 25 },
  ],
  activitiesFeed: [
    { id: 1, type: 'checkin', user: 'John Smith', location: 'Downtown Office', time: '5 min ago', avatar: '/avatars/john.jpg' },
    { id: 2, type: 'visit', user: 'Sarah Wilson', location: 'Client Site A', time: '12 min ago', avatar: '/avatars/sarah.jpg' },
    { id: 3, type: 'expense', user: 'Mike Johnson', amount: '$250', time: '25 min ago', avatar: '/avatars/mike.jpg' },
    { id: 4, type: 'ticket', user: 'Lisa Chen', issue: 'Equipment malfunction', time: '1 hour ago', avatar: '/avatars/lisa.jpg' },
  ],
  liveMap: {
    activeStaff: 18,
    locations: [
      { id: 1, name: 'John Smith', lat: 40.7128, lng: -74.0060, status: 'active' },
      { id: 2, name: 'Sarah Wilson', lat: 40.7589, lng: -73.9851, status: 'transit' },
      { id: 3, name: 'Mike Johnson', lat: 40.6892, lng: -74.0445, status: 'break' },
    ]
  }
};

// Theme colors
const colors = {
  primary: '#1976d2',
  secondary: '#f50057',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  grey: '#9e9e9e',
  background: '#f8f9fa',
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
};

const EnhancedDashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userName] = useState('Alex Johnson'); // Replace with actual user data
  const [notifications] = useState(5); // Replace with actual notification count

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
    trend?: number;
    action?: () => void;
  }> = ({ title, value, subtitle, icon, color, trend, action }) => (
    <Card
      sx={{
        height: '100%',
        cursor: action ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        '&:hover': action ? {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        } : {},
        borderLeft: `4px solid ${color}`,
      }}
      onClick={action}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <TrendingUpIcon
                  sx={{
                    fontSize: 16,
                    color: trend > 0 ? colors.success : colors.error,
                    mr: 0.5
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: trend > 0 ? colors.success : colors.error,
                    fontWeight: 'medium'
                  }}
                >
                  {trend > 0 ? '+' : ''}{trend}% from last week
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color, opacity: 0.7 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const QuickActionButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    color: string;
    onClick: () => void;
  }> = ({ icon, label, color, onClick }) => (
    <Tooltip title={label}>
      <Button
        variant="contained"
        sx={{
          minWidth: 'auto',
          width: 60,
          height: 60,
          borderRadius: 2,
          backgroundColor: color,
          '&:hover': {
            backgroundColor: color,
            transform: 'scale(1.05)',
          },
          transition: 'all 0.2s ease',
          mr: 1,
          mb: 1,
        }}
        onClick={onClick}
      >
        {icon}
      </Button>
    </Tooltip>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3, backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Welcome Header */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: colors.gradient,
          color: 'white',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            {getGreeting()}, {userName}! 🌟
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Here's today's field mission overview
          </Typography>
          <Typography variant="body1" sx={{ mt: 1, opacity: 0.8 }}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Typography>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            right: -20,
            top: -20,
            width: 150,
            height: 150,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        />
      </Paper>

      <Grid container spacing={3}>
        {/* Key Metrics Row */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Team Attendance"
            value={`${mockData.attendance.checkedIn}/${mockData.attendance.total}`}
            subtitle={`${mockData.attendance.percentage}% checked in`}
            icon={<PeopleIcon sx={{ fontSize: 40 }} />}
            color={colors.primary}
            trend={5}
            action={() => console.log('Navigate to attendance')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Visits Today"
            value={`${mockData.visits.completed}/${mockData.visits.scheduled}`}
            subtitle={`${mockData.visits.completionRate}% completion rate`}
            icon={<LocationIcon sx={{ fontSize: 40 }} />}
            color={colors.success}
            trend={12}
            action={() => console.log('Navigate to visits')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Expenses"
            value={mockData.expenses.pending}
            subtitle={`$${mockData.expenses.thisMonth.toLocaleString()} this month`}
            icon={<MoneyIcon sx={{ fontSize: 40 }} />}
            color={colors.warning}
            trend={-3}
            action={() => console.log('Navigate to expenses')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Issues"
            value="3"
            subtitle="2 high priority"
            icon={<WarningIcon sx={{ fontSize: 40 }} />}
            color={colors.error}
            action={() => console.log('Navigate to tickets')}
          />
        </Grid>

        {/* Live Field Map */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: 400, borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Live Field Map
                </Typography>
                <Chip
                  label={`${mockData.liveMap.activeStaff} active`}
                  color="success"
                  size="small"
                  icon={<LocationIcon />}
                />
              </Box>
              <Box
                sx={{
                  height: 300,
                  backgroundColor: '#e3f2fd',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <Typography variant="h6" color="textSecondary">
                  Interactive Map Placeholder
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ position: 'absolute', bottom: 16 }}>
                  Real-time staff locations • Geofence boundaries • Route optimization
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: 400, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <QuickActionButton
                  icon={<AddIcon />}
                  label="Add Visit"
                  color={colors.primary}
                  onClick={() => console.log('Add visit')}
                />
                <QuickActionButton
                  icon={<MoneyIcon />}
                  label="Log Expense"
                  color={colors.success}
                  onClick={() => console.log('Log expense')}
                />
                <QuickActionButton
                  icon={<ScheduleIcon />}
                  label="Request Leave"
                  color={colors.warning}
                  onClick={() => console.log('Request leave')}
                />
                <QuickActionButton
                  icon={<ChatIcon />}
                  label="Team Chat"
                  color={colors.secondary}
                  onClick={() => console.log('Open chat')}
                />
                <QuickActionButton
                  icon={<AssignmentIcon />}
                  label="Create Ticket"
                  color={colors.error}
                  onClick={() => console.log('Create ticket')}
                />
                <QuickActionButton
                  icon={<MapIcon />}
                  label="Check Location"
                  color={colors.info}
                  onClick={() => console.log('Check location')}
                />
              </Box>

              {/* Recent Notifications */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Recent Notifications
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ backgroundColor: colors.warning, width: 32, height: 32 }}>
                        <WarningIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="Equipment maintenance due"
                      secondary="Site A - Generator check"
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ backgroundColor: colors.success, width: 32, height: 32 }}>
                        <CheckCircleIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="Visit completed"
                      secondary="John Smith - Client X"
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Trends */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Performance Trends
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={mockData.performance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    stackId="1"
                    stroke={colors.primary}
                    fill={colors.primary}
                    fillOpacity={0.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="distance"
                    stackId="2"
                    stroke={colors.secondary}
                    fill={colors.secondary}
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Feed */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Activity Feed
              </Typography>
              <List>
                {mockData.activitiesFeed.map((activity) => (
                  <ListItem key={activity.id} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar
                        src={activity.avatar}
                        sx={{ width: 36, height: 36 }}
                      >
                        {activity.user.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={activity.user}
                      secondary={
                        activity.type === 'checkin' ? `Checked in at ${activity.location}` :
                        activity.type === 'visit' ? `Visiting ${activity.location}` :
                        activity.type === 'expense' ? `Submitted expense ${activity.amount}` :
                        `Created ticket: ${activity.issue}`
                      }
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    <ListItemSecondaryAction>
                      <Typography variant="caption" color="textSecondary">
                        {activity.time}
                      </Typography>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Floating Action Button for Chat */}
      <Badge badgeContent={3} color="error">
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: colors.gradient,
          }}
          onClick={() => console.log('Open team chat')}
        >
          <ChatIcon />
        </Fab>
      </Badge>
    </Box>
  );
};

export default EnhancedDashboard;
