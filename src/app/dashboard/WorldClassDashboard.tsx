'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Button,
  Paper,
  Fab,
  Badge,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Container,
  Stack,
} from '@mui/material';
import {
  People as PeopleIcon,
  LocationOn as LocationIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Map as MapIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import InteractiveMap from './InteractiveMap';

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
  activitiesFeed: [
    { id: 1, type: 'checkin', user: 'John Smith', location: 'Downtown Office', time: '5 min ago' },
    { id: 2, type: 'visit', user: 'Sarah Wilson', location: 'Client Site A', time: '12 min ago' },
    { id: 3, type: 'expense', user: 'Mike Johnson', amount: '$250', time: '25 min ago' },
    { id: 4, type: 'ticket', user: 'Lisa Chen', issue: 'Equipment malfunction', time: '1 hour ago' },
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
        height: 180,
        cursor: action ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        '&:hover': action ? {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        } : {},
        borderLeft: `4px solid ${color}`,
        borderRadius: 2,
      }}
      onClick={action}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color, mb: 1 }}>
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
          minWidth: 60,
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
    <Container maxWidth="xl" sx={{ py: 4, backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Welcome Header */}
      <Paper
        sx={{
          p: 4,
          mb: 4,
          background: colors.gradient,
          color: 'white',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
            {getGreeting()}, {userName}! 🌟
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9, mb: 1 }}>
            Here's today's field mission overview
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.8 }}>
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

      {/* Key Metrics Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
        <StatCard
          title="Team Attendance"
          value={`${mockData.attendance.checkedIn}/${mockData.attendance.total}`}
          subtitle={`${mockData.attendance.percentage}% checked in`}
          icon={<PeopleIcon sx={{ fontSize: 40 }} />}
          color={colors.primary}
          trend={5}
          action={() => console.log('Navigate to attendance')}
        />
        
        <StatCard
          title="Visits Today"
          value={`${mockData.visits.completed}/${mockData.visits.scheduled}`}
          subtitle={`${mockData.visits.completionRate}% completion rate`}
          icon={<LocationIcon sx={{ fontSize: 40 }} />}
          color={colors.success}
          trend={12}
          action={() => console.log('Navigate to visits')}
        />
        
        <StatCard
          title="Pending Expenses"
          value={mockData.expenses.pending}
          subtitle={`$${mockData.expenses.thisMonth.toLocaleString()} this month`}
          icon={<MoneyIcon sx={{ fontSize: 40 }} />}
          color={colors.warning}
          trend={-3}
          action={() => console.log('Navigate to expenses')}
        />
        
        <StatCard
          title="Active Issues"
          value="3"
          subtitle="2 high priority"
          icon={<WarningIcon sx={{ fontSize: 40 }} />}
          color={colors.error}
          action={() => console.log('Navigate to tickets')}
        />
      </Box>

      {/* Main Content Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3, mb: 4 }}>
        {/* Live Field Map */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Live Field Map
              </Typography>
              <Chip
                label={`${mockData.liveMap.activeStaff} active`}
                color="success"
                size="medium"
                icon={<LocationIcon />}
              />
            </Box>
            <Box
              sx={{
                height: 350,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <InteractiveMap 
                height={350}
                onStaffClick={(staff) => {
                  console.log('Staff clicked:', staff);
                  // You can add custom actions here, like opening a detail modal
                }}
                showControls={true}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Quick Actions & Notifications */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}>
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
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Recent Notifications
            </Typography>
            <List dense>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ backgroundColor: colors.warning, width: 36, height: 36 }}>
                    <WarningIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="Equipment maintenance due"
                  secondary="Site A - Generator check"
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ backgroundColor: colors.success, width: 36, height: 36 }}>
                    <CheckCircleIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="Visit completed"
                  secondary="John Smith - Client X"
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Bottom Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
        {/* Performance Chart Placeholder */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
              Performance Trends
            </Typography>
            <Box
              sx={{
                height: 250,
                backgroundColor: '#f5f5f5',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 60, color: colors.primary, mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  Performance Analytics
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Weekly visits • Distance traveled • KPI trends
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
              Activity Feed
            </Typography>
            <List>
              {mockData.activitiesFeed.map((activity) => (
                <ListItem key={activity.id} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 40, height: 40, backgroundColor: colors.primary }}>
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
      </Box>

      {/* Floating Action Button for Team Chat */}
      <Badge badgeContent={3} color="error">
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: colors.gradient,
            '&:hover': {
              background: colors.gradient,
              transform: 'scale(1.1)',
            },
            transition: 'all 0.3s ease',
          }}
          onClick={() => console.log('Open team chat')}
        >
          <ChatIcon />
        </Fab>
      </Badge>
    </Container>
  );
};

export default EnhancedDashboard;
