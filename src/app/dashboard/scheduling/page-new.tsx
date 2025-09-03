'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  TrendingUp as OptimizationIcon,
  Assignment as WorkOrderIcon,
  CalendarToday as CalendarIcon,
  Analytics as AnalyticsIcon,
  Monitor as MonitorIcon
} from '@mui/icons-material';

// Import the extracted components
import WorkOrderForm from './components/WorkOrderForm';
import OptimizationPanel from './components/OptimizationPanel';
import ResourceCalendar from './components/ResourceCalendar';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import RealTimeMonitoring from './components/RealTimeMonitoring';

// Import custom hooks
import { useWorkOrders } from './hooks/useWorkOrders';
import { useOptimization } from './hooks/useOptimization';
import { useScheduledTasks } from './hooks/useScheduledTasks';

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
      id={`scheduling-tabpanel-${index}`}
      aria-labelledby={`scheduling-tab-${index}`}
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
    id: `scheduling-tab-${index}`,
    'aria-controls': `scheduling-tabpanel-${index}`,
  };
}

const AdvancedSchedulingDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use custom hooks for data management
  const {
    workOrders,
    loading: workOrdersLoading,
    error: workOrdersError,
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    refetch: refetchWorkOrders
  } = useWorkOrders();

  const {
    optimizationStatus,
    optimizationResults,
    loading: optimizationLoading,
    error: optimizationError,
    startOptimization,
    cancelOptimization
  } = useOptimization();

  const {
    scheduledTasks,
    loading: tasksLoading,
    error: tasksError,
    updateTask,
    refetch: refetchTasks
  } = useScheduledTasks();

  useEffect(() => {
    // Initial data fetch
    setLoading(true);
    Promise.all([
      refetchWorkOrders(),
      refetchTasks()
    ]).finally(() => setLoading(false));
  }, [refetchWorkOrders, refetchTasks]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleWorkOrderSubmit = async (workOrderData: any) => {
    try {
      await createWorkOrder(workOrderData);
      // Optionally switch to calendar view to see the new work order
      setCurrentTab(2);
    } catch (error) {
      console.error('Failed to create work order:', error);
    }
  };

  const handleOptimizationStart = async (config: any) => {
    try {
      await startOptimization(config);
    } catch (error) {
      console.error('Failed to start optimization:', error);
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: any) => {
    try {
      await updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || workOrdersError || optimizationError || tasksError) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || workOrdersError || optimizationError || tasksError}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Advanced Scheduling & Optimization
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Intelligent resource allocation, route optimization, and real-time scheduling management
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="scheduling tabs">
            <Tab
              label="Real-Time Monitor"
              icon={<MonitorIcon />}
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              label="Work Orders"
              icon={<WorkOrderIcon />}
              iconPosition="start"
              {...a11yProps(1)}
            />
            <Tab
              label="Calendar View"
              icon={<CalendarIcon />}
              iconPosition="start"
              {...a11yProps(2)}
            />
            <Tab
              label="Optimization"
              icon={<OptimizationIcon />}
              iconPosition="start"
              {...a11yProps(3)}
            />
            <Tab
              label="Analytics"
              icon={<AnalyticsIcon />}
              iconPosition="start"
              {...a11yProps(4)}
            />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          <RealTimeMonitoring />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <WorkOrderForm
            onSubmit={handleWorkOrderSubmit}
            loading={workOrdersLoading}
            existingWorkOrders={workOrders}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <ResourceCalendar
            workOrders={workOrders}
            scheduledTasks={scheduledTasks}
            onTaskUpdate={handleTaskUpdate}
            loading={tasksLoading}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <OptimizationPanel
            workOrders={workOrders}
            onOptimizationStart={handleOptimizationStart}
            optimizationStatus={optimizationStatus}
            optimizationResults={optimizationResults}
            loading={optimizationLoading}
            onCancel={cancelOptimization}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          <AnalyticsDashboard
            dateRange={{
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            }}
          />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default AdvancedSchedulingDashboard;
