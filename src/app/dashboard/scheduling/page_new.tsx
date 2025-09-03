'use client';

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  LinearProgress
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  AutoAwesome as OptimizeIcon,
  Analytics as AnalyticsIcon,
  Work as WorkIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Import extracted components
import WorkOrderForm from './components/WorkOrderForm';
import OptimizationPanel from './components/OptimizationPanel';
import ResourceCalendar from './components/ResourceCalendar';

// Import hooks
import { useWorkOrders } from './hooks/useWorkOrders';
import { useScheduledTasks } from './hooks/useScheduledTasks';
import { useOptimization } from './hooks/useOptimization';

// Import types
import { CreateWorkOrderPayload } from './types/WorkOrder';
import { OptimizationParameters } from './types/OptimizationResult';

const AdvancedSchedulingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [workOrderDialog, setWorkOrderDialog] = useState(false);
  const [optimizationDialog, setOptimizationDialog] = useState(false);

  // Use custom hooks for data management
  const {
    workOrders,
    loading: workOrdersLoading,
    error: workOrdersError,
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    selectedWorkOrder,
    selectWorkOrder
  } = useWorkOrders();

  const {
    scheduledTasks,
    loading: tasksLoading,
    error: tasksError,
    scheduleTask,
    updateScheduledTask,
    deleteScheduledTask
  } = useScheduledTasks();

  const {
    optimizationResults,
    optimizationStatus,
    loading: optimizationLoading,
    error: optimizationError,
    optimizeSchedule,
    applyOptimization,
    cancelOptimization
  } = useOptimization();

  const handleCreateWorkOrder = async (workOrderData: CreateWorkOrderPayload) => {
    try {
      await createWorkOrder(workOrderData);
      setWorkOrderDialog(false);
    } catch (error) {
      console.error('Failed to create work order:', error);
    }
  };

  const handleOptimizeSchedule = async (parameters: OptimizationParameters) => {
    try {
      await optimizeSchedule(workOrders, parameters);
      setOptimizationDialog(false);
    } catch (error) {
      console.error('Failed to optimize schedule:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return '#f44336';
      case 'critical': return '#ff5722';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'emergency':
      case 'critical':
        return <ErrorIcon sx={{ color: getPriorityColor(priority) }} />;
      case 'high':
        return <WarningIcon sx={{ color: getPriorityColor(priority) }} />;
      default:
        return <CheckCircleIcon sx={{ color: getPriorityColor(priority) }} />;
    }
  };

  const renderWorkOrdersTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Work Orders Management</Typography>
        <Button
          variant="contained"
          startIcon={<WorkIcon />}
          onClick={() => setWorkOrderDialog(true)}
        >
          Create Work Order
        </Button>
      </Box>

      {workOrdersError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {workOrdersError}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Pending Work Orders</Typography>
            {workOrdersLoading ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Priority</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Skills Required</TableCell>
                      <TableCell>Deadline</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workOrders.filter(wo => wo.status === 'pending').map((workOrder) => (
                      <TableRow key={workOrder.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getPriorityIcon(workOrder.priority)}
                            <Chip
                              label={workOrder.priority.toUpperCase()}
                              size="small"
                              sx={{ 
                                backgroundColor: getPriorityColor(workOrder.priority),
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2">{workOrder.title}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {workOrder.description}
                          </Typography>
                        </TableCell>
                        <TableCell>{workOrder.estimatedDuration} min</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {workOrder.requiredSkills.map((skill) => (
                              <Chip key={skill} label={skill} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {workOrder.deadline ? (
                            <Typography variant="body2">
                              {new Date(workOrder.deadline).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="textSecondary">No deadline</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => selectWorkOrder(workOrder)}>
                            <ScheduleIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Work Order Statistics</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card sx={{ textAlign: 'center', backgroundColor: '#f3e5f5' }}>
                  <CardContent>
                    <Typography variant="h3" color="primary">
                      {workOrders.filter(wo => wo.status === 'pending').length}
                    </Typography>
                    <Typography variant="body2">Pending</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card sx={{ textAlign: 'center', backgroundColor: '#e8f5e8' }}>
                  <CardContent>
                    <Typography variant="h3" color="success.main">
                      {workOrders.filter(wo => wo.status === 'scheduled').length}
                    </Typography>
                    <Typography variant="body2">Scheduled</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Priority Distribution</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Critical', value: workOrders.filter(wo => wo.priority === 'critical').length, fill: '#f44336' },
                    { name: 'High', value: workOrders.filter(wo => wo.priority === 'high').length, fill: '#ff9800' },
                    { name: 'Medium', value: workOrders.filter(wo => wo.priority === 'medium').length, fill: '#2196f3' },
                    { name: 'Low', value: workOrders.filter(wo => wo.priority === 'low').length, fill: '#4caf50' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    { name: 'Critical', value: workOrders.filter(wo => wo.priority === 'critical').length, fill: '#f44336' },
                    { name: 'High', value: workOrders.filter(wo => wo.priority === 'high').length, fill: '#ff9800' },
                    { name: 'Medium', value: workOrders.filter(wo => wo.priority === 'medium').length, fill: '#2196f3' },
                    { name: 'Low', value: workOrders.filter(wo => wo.priority === 'low').length, fill: '#4caf50' }
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderOptimizationTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Schedule Optimization</Typography>
        <Button
          variant="contained"
          startIcon={<OptimizeIcon />}
          onClick={() => setOptimizationDialog(true)}
          disabled={optimizationLoading}
        >
          Optimize Schedule
        </Button>
      </Box>

      {optimizationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {optimizationError}
        </Alert>
      )}

      {optimizationStatus && (
        <Card sx={{ mb: 3, backgroundColor: optimizationStatus.status === 'running' ? '#e3f2fd' : '#f5f5f5' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Optimization Status: {optimizationStatus.status.toUpperCase()}
            </Typography>
            {optimizationStatus.status === 'running' && (
              <>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {optimizationStatus.progress.currentPhase}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={optimizationStatus.progress.percentage}
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption">
                  {optimizationStatus.progress.percentage.toFixed(1)}% Complete
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {optimizationResults && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Optimization Results</Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Card sx={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                    <CardContent>
                      <Typography variant="h4" color="primary">
                        {optimizationResults.optimization.results.finalScore.toFixed(1)}
                      </Typography>
                      <Typography variant="body2">Optimization Score</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ textAlign: 'center', backgroundColor: '#e8f5e8' }}>
                    <CardContent>
                      <Typography variant="h4" color="success.main">
                        {optimizationResults.optimization.results.improvementPercentage.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2">Improvement</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ textAlign: 'center', backgroundColor: '#fff3e0' }}>
                    <CardContent>
                      <Typography variant="h4" color="warning.main">
                        {optimizationResults.optimization.results.scheduledTasks}
                      </Typography>
                      <Typography variant="body2">Tasks Scheduled</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ textAlign: 'center', backgroundColor: '#fce4ec' }}>
                    <CardContent>
                      <Typography variant="h4" color="error.main">
                        {optimizationResults.optimization.results.unscheduledTasks}
                      </Typography>
                      <Typography variant="body2">Unscheduled</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );

  const renderCalendarTab = () => (
    <Box>
      <Typography variant="h5" gutterBottom>Schedule Calendar</Typography>
      {tasksError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {tasksError}
        </Alert>
      )}
      <ResourceCalendar
        scheduledTasks={scheduledTasks}
        workOrders={workOrders}
        loading={tasksLoading}
        onTaskSelect={(task) => console.log('Selected task:', task)}
        onTimeSlotSelect={(slot) => console.log('Selected slot:', slot)}
        onTaskDrop={(info) => console.log('Task dropped:', info)}
      />
    </Box>
  );

  const renderAnalyticsTab = () => (
    <Box>
      <Typography variant="h5" gutterBottom>Analytics & Performance</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Task Status Distribution</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { status: 'Scheduled', count: scheduledTasks.filter(t => t.status === 'scheduled').length },
                { status: 'In Progress', count: scheduledTasks.filter(t => t.status === 'in_progress').length },
                { status: 'Completed', count: scheduledTasks.filter(t => t.status === 'completed').length },
                { status: 'Cancelled', count: scheduledTasks.filter(t => t.status === 'cancelled').length }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Optimization Trends</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[
                { date: 'Mon', score: 78 },
                { date: 'Tue', score: 82 },
                { date: 'Wed', score: 85 },
                { date: 'Thu', score: 89 },
                { date: 'Fri', score: 92 },
                { date: 'Sat', score: 88 },
                { date: 'Sun', score: 91 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Line type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ScheduleIcon sx={{ fontSize: 40 }} />
        Advanced Scheduling & Resource Optimization
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Work Orders" icon={<WorkIcon />} />
          <Tab label="Optimization" icon={<OptimizeIcon />} />
          <Tab label="Calendar" icon={<ScheduleIcon />} />
          <Tab label="Analytics" icon={<AnalyticsIcon />} />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && renderWorkOrdersTab()}
          {activeTab === 1 && renderOptimizationTab()}
          {activeTab === 2 && renderCalendarTab()}
          {activeTab === 3 && renderAnalyticsTab()}
        </Box>
      </Paper>

      {/* Work Order Form Dialog */}
      <WorkOrderForm
        open={workOrderDialog}
        onClose={() => setWorkOrderDialog(false)}
        onSubmit={handleCreateWorkOrder}
        mode="create"
      />

      {/* Optimization Panel Dialog */}
      <OptimizationPanel
        open={optimizationDialog}
        onClose={() => setOptimizationDialog(false)}
        onStartOptimization={handleOptimizeSchedule}
        onStopOptimization={() => cancelOptimization(optimizationStatus?.id || '')}
        optimizationStatus={optimizationStatus}
        optimizationResults={optimizationResults}
        loading={optimizationLoading}
      />
    </Box>
  );
};

export default AdvancedSchedulingDashboard;
