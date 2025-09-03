'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  LinearProgress,
  CircularProgress,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { OptimizationParameters, OptimizationStatus, OptimizationResult } from '../types/OptimizationResult';

interface OptimizationPanelProps {
  open: boolean;
  onClose: () => void;
  onStartOptimization: (parameters: OptimizationParameters) => Promise<void>;
  onStopOptimization: () => Promise<void>;
  optimizationStatus: OptimizationStatus | null;
  optimizationResults: OptimizationResult | null;
  loading: boolean;
}

const ALGORITHM_OPTIONS = [
  {
    value: 'hybrid',
    label: 'Hybrid (Recommended)',
    description: 'Combines multiple algorithms for optimal results',
    complexity: 'Medium',
    performance: 'Excellent'
  },
  {
    value: 'genetic',
    label: 'Genetic Algorithm',
    description: 'Evolutionary approach for complex optimization',
    complexity: 'High',
    performance: 'Very Good'
  },
  {
    value: 'greedy',
    label: 'Greedy Algorithm',
    description: 'Fast but may not find global optimum',
    complexity: 'Low',
    performance: 'Good'
  },
  {
    value: 'simulated_annealing',
    label: 'Simulated Annealing',
    description: 'Good balance between quality and speed',
    complexity: 'Medium',
    performance: 'Very Good'
  },
  {
    value: 'linear_programming',
    label: 'Linear Programming',
    description: 'Mathematical optimization for linear constraints',
    complexity: 'Medium',
    performance: 'Good'
  }
];

const OBJECTIVE_TYPES = [
  { type: 'minimize_travel_time', label: 'Minimize Travel Time', icon: '🚗', category: 'efficiency' },
  { type: 'maximize_utilization', label: 'Maximize Resource Utilization', icon: '👥', category: 'resources' },
  { type: 'minimize_cost', label: 'Minimize Total Cost', icon: '💰', category: 'cost' },
  { type: 'maximize_customer_satisfaction', label: 'Maximize Customer Satisfaction', icon: '😊', category: 'quality' },
  { type: 'minimize_overtime', label: 'Minimize Overtime', icon: '⏰', category: 'efficiency' },
  { type: 'balance_workload', label: 'Balance Workload', icon: '⚖️', category: 'resources' }
];

