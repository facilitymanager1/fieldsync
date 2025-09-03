"use client";

import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Grid2 from '@mui/material/Grid2';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as TicketIcon,
  Person as PersonIcon,
  Group as TeamIcon,
  Dashboard as DashboardIcon,
  Comment as CommentIcon,
  AttachFile as AttachIcon,
  Star as PriorityIcon,
  Schedule as ScheduleIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Check as ResolveIcon,
  History as HistoryIcon,
  Filter as FilterIcon
} from '@mui/icons-material';
import TicketTable from './TicketTable';
import TicketForm from './TicketForm';
import ProtectedRoute from '../../ProtectedRoute';

interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string;
  assignedTo?: string;
  assignedTeam?: string;
  reportedBy: string;
  reportedDate: Date;
  dueDate?: Date;
  resolvedDate?: Date;
  tags: string[];
  attachments: string[];
  comments: Array<{
    id: string;
    author: string;
    content: string;
    timestamp: Date;
  }>;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  currentWorkload: number;
  avatar?: string;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  specialization: string[];
}

// Tab Panel Component
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
      id={`tickets-tabpanel-${index}`}
      aria-labelledby={`tickets-tab-${index}`}
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
    id: `tickets-tab-${index}`,
    'aria-controls': `tickets-tabpanel-${index}`,
  };
}

// Enhanced Ticket Form Component
interface EnhancedTicketFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (ticketData: any) => void;
  editingTicket?: Ticket | null;
  teams: Team[];
}

