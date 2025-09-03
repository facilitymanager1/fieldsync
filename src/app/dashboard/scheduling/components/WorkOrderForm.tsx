'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Grid,
  Typography,
  Autocomplete,
  Alert,
  IconButton,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  LocationOn as LocationIcon,
  AttachFile as AttachFileIcon
} from '@mui/icons-material';
import { WorkOrder, CreateWorkOrderPayload } from '../types/WorkOrder';

interface WorkOrderFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (workOrder: CreateWorkOrderPayload) => Promise<void>;
  workOrder?: WorkOrder; // For editing existing work orders
  mode: 'create' | 'edit';
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#4caf50' },
  { value: 'medium', label: 'Medium', color: '#2196f3' },
  { value: 'high', label: 'High', color: '#ff9800' },
  { value: 'critical', label: 'Critical', color: '#ff5722' },
  { value: 'emergency', label: 'Emergency', color: '#f44336' }
];

const SKILL_OPTIONS = [
  'HVAC', 'Electrical', 'Plumbing', 'Security', 'Cleaning', 'Maintenance',
  'Landscaping', 'IT Support', 'Generator', 'Fire Safety', 'Elevator',
  'Pest Control', 'Glass Repair', 'Painting', 'Carpentry'
];

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  open,
  onClose,
  onSubmit,
  workOrder,
  mode
}) => {
  const [formData, setFormData] = useState<CreateWorkOrderPayload>({
    title: workOrder?.title || '',
    description: workOrder?.description || '',
    priority: workOrder?.priority || 'medium',
    estimatedDuration: workOrder?.estimatedDuration || 60,
    requiredSkills: workOrder?.requiredSkills || [],
    location: workOrder?.location || {
      address: '',
      coordinates: { lat: 0, lng: 0 }
    },
    deadline: workOrder?.deadline?.split('T')[0] || '',
    customerId: workOrder?.customerId || '',
    customerInfo: workOrder?.customerInfo || {
      name: '',
      phone: '',
      email: ''
    },
    notes: workOrder?.notes || '',
    tags: workOrder?.tags || [],
    estimatedCost: workOrder?.estimatedCost || 0
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  const handleInputChange = (field: keyof CreateWorkOrderPayload, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev as any)[parent],
        [field]: value
      }
    }));
  };

  const handleSkillsChange = (event: any, newValue: string[]) => {
    setFormData(prev => ({
      ...prev,
      requiredSkills: newValue
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required');
      }
      if (!formData.location.address.trim()) {
        throw new Error('Location address is required');
      }
      if (formData.requiredSkills.length === 0) {
        throw new Error('At least one required skill must be selected');
      }

      await onSubmit(formData);
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        estimatedDuration: 60,
        requiredSkills: [],
        location: { address: '', coordinates: { lat: 0, lng: 0 } },
        customerInfo: { name: '', phone: '', email: '' },
        notes: '',
        tags: [],
        estimatedCost: 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save work order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {mode === 'create' ? 'Create Work Order' : 'Edit Work Order'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Basic Information</Typography>
          </Grid>

          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              error={!formData.title.trim()}
              helperText={!formData.title.trim() ? 'Title is required' : ''}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth required>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                label="Priority"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: option.color
                        }}
                      />
                      {option.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={3}
              required
              error={!formData.description.trim()}
              helperText={!formData.description.trim() ? 'Description is required' : ''}
            />
          </Grid>

          {/* Duration and Cost */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Estimated Duration (minutes)"
              type="number"
              value={formData.estimatedDuration}
              onChange={(e) => handleInputChange('estimatedDuration', parseInt(e.target.value) || 0)}
              inputProps={{ min: 1 }}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Estimated Cost ($)"
              type="number"
              value={formData.estimatedCost}
              onChange={(e) => handleInputChange('estimatedCost', parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          {/* Skills and Deadline */}
          <Grid item xs={12} md={8}>
            <Autocomplete
              multiple
              options={SKILL_OPTIONS}
              value={formData.requiredSkills}
              onChange={handleSkillsChange}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Required Skills"
                  placeholder="Select skills..."
                  required
                  error={formData.requiredSkills.length === 0}
                  helperText={formData.requiredSkills.length === 0 ? 'At least one skill is required' : ''}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => handleInputChange('deadline', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Location */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Location
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              value={formData.location.address}
              onChange={(e) => handleNestedInputChange('location', 'address', e.target.value)}
              required
              error={!formData.location.address.trim()}
              helperText={!formData.location.address.trim() ? 'Address is required' : ''}
            />
          </Grid>

          {/* Customer Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Customer Information</Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Customer Name"
              value={formData.customerInfo?.name || ''}
              onChange={(e) => handleNestedInputChange('customerInfo', 'name', e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.customerInfo?.phone || ''}
              onChange={(e) => handleNestedInputChange('customerInfo', 'phone', e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.customerInfo?.email || ''}
              onChange={(e) => handleNestedInputChange('customerInfo', 'email', e.target.value)}
            />
          </Grid>

          {/* Tags */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Tags</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
              <TextField
                label="Add Tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                size="small"
              />
              <Button
                variant="outlined"
                onClick={handleAddTag}
                startIcon={<AddIcon />}
                disabled={!newTag.trim()}
              >
                Add
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {formData.tags?.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Additional Notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              multiline
              rows={3}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{ minWidth: 120 }}
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkOrderForm;