const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  open,
  onClose,
  onStartOptimization,
  onStopOptimization,
  optimizationStatus,
  optimizationResults,
  loading
}) => {
  const [parameters, setParameters] = useState<OptimizationParameters>({
    objectives: [
      { type: 'minimize_travel_time', weight: 0.3, priority: 8 },
      { type: 'maximize_utilization', weight: 0.3, priority: 7 },
      { type: 'minimize_cost', weight: 0.2, priority: 6 },
      { type: 'maximize_customer_satisfaction', weight: 0.2, priority: 9 }
    ],
    constraints: {
      timeWindows: {
        start: '08:00',
        end: '18:00'
      },
      resourceAvailability: true,
      skillRequirements: true,
      locationConstraints: true,
      workOrderDependencies: true,
      maxTravelTime: 60,
      maxOvertimePerResource: 120,
      minBreakTime: 15
    },
    algorithmSettings: {
      maxIterations: 1000,
      populationSize: 50,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      temperature: 1000,
      coolingRate: 0.95,
      tolerance: 0.001,
      timeLimit: 300
    },
    preferences: {
      preferEarlyStart: true,
      preferResourceContinuity: true,
      minimizeResourceSwitching: true,
      respectBreakTimes: true,
      allowOvertime: false,
      prioritizeDeadlines: true
    }
  });

  const [selectedAlgorithm, setSelectedAlgorithm] = useState<'genetic' | 'greedy' | 'simulated_annealing' | 'linear_programming' | 'hybrid'>('hybrid');

  const handleObjectiveWeightChange = (index: number, weight: number) => {
    const newObjectives = [...parameters.objectives];
    newObjectives[index].weight = weight / 100;
    setParameters(prev => ({
      ...prev,
      objectives: newObjectives
    }));
  };

  const handleConstraintChange = (constraint: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        [constraint]: value
      }
    }));
  };

  const handlePreferenceChange = (preference: string, value: boolean) => {
    setParameters(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value
      }
    }));
  };

  const handleAlgorithmSettingChange = (setting: string, value: number) => {
    setParameters(prev => ({
      ...prev,
      algorithmSettings: {
        ...prev.algorithmSettings,
        [setting]: value
      }
    }));
  };

  const handleStartOptimization = async () => {
    await onStartOptimization(parameters);
  };

  const isOptimizing = optimizationStatus?.status === 'running' || optimizationStatus?.status === 'initializing';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon />
            <Typography variant="h6">Schedule Optimization Configuration</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        {/* Optimization Status */}
        {optimizationStatus && (
          <Card sx={{ mb: 3, backgroundColor: isOptimizing ? '#e3f2fd' : '#f5f5f5' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {isOptimizing ? 'Optimization in Progress' : 'Optimization Status'}
                </Typography>
                {isOptimizing && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={onStopOptimization}
                    size="small"
                  >
                    Stop
                  </Button>
                )}
              </Box>

              {isOptimizing && (
                <>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {optimizationStatus.progress.currentPhase}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={optimizationStatus.progress.percentage}
                    sx={{ mb: 1 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption">
                      {optimizationStatus.progress.percentage.toFixed(1)}% Complete
                    </Typography>
                    <Typography variant="caption">
                      Iteration {optimizationStatus.progress.currentIteration} / {optimizationStatus.progress.totalIterations}
                    </Typography>
                  </Box>
                  {optimizationStatus.progress.currentScore && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Current Score: {optimizationStatus.progress.currentScore.toFixed(1)}
                    </Typography>
                  )}
                </>
              )}

              {optimizationStatus.status === 'completed' && optimizationResults && (
                <Alert severity="success">
                  Optimization completed successfully! Final score: {optimizationResults.optimization.results.finalScore.toFixed(1)}
                </Alert>
              )}

              {optimizationStatus.status === 'failed' && (
                <Alert severity="error">
                  Optimization failed. Please check the parameters and try again.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <Grid container spacing={3}>
          {/* Algorithm Selection */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Algorithm Selection</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Optimization Algorithm</InputLabel>
                  <Select
                    value={selectedAlgorithm}
                    onChange={(e) => setSelectedAlgorithm(e.target.value as any)}
                    label="Optimization Algorithm"
                  >
                    {ALGORITHM_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        <Box>
                          <Typography variant="body1">{option.label}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {option.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Algorithm Details */}
                {ALGORITHM_OPTIONS.find(opt => opt.value === selectedAlgorithm) && (
                  <Card variant="outlined">
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="textSecondary">Complexity</Typography>
                          <Typography variant="body1">
                            {ALGORITHM_OPTIONS.find(opt => opt.value === selectedAlgorithm)?.complexity}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="textSecondary">Expected Performance</Typography>
                          <Typography variant="body1">
                            {ALGORITHM_OPTIONS.find(opt => opt.value === selectedAlgorithm)?.performance}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Optimization Objectives */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Optimization Objectives</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {parameters.objectives.map((objective, index) => {
                    const objectiveInfo = OBJECTIVE_TYPES.find(obj => obj.type === objective.type);
                    return (
                      <Grid item xs={12} md={6} key={objective.type}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography variant="h6" sx={{ mr: 1 }}>
                                {objectiveInfo?.icon}
                              </Typography>
                              <Typography variant="subtitle1">
                                {objectiveInfo?.label}
                              </Typography>
                            </Box>
                            <Typography variant="body2" gutterBottom>
                              Weight: {(objective.weight * 100).toFixed(0)}%
                            </Typography>
                            <Slider
                              value={objective.weight * 100}
                              onChange={(_, value) => handleObjectiveWeightChange(index, value as number)}
                              min={0}
                              max={100}
                              valueLabelDisplay="auto"
                              valueLabelFormat={(value) => `${value}%`}
                              marks={[
                                { value: 0, label: '0%' },
                                { value: 50, label: '50%' },
                                { value: 100, label: '100%' }
                              ]}
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Constraints */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Constraints & Limits</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>Time Constraints</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <FormControl size="small">
                        <InputLabel>Start Time</InputLabel>
                        <Select
                          value={parameters.constraints.timeWindows.start}
                          onChange={(e) => handleConstraintChange('timeWindows', {
                            ...parameters.constraints.timeWindows,
                            start: e.target.value
                          })}
                          label="Start Time"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <MenuItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                              {`${i.toString().padStart(2, '0')}:00`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>End Time</InputLabel>
                        <Select
                          value={parameters.constraints.timeWindows.end}
                          onChange={(e) => handleConstraintChange('timeWindows', {
                            ...parameters.constraints.timeWindows,
                            end: e.target.value
                          })}
                          label="End Time"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <MenuItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                              {`${i.toString().padStart(2, '0')}:00`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>Resource Constraints</Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={parameters.constraints.resourceAvailability}
                          onChange={(e) => handleConstraintChange('resourceAvailability', e.target.checked)}
                        />
                      }
                      label="Respect Resource Availability"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={parameters.constraints.skillRequirements}
                          onChange={(e) => handleConstraintChange('skillRequirements', e.target.checked)}
                        />
                      }
                      label="Enforce Skill Requirements"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Preferences */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Optimization Preferences</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {Object.entries(parameters.preferences).map(([key, value]) => (
                    <Grid item xs={12} md={6} key={key}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={value}
                            onChange={(e) => handlePreferenceChange(key, e.target.checked)}
                          />
                        }
                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={isOptimizing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleStartOptimization}
          disabled={loading || isOptimizing}
          startIcon={isOptimizing ? <CircularProgress size={20} /> : <PlayIcon />}
          sx={{ minWidth: 150 }}
        >
          {isOptimizing ? 'Optimizing...' : 'Start Optimization'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OptimizationPanel;