const EnhancedTicketForm: React.FC<EnhancedTicketFormProps> = ({
  open,
  onClose,
  onSubmit,
  editingTicket,
  teams
}) => {
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: string;
    category: string;
    assignedTeam: string;
    assignedTo: string;
    dueDate: string;
    tags: string;
    attachments: string[];
  }>({
    title: '',
    description: '',
    priority: 'medium',
    category: '',
    assignedTeam: '',
    assignedTo: '',
    dueDate: '',
    tags: '',
    attachments: []
  });

  const categories = [
    'Technical Issue',
    'Maintenance Request',
    'Safety Concern',
    'Equipment Failure',
    'Software Bug',
    'Network Issue',
    'Access Request',
    'General Inquiry'
  ];

  useEffect(() => {
    if (editingTicket) {
      setFormData({
        title: editingTicket.title,
        description: editingTicket.description,
        priority: editingTicket.priority,
        category: editingTicket.category,
        assignedTeam: editingTicket.assignedTeam || '',
        assignedTo: editingTicket.assignedTo || '',
        dueDate: editingTicket.dueDate ? editingTicket.dueDate.toISOString().split('T')[0] : '',
        tags: editingTicket.tags.join(', '),
        attachments: editingTicket.attachments || []
      });
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        category: '',
        assignedTeam: '',
        assignedTo: '',
        dueDate: '',
        tags: '',
        attachments: []
      });
    }
  }, [editingTicket, open]);

  const selectedTeam = teams.find(team => team.id === formData.assignedTeam);

  const handleSubmit = () => {
    const ticketData = {
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      reportedDate: new Date(),
      reportedBy: 'Current User',
      status: 'open'
    };
    onSubmit(ticketData);
    onClose();
  };

  const isFormValid = formData.title && formData.description && formData.category;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editingTicket ? 'Edit Ticket' : 'Create New Ticket'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Ticket Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                label="Category"
              >
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                label="Priority"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide detailed description of the issue..."
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Assign to Team</InputLabel>
              <Select
                value={formData.assignedTeam}
                onChange={(e) => setFormData({ ...formData, assignedTeam: e.target.value, assignedTo: '' })}
                label="Assign to Team"
              >
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name} ({team.specialization.join(', ')})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={!selectedTeam}>
              <InputLabel>Assign to Member</InputLabel>
              <Select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                label="Assign to Member"
              >
                {selectedTeam?.members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.name} - {member.role} (Workload: {member.currentWorkload}%)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Due Date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="Separate tags with commas"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!isFormValid}
        >
          {editingTicket ? 'Update Ticket' : 'Create Ticket'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Ticket Assignment Component
interface TicketAssignmentProps {
  ticket: Ticket;
  teams: Team[];
  onAssign: (ticketId: string, teamId: string, memberId?: string) => void;
}

const TicketAssignment: React.FC<TicketAssignmentProps> = ({ ticket, teams, onAssign }) => {
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedMember, setSelectedMember] = useState('');

  const handleAssign = () => {
    onAssign(ticket.id, selectedTeam, selectedMember);
    setAssignDialog(false);
    setSelectedTeam('');
    setSelectedMember('');
  };

  const teamData = teams.find(team => team.id === selectedTeam);

  return (
    <>
      <IconButton size="small" onClick={() => setAssignDialog(true)}>
        <PersonIcon />
      </IconButton>

      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Ticket</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Team</InputLabel>
              <Select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value);
                  setSelectedMember('');
                }}
                label="Team"
              >
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name} ({team.specialization.join(', ')})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {teamData && (
              <FormControl fullWidth>
                <InputLabel>Team Member</InputLabel>
                <Select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  label="Team Member"
                >
                  {teamData.members.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24 }}>{member.name[0]}</Avatar>
                        <Box>
                          <Typography variant="body2">{member.name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {member.role} • Workload: {member.currentWorkload}%
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button onClick={handleAssign} variant="contained" disabled={!selectedTeam}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Main Enhanced Tickets Page
const TicketsPage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [ticketDialog, setTicketDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Mock data
  useEffect(() => {
    // Mock teams data
    setTeams([
      {
        id: 'tech-team',
        name: 'Technical Support',
        specialization: ['Software', 'Hardware', 'Network'],
        members: [
          { id: 'tech1', name: 'John Doe', role: 'Senior Tech', skills: ['Software', 'Network'], currentWorkload: 75 },
          { id: 'tech2', name: 'Jane Smith', role: 'Hardware Specialist', skills: ['Hardware'], currentWorkload: 60 },
          { id: 'tech3', name: 'Mike Johnson', role: 'Network Admin', skills: ['Network'], currentWorkload: 40 }
        ]
      },
      {
        id: 'maintenance-team',
        name: 'Maintenance Team',
        specialization: ['Equipment', 'Safety', 'General'],
        members: [
          { id: 'maint1', name: 'Bob Wilson', role: 'Maintenance Lead', skills: ['Equipment', 'Safety'], currentWorkload: 80 },
          { id: 'maint2', name: 'Sarah Davis', role: 'Safety Officer', skills: ['Safety'], currentWorkload: 55 }
        ]
      },
      {
        id: 'facilities-team',
        name: 'Facilities Management',
        specialization: ['HVAC', 'Electrical', 'Plumbing'],
        members: [
          { id: 'fac1', name: 'Tom Brown', role: 'HVAC Technician', skills: ['HVAC'], currentWorkload: 70 },
          { id: 'fac2', name: 'Lisa Green', role: 'Electrician', skills: ['Electrical'], currentWorkload: 45 }
        ]
      }
    ]);

    // Mock tickets data
    setTickets([
      {
        id: '1',
        title: 'Network connectivity issues in Building A',
        description: 'Multiple users reporting intermittent network connectivity issues',
        priority: 'high',
        status: 'open',
        category: 'Network Issue',
        assignedTeam: 'tech-team',
        assignedTo: 'tech3',
        reportedBy: 'Admin User',
        reportedDate: new Date('2025-08-01'),
        dueDate: new Date('2025-08-05'),
        tags: ['network', 'building-a', 'urgent'],
        attachments: [],
        comments: [
          { id: '1', author: 'Mike Johnson', content: 'Investigating the issue', timestamp: new Date() }
        ]
      },
      {
        id: '2',
        title: 'HVAC system malfunction in Conference Room 1',
        description: 'Air conditioning not working properly, temperature too high',
        priority: 'medium',
        status: 'in_progress',
        category: 'Maintenance Request',
        assignedTeam: 'facilities-team',
        assignedTo: 'fac1',
        reportedBy: 'Office Staff',
        reportedDate: new Date('2025-08-02'),
        tags: ['hvac', 'conference-room'],
        attachments: [],
        comments: []
      }
    ]);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleCreateTicket = (ticketData: any) => {
    const newTicket: Ticket = {
      id: Date.now().toString(),
      ...ticketData,
      comments: [],
      attachments: ticketData.attachments || []
    };
    setTickets([newTicket, ...tickets]);
    setRefresh(r => r + 1);
  };

  const handleAssignTicket = (ticketId: string, teamId: string, memberId?: string) => {
    setTickets(prev =>
      prev.map(ticket =>
        ticket.id === ticketId
          ? { ...ticket, assignedTeam: teamId, assignedTo: memberId, status: 'in_progress' }
          : ticket
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'error';
      case 'in_progress': return 'warning';
      case 'resolved': return 'success';
      case 'closed': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const myTicketsCount = tickets.filter(t => t.assignedTo === 'current-user').length;

  return (
    <ProtectedRoute allowed={['Admin', 'Supervisor', 'FieldTech', 'SiteStaff', 'Client']}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Enhanced Ticketing System
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Comprehensive ticket management with team assignment and tracking
          </Typography>
        </Box>

        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={handleTabChange} aria-label="tickets tabs">
              <Tab
                label={
                  <Badge badgeContent={openTicketsCount} color="error">
                    All Tickets
                  </Badge>
                }
                icon={<TicketIcon />}
                iconPosition="start"
                {...a11yProps(0)}
              />
              <Tab
                label={
                  <Badge badgeContent={myTicketsCount} color="primary">
                    My Tickets
                  </Badge>
                }
                icon={<PersonIcon />}
                iconPosition="start"
                {...a11yProps(1)}
              />
              <Tab
                label="Team Dashboard"
                icon={<TeamIcon />}
                iconPosition="start"
                {...a11yProps(2)}
              />
              <Tab
                label="Analytics"
                icon={<DashboardIcon />}
                iconPosition="start"
                {...a11yProps(3)}
              />
            </Tabs>
          </Box>

          <TabPanel value={currentTab} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">All Tickets</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setTicketDialog(true)}
              >
                Create Ticket
              </Button>
            </Box>

            {/* Enhanced Ticket Table */}
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="center">Priority</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell>Assigned To</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>#{ticket.id}</TableCell>
                      <TableCell>
                        <Typography variant="subtitle2">{ticket.title}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          by {ticket.reportedBy} • {ticket.reportedDate.toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={ticket.priority}
                          size="small"
                          sx={{ 
                            backgroundColor: getPriorityColor(ticket.priority),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={ticket.status.replace('_', ' ')}
                          color={getStatusColor(ticket.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {ticket.assignedTo ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              {teams.find(t => t.id === ticket.assignedTeam)?.members.find(m => m.id === ticket.assignedTo)?.name[0]}
                            </Avatar>
                            <Typography variant="body2">
                              {teams.find(t => t.id === ticket.assignedTeam)?.members.find(m => m.id === ticket.assignedTo)?.name}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="textSecondary">Unassigned</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.dueDate ? ticket.dueDate.toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton size="small">
                            <ViewIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => setEditingTicket(ticket)}>
                            <EditIcon />
                          </IconButton>
                          <TicketAssignment
                            ticket={ticket}
                            teams={teams}
                            onAssign={handleAssignTicket}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <Typography variant="h6" gutterBottom>My Assigned Tickets</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Showing tickets assigned to you. Use the team dashboard to see all team assignments.
            </Alert>
            <TicketTable key={refresh} />
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <Typography variant="h6" gutterBottom>Team Dashboard</Typography>
            <Grid container spacing={3}>
              {teams.map((team) => (
                <Grid item xs={12} md={4} key={team.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>{team.name}</Typography>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Specialization: {team.specialization.join(', ')}
                      </Typography>
                      
                      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                        Team Members:
                      </Typography>
                      <List dense>
                        {team.members.map((member) => (
                          <ListItem key={member.id} sx={{ px: 0 }}>
                            <ListItemIcon>
                              <Avatar sx={{ width: 32, height: 32 }}>{member.name[0]}</Avatar>
                            </ListItemIcon>
                            <ListItemText
                              primary={member.name}
                              secondary={
                                <Box>
                                  <Typography variant="caption">{member.role}</Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={member.currentWorkload}
                                    sx={{ mt: 0.5 }}
                                    color={member.currentWorkload > 80 ? 'error' : member.currentWorkload > 60 ? 'warning' : 'success'}
                                  />
                                  <Typography variant="caption">{member.currentWorkload}% workload</Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                      
                      <Typography variant="body2" sx={{ mt: 2 }}>
                        Active Tickets: {tickets.filter(t => t.assignedTeam === team.id && t.status !== 'closed').length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <Typography variant="h6" gutterBottom>Ticket Analytics</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {tickets.filter(t => t.status === 'open').length}
                    </Typography>
                    <Typography variant="body2">Open Tickets</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {tickets.filter(t => t.status === 'in_progress').length}
                    </Typography>
                    <Typography variant="body2">In Progress</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {tickets.filter(t => t.status === 'resolved').length}
                    </Typography>
                    <Typography variant="body2">Resolved</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main">
                      {tickets.length}
                    </Typography>
                    <Typography variant="body2">Total Tickets</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </Paper>

        {/* Enhanced Ticket Form Dialog */}
        <EnhancedTicketForm
          open={ticketDialog || editingTicket !== null}
          onClose={() => {
            setTicketDialog(false);
            setEditingTicket(null);
          }}
          onSubmit={handleCreateTicket}
          editingTicket={editingTicket}
          teams={teams}
        />
      </Container>
    </ProtectedRoute>
  );
};

export default TicketsPage;
