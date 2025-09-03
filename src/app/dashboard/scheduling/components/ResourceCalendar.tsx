'use client';

import React, { useState, useCallback } from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Menu,
  Button
} from '@mui/material';
import {
  ViewModule as ViewModuleIcon,
  ViewWeek as ViewWeekIcon,
  ViewDay as ViewDayIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Today as TodayIcon
} from '@mui/icons-material';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import { ScheduledTask } from '../types/ScheduledTask';
import { WorkOrder } from '../types/WorkOrder';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

interface ResourceCalendarProps {
  scheduledTasks: ScheduledTask[];
  workOrders: WorkOrder[];
  onTaskSelect?: (task: ScheduledTask) => void;
  onTimeSlotSelect?: (slotInfo: any) => void;
  onTaskDrop?: (info: any) => void;
  loading?: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: string;
  task: ScheduledTask;
  workOrder: WorkOrder;
  style?: {
    backgroundColor: string;
    borderColor: string;
    color: string;
  };
}

const ResourceCalendar: React.FC<ResourceCalendarProps> = ({
  scheduledTasks,
  workOrders,
  onTaskSelect,
  onTimeSlotSelect,
  onTaskDrop,
  loading = false
}) => {
  const [currentView, setCurrentView] = useState<View>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Transform scheduled tasks into calendar events
  const calendarEvents: CalendarEvent[] = scheduledTasks
    .filter(task => {
      if (selectedResources.length > 0) {
        return task.assignedResources.some(resource => 
          selectedResources.includes(resource.resourceId)
        );
      }
      if (selectedStatuses.length > 0) {
        return selectedStatuses.includes(task.status);
      }
      return true;
    })
    .map(task => {
      const workOrder = workOrders.find(wo => wo.id === task.workOrderId);
      return {
        id: task.id,
        title: workOrder?.title || 'Unknown Task',
        start: new Date(task.scheduledStart),
        end: new Date(task.scheduledEnd),
        resource: task.assignedResources[0]?.resourceId || 'Unassigned',
        task,
        workOrder: workOrder!,
        style: getEventStyle(task, workOrder)
      };
    });

  // Get unique resources for filtering
  const availableResources = Array.from(
    new Set(
      scheduledTasks.flatMap(task => 
        task.assignedResources.map(resource => resource.resourceId)
      )
    )
  );

  const statusOptions = ['scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled'];

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const handleNavigate = (date: Date) => {
    setCurrentDate(date);
  };

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    if (onTaskSelect) {
      onTaskSelect(event.task);
    }
  }, [onTaskSelect]);

  const handleSelectSlot = useCallback((slotInfo: any) => {
    if (onTimeSlotSelect) {
      onTimeSlotSelect(slotInfo);
    }
  }, [onTimeSlotSelect]);

  const handleEventDrop = useCallback((info: any) => {
    if (onTaskDrop) {
      onTaskDrop(info);
    }
  }, [onTaskDrop]);

  const handleExportCalendar = () => {
    // Create ICS file content
    const icsContent = generateICSContent(calendarEvents);
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${moment(currentDate).format('YYYY-MM-DD')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const eventPropGetter = (event: CalendarEvent) => {
    return {
      style: event.style || {
        backgroundColor: '#1976d2',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  const dayPropGetter = (date: Date) => {
    const isToday = moment(date).isSame(moment(), 'day');
    const isWeekend = moment(date).day() === 0 || moment(date).day() === 6;
    
    return {
      style: {
        backgroundColor: isToday ? '#e3f2fd' : isWeekend ? '#f5f5f5' : 'white'
      }
    };
  };

  const slotPropGetter = (date: Date) => {
    const hour = moment(date).hour();
    const isBusinessHours = hour >= 8 && hour < 18;
    
    return {
      style: {
        backgroundColor: isBusinessHours ? 'white' : '#f8f9fa'
      }
    };
  };

  return (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Calendar Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h6">
          Resource Schedule
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* View Toggle */}
          <ToggleButtonGroup
            value={currentView}
            exclusive
            onChange={(_, newView) => newView && handleViewChange(newView)}
            size="small"
          >
            <ToggleButton value="day">
              <Tooltip title="Day View">
                <ViewDayIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="week">
              <Tooltip title="Week View">
                <ViewWeekIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="month">
              <Tooltip title="Month View">
                <ViewModuleIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Today Button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<TodayIcon />}
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>

          {/* Filter Button */}
          <IconButton
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            color={selectedResources.length > 0 || selectedStatuses.length > 0 ? 'primary' : 'default'}
          >
            <FilterIcon />
          </IconButton>

          {/* Export Button */}
          <Tooltip title="Export Calendar">
            <IconButton onClick={handleExportCalendar} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>

          {/* Refresh Button */}
          <Tooltip title="Refresh">
            <IconButton size="small" disabled={loading}>
              <RefreshIcon className={loading ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Active Filters */}
      {(selectedResources.length > 0 || selectedStatuses.length > 0) && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {selectedResources.map(resource => (
            <Chip
              key={resource}
              label={`Resource: ${resource}`}
              onDelete={() => setSelectedResources(prev => 
                prev.filter(r => r !== resource)
              )}
              color="primary"
              variant="outlined"
              size="small"
            />
          ))}
          {selectedStatuses.map(status => (
            <Chip
              key={status}
              label={`Status: ${status}`}
              onDelete={() => setSelectedStatuses(prev => 
                prev.filter(s => s !== status)
              )}
              color="secondary"
              variant="outlined"
              size="small"
            />
          ))}
        </Box>
      )}

      {/* Calendar Component */}
      <Box sx={{ flexGrow: 1, minHeight: 500 }}>
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          view={currentView}
          onView={handleViewChange}
          date={currentDate}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          resizable
          draggableAccessor={() => true}
          onEventDrop={handleEventDrop}
          eventPropGetter={eventPropGetter}
          dayPropGetter={dayPropGetter}
          slotPropGetter={slotPropGetter}
          popup
          popupOffset={{ x: 30, y: 20 }}
          showMultiDayTimes
          step={15}
          timeslots={4}
          min={new Date(2024, 0, 1, 6, 0)} // 6 AM
          max={new Date(2024, 0, 1, 22, 0)} // 10 PM
          formats={{
            timeGutterFormat: 'HH:mm',
            eventTimeRangeFormat: ({ start, end }) => 
              `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
            agendaTimeFormat: 'HH:mm',
            agendaTimeRangeFormat: ({ start, end }) => 
              `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
          }}
          messages={{
            today: 'Today',
            previous: 'Previous',
            next: 'Next',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            agenda: 'Agenda',
            date: 'Date',
            time: 'Time',
            event: 'Task',
            noEventsInRange: 'No scheduled tasks in this time range',
            showMore: (count) => `+ ${count} more tasks`
          }}
          components={{
            event: ({ event }) => (
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                  {event.title}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                  {event.resource}
                </Typography>
              </Box>
            ),
            toolbar: ({ label, onNavigate, onView }) => (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2,
                p: 1,
                backgroundColor: '#f5f5f5',
                borderRadius: 1
              }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => onNavigate('PREV')}>‹</Button>
                  <Button size="small" onClick={() => onNavigate('TODAY')}>Today</Button>
                  <Button size="small" onClick={() => onNavigate('NEXT')}>›</Button>
                </Box>
                <Typography variant="h6">{label}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant={currentView === 'month' ? 'contained' : 'outlined'}
                    onClick={() => onView('month')}
                  >
                    Month
                  </Button>
                  <Button 
                    size="small" 
                    variant={currentView === 'week' ? 'contained' : 'outlined'}
                    onClick={() => onView('week')}
                  >
                    Week
                  </Button>
                  <Button 
                    size="small" 
                    variant={currentView === 'day' ? 'contained' : 'outlined'}
                    onClick={() => onView('day')}
                  >
                    Day
                  </Button>
                </Box>
              </Box>
            )
          }}
          style={{ height: '100%' }}
        />
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={() => setFilterAnchor(null)}
        PaperProps={{
          sx: { minWidth: 300, p: 2 }
        }}
      >
        <Typography variant="h6" gutterBottom>Filters</Typography>
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Resources</InputLabel>
          <Select
            multiple
            value={selectedResources}
            onChange={(e) => setSelectedResources(e.target.value as string[])}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
          >
            {availableResources.map((resource) => (
              <MenuItem key={resource} value={resource}>
                {resource}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            multiple
            value={selectedStatuses}
            onChange={(e) => setSelectedStatuses(e.target.value as string[])}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
          >
            {statusOptions.map((status) => (
              <MenuItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button 
            size="small" 
            onClick={() => {
              setSelectedResources([]);
              setSelectedStatuses([]);
            }}
          >
            Clear All
          </Button>
          <Button 
            size="small" 
            variant="contained"
            onClick={() => setFilterAnchor(null)}
          >
            Apply
          </Button>
        </Box>
      </Menu>
    </Paper>
  );
};

// Helper functions
function getEventStyle(task: ScheduledTask, workOrder?: WorkOrder) {
  const statusColors = {
    scheduled: '#1976d2',
    in_progress: '#ed6c02',
    completed: '#2e7d32',
    cancelled: '#d32f2f',
    rescheduled: '#9c27b0'
  };

  const priorityColors = {
    low: '#4caf50',
    medium: '#2196f3',
    high: '#ff9800',
    critical: '#ff5722',
    emergency: '#f44336'
  };

  const baseColor = statusColors[task.status] || '#1976d2';
  const priorityColor = workOrder ? priorityColors[workOrder.priority] : baseColor;

  return {
    backgroundColor: baseColor,
    borderColor: priorityColor,
    borderWidth: '2px',
    borderStyle: 'solid',
    color: 'white',
    borderRadius: '4px',
    opacity: task.status === 'cancelled' ? 0.5 : 0.9
  };
}

function generateICSContent(events: CalendarEvent[]): string {
  const formatDate = (date: Date) => 
    moment(date).utc().format('YYYYMMDDTHHmmss') + 'Z';

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FieldSync//Schedule Calendar//EN',
    'CALSCALE:GREGORIAN'
  ];

  events.forEach(event => {
    ics.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@fieldsync.com`,
      `DTSTART:${formatDate(event.start)}`,
      `DTEND:${formatDate(event.end)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:Resource: ${event.resource}\\nStatus: ${event.task.status}`,
      `LOCATION:${event.workOrder.location.address}`,
      `STATUS:${event.task.status.toUpperCase()}`,
      'END:VEVENT'
    );
  });

  ics.push('END:VCALENDAR');
  
  return ics.join('\r\n');
}

export default ResourceCalendar;
