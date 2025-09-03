'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Person as PersonIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
  ResponsiveContainer,
  ScatterChart,
  Scatter
} from 'recharts';
import { schedulingApi } from '../services/SchedulingApiService';

interface AnalyticsDashboardProps {
  dateRange?: {
    start: string;
    end: string;
  };
}

interface PerformanceMetrics {
  resourceUtilization: number;
  taskCompletionRate: number;
  averageOptimizationScore: number;
  onTimePerformance: number;
  costEfficiency: number;
  customerSatisfaction: number;
}

interface ResourcePerformance {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  utilization: number;
  efficiency: number;
  tasksCompleted: number;
  averageTaskDuration: number;
  performanceScore: number;
  trend: 'up' | 'down' | 'stable';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  dateRange = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  }
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [resourcePerformance, setResourcePerformance] = useState<ResourcePerformance[]>([]);
  const [utilizationData, setUtilizationData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange, selectedPeriod]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch data from API
      const [utilizationResponse, performanceResponse] = await Promise.all([
        schedulingApi.getResourceUtilization(dateRange.start, dateRange.end),
        schedulingApi.getPerformanceMetrics(dateRange.start, dateRange.end)
      ]);

      // Mock data for demonstration (replace with actual API responses)
      setMetrics({
        resourceUtilization: 85.3,
        taskCompletionRate: 94.7,
        averageOptimizationScore: 89.2,
        onTimePerformance: 91.5,
        costEfficiency: 87.8,
        customerSatisfaction: 92.1
      });

      setResourcePerformance([
        {
          resourceId: 'tech-001',
          resourceName: 'John Smith',
          resourceType: 'Technician',
          utilization: 88.5,
          efficiency: 92.3,
          tasksCompleted: 47,
          averageTaskDuration: 125,
          performanceScore: 90.4,
          trend: 'up'
        },
        {
          resourceId: 'tech-002',
          resourceName: 'Sarah Johnson',
          resourceType: 'Technician',
          utilization: 82.1,
          efficiency: 89.7,
          tasksCompleted: 39,
          averageTaskDuration: 110,
          performanceScore: 85.9,
          trend: 'stable'
        },
        {
          resourceId: 'tech-003',
          resourceName: 'Mike Davis',
          resourceType: 'Senior Technician',
          utilization: 91.2,
          efficiency: 95.8,
          tasksCompleted: 52,
          averageTaskDuration: 98,
          performanceScore: 93.5,
          trend: 'up'
        },
        {
          resourceId: 'tech-004',
          resourceName: 'Emily Chen',
          resourceType: 'Specialist',
          utilization: 79.3,
          efficiency: 87.2,
          tasksCompleted: 35,
          averageTaskDuration: 140,
          performanceScore: 83.3,
          trend: 'down'
        },
        {
          resourceId: 'tech-005',
          resourceName: 'Robert Wilson',
          resourceType: 'Technician',
          utilization: 85.7,
          efficiency: 91.4,
          tasksCompleted: 44,
          averageTaskDuration: 115,
          performanceScore: 88.6,
          trend: 'up'
        }
      ]);

      setUtilizationData([
        { name: 'Mon', utilization: 82, efficiency: 88, tasks: 15 },
        { name: 'Tue', utilization: 85, efficiency: 91, tasks: 18 },
        { name: 'Wed', utilization: 89, efficiency: 93, tasks: 22 },
        { name: 'Thu', utilization: 91, efficiency: 89, tasks: 20 },
        { name: 'Fri', utilization: 87, efficiency: 92, tasks: 19 },
        { name: 'Sat', utilization: 75, efficiency: 85, tasks: 12 },
        { name: 'Sun', utilization: 68, efficiency: 82, tasks: 10 }
      ]);

      setTrendData([
        { date: '2024-01', score: 78.5, cost: 15200, satisfaction: 87.2 },
        { date: '2024-02', score: 81.2, cost: 14800, satisfaction: 89.1 },
        { date: '2024-03', score: 84.7, cost: 14200, satisfaction: 90.5 },
        { date: '2024-04', score: 87.1, cost: 13900, satisfaction: 91.8 },
        { date: '2024-05', score: 89.2, cost: 13500, satisfaction: 92.1 }
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    // Create CSV data
    const csvData = [
      ['Resource ID', 'Name', 'Type', 'Utilization %', 'Efficiency %', 'Tasks Completed', 'Performance Score'],
      ...resourcePerformance.map(resource => [
        resource.resourceId,
        resource.resourceName,
        resource.resourceType,
        resource.utilization.toFixed(1),
        resource.efficiency.toFixed(1),
        resource.tasksCompleted.toString(),
        resource.performanceScore.toFixed(1)
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${dateRange.start}-to-${dateRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return '#4caf50';
    if (score >= 80) return '#ff9800';
    if (score >= 70) return '#2196f3';
    return '#f44336';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon sx={{ color: '#4caf50' }} />;
      case 'down':
        return <TrendingDownIcon sx={{ color: '#f44336' }} />;
      default:
        return <span style={{ color: '#9e9e9e' }}>—</span>;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <div>Loading analytics data...</div>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Performance Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              label="Period"
            >
              <MenuItem value="1d">Last 24h</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 3 months</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportData}
            size="small"
          >
            Export
          </Button>
          <IconButton onClick={fetchAnalyticsData} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Key Metrics */}
      {metrics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {metrics.resourceUtilization.toFixed(1)}%
                </Typography>
                <Typography variant="body2">Resource Utilization</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {metrics.taskCompletionRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2">Task Completion</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {metrics.averageOptimizationScore.toFixed(1)}
                </Typography>
                <Typography variant="body2">Avg Optimization</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {metrics.onTimePerformance.toFixed(1)}%
                </Typography>
                <Typography variant="body2">On-Time Performance</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary.main">
                  {metrics.costEfficiency.toFixed(1)}%
                </Typography>
                <Typography variant="body2">Cost Efficiency</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {metrics.customerSatisfaction.toFixed(1)}%
                </Typography>
                <Typography variant="body2">Customer Satisfaction</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Utilization Trends */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Weekly Resource Utilization</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Area type="monotone" dataKey="utilization" stackId="1" stroke="#8884d8" fill="#8884d8" name="Utilization %" />
                <Area type="monotone" dataKey="efficiency" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Efficiency %" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Resource Type Distribution */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Resource Distribution</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Technicians', value: 3, fill: COLORS[0] },
                    { name: 'Senior Techs', value: 1, fill: COLORS[1] },
                    { name: 'Specialists', value: 1, fill: COLORS[2] }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    { name: 'Technicians', value: 3, fill: COLORS[0] },
                    { name: 'Senior Techs', value: 1, fill: COLORS[1] },
                    { name: 'Specialists', value: 1, fill: COLORS[2] }
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

        {/* Performance Trends */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Historical Performance Trends</Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <RechartsTooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={2} name="Optimization Score" />
                <Line yAxisId="left" type="monotone" dataKey="satisfaction" stroke="#82ca9d" strokeWidth={2} name="Customer Satisfaction" />
                <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#ffc658" strokeWidth={2} name="Cost ($)" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Resource Performance Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Resource Performance Matrix</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Resource</TableCell>
                    <TableCell align="center">Type</TableCell>
                    <TableCell align="center">Utilization</TableCell>
                    <TableCell align="center">Efficiency</TableCell>
                    <TableCell align="center">Tasks Completed</TableCell>
                    <TableCell align="center">Avg Duration</TableCell>
                    <TableCell align="center">Performance Score</TableCell>
                    <TableCell align="center">Trend</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resourcePerformance.map((resource) => (
                    <TableRow key={resource.resourceId}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon />
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {resource.resourceName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {resource.resourceId}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={resource.resourceType}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={resource.utilization}
                            sx={{ width: 80 }}
                            color={resource.utilization > 85 ? 'success' : resource.utilization > 70 ? 'warning' : 'error'}
                          />
                          <Typography variant="body2">{resource.utilization.toFixed(1)}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={resource.efficiency}
                            sx={{ width: 80 }}
                            color="success"
                          />
                          <Typography variant="body2">{resource.efficiency.toFixed(1)}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="bold">
                          {resource.tasksCompleted}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {resource.averageTaskDuration} min
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{ color: getPerformanceColor(resource.performanceScore) }}
                          >
                            {resource.performanceScore.toFixed(1)}
                          </Typography>
                          <Box sx={{ display: 'flex' }}>
                            {Array.from({ length: 5 }, (_, index) => (
                              <StarIcon
                                key={index}
                                sx={{
                                  color: index < Math.round(resource.performanceScore / 20) ? '#ffd700' : '#e0e0e0',
                                  fontSize: 16
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {getTrendIcon(resource.trend)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsDashboard;
