"use client";

import React, { useState, useEffect } from 'react';
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
  Grid,
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
  Switch,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Avatar,
  Divider,
  TreeView,
  TreeItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge
} from '@mui/material';
import {
  Security as SecurityIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Shield as ShieldIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as SupervisorIcon,
  Engineering as TechIcon,
  Business as ClientIcon,
  Assignment as PermissionIcon,
  Visibility as ViewIcon,
  Create as CreateIcon,
  Update as UpdateIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import ProtectedRoute from '../../ProtectedRoute';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  actions: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isActive: boolean;
  lastLogin?: Date;
  avatar?: string;
  department: string;
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  userId: string;
  userName: string;
  timestamp: Date;
  details: any;
  ipAddress: string;
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
      id={`rbac-tabpanel-${index}`}
      aria-labelledby={`rbac-tab-${index}`}
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
    id: `rbac-tab-${index}`,
    'aria-controls': `rbac-tabpanel-${index}`,
  };
}

// Role Management Component
interface RoleManagementProps {
  roles: Role[];
  permissions: Permission[];
  onCreateRole: (roleData: any) => void;
  onUpdateRole: (roleId: string, roleData: any) => void;
  onDeleteRole: (roleId: string) => void;
}

const RoleManagement: React.FC<RoleManagementProps> = ({
  roles,
  permissions,
  onCreateRole,
  onUpdateRole,
  onDeleteRole
}) => {
  const [roleDialog, setRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({
        name: role.name,
        description: role.description,
        permissions: role.permissions
      });
    } else {
      setEditingRole(null);
      setRoleFormData({
        name: '',
        description: '',
        permissions: []
      });
    }
    setRoleDialog(true);
  };

  const handleSaveRole = () => {
    if (editingRole) {
      onUpdateRole(editingRole.id, roleFormData);
    } else {
      onCreateRole(roleFormData);
    }
    setRoleDialog(false);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getRoleIcon = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin': return <AdminIcon />;
      case 'supervisor': return <SupervisorIcon />;
      case 'fieldtech': return <TechIcon />;
      case 'client': return <ClientIcon />;
      default: return <PersonIcon />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">Role Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Role
        </Button>
      </Box>

      <Grid container spacing={3}>
        {roles.map((role) => (
          <Grid item xs={12} md={6} lg={4} key={role.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {getRoleIcon(role.name)}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{role.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {role.description}
                    </Typography>
                  </Box>
                  {role.isSystemRole && (
                    <Chip label="System" size="small" color="primary" />
                  )}
                </Box>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Permissions:</strong> {role.permissions.length}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Users:</strong> {role.userCount}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(role)}
                    disabled={role.isSystemRole}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => onDeleteRole(role.id)}
                    disabled={role.isSystemRole || role.userCount > 0}
                  >
                    Delete
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Role Dialog */}
      <Dialog open={roleDialog} onClose={() => setRoleDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRole ? 'Edit Role' : 'Create New Role'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Role Name"
                value={roleFormData.name}
                onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Permissions</Typography>
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <Accordion key={category}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">{category}</Typography>
                    <Chip
                      label={perms.filter(p => roleFormData.permissions.includes(p.id)).length}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {perms.map((permission) => (
                        <ListItem key={permission.id}>
                          <ListItemIcon>
                            <Checkbox
                              checked={roleFormData.permissions.includes(permission.id)}
                              onChange={() => handlePermissionToggle(permission.id)}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={permission.name}
                            secondary={permission.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveRole} variant="contained">
            {editingRole ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// User Management Component
interface UserManagementProps {
  users: User[];
  roles: Role[];
  onUpdateUserRoles: (userId: string, roles: string[]) => void;
  onToggleUserStatus: (userId: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  roles,
  onUpdateUserRoles,
  onToggleUserStatus
}) => {
  const [userDialog, setUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const handleOpenUserDialog = (user: User) => {
    setSelectedUser(user);
    setUserRoles(user.roles);
    setUserDialog(true);
  };

  const handleSaveUserRoles = () => {
    if (selectedUser) {
      onUpdateUserRoles(selectedUser.id, userRoles);
    }
    setUserDialog(false);
  };

  const handleRoleToggle = (roleId: string) => {
    setUserRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
    );
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>User Management</Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={user.avatar}>{user.name[0]}</Avatar>
                    <Box>
                      <Typography variant="subtitle2">{user.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{user.department}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {user.roles.map((roleId) => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <Chip key={roleId} label={role.name} size="small" />
                      ) : null;
                    })}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.isActive ? 'Active' : 'Inactive'}
                    color={user.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {user.lastLogin ? user.lastLogin.toLocaleDateString() : 'Never'}
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton size="small" onClick={() => handleOpenUserDialog(user)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onToggleUserStatus(user.id)}
                      color={user.isActive ? 'error' : 'success'}
                    >
                      {user.isActive ? <LockIcon /> : <LockOpenIcon />}
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* User Roles Dialog */}
      <Dialog open={userDialog} onClose={() => setUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit User Roles - {selectedUser?.name}
        </DialogTitle>
        <DialogContent>
          <List>
            {roles.map((role) => (
              <ListItem key={role.id}>
                <ListItemIcon>
                  <Checkbox
                    checked={userRoles.includes(role.id)}
                    onChange={() => handleRoleToggle(role.id)}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={role.name}
                  secondary={role.description}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveUserRoles} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Permissions Overview Component
interface PermissionsOverviewProps {
  permissions: Permission[];
  roles: Role[];
}

const PermissionsOverview: React.FC<PermissionsOverviewProps> = ({
  permissions,
  roles
}) => {
  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getPermissionUsage = (permissionId: string) => {
    return roles.filter(role => role.permissions.includes(permissionId)).length;
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'view': case 'read': return <ViewIcon />;
      case 'create': case 'add': return <CreateIcon />;
      case 'update': case 'edit': return <UpdateIcon />;
      case 'delete': case 'remove': return <RemoveIcon />;
      default: return <PermissionIcon />;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Permissions Overview</Typography>
      
      {Object.entries(groupedPermissions).map(([category, perms]) => (
        <Accordion key={category} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{category}</Typography>
            <Chip label={perms.length} size="small" sx={{ ml: 1 }} />
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {perms.map((permission) => (
                <Grid item xs={12} md={6} key={permission.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {permission.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {permission.description}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
                        {permission.actions.map((action) => (
                          <Chip
                            key={action}
                            label={action}
                            size="small"
                            icon={getActionIcon(action)}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary">
                        Used by {getPermissionUsage(permission.id)} role(s)
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// Audit Log Component
interface AuditLogProps {
  auditLogs: AuditLog[];
}

const AuditLog: React.FC<AuditLogProps> = ({ auditLogs }) => {
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const filteredLogs = auditLogs.filter(log => {
    const matchesUser = !filterUser || log.userName.toLowerCase().includes(filterUser.toLowerCase());
    const matchesAction = !filterAction || log.action.toLowerCase().includes(filterAction.toLowerCase());
    return matchesUser && matchesAction;
  });

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create': return <CreateIcon color="success" />;
      case 'update': return <UpdateIcon color="warning" />;
      case 'delete': return <RemoveIcon color="error" />;
      case 'login': return <LockOpenIcon color="info" />;
      case 'logout': return <LockIcon color="info" />;
      default: return <SettingsIcon />;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Security Audit Log</Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          label="Filter by User"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
        />
        <TextField
          size="small"
          label="Filter by Action"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getActionIcon(log.action)}
                    {log.action}
                  </Box>
                </TableCell>
                <TableCell>{log.resource}</TableCell>
                <TableCell>{log.userName}</TableCell>
                <TableCell>{log.timestamp.toLocaleString()}</TableCell>
                <TableCell>{log.ipAddress}</TableCell>
                <TableCell>
                  {log.details && (
                    <pre style={{ fontSize: '0.8rem', margin: 0 }}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// Main RBAC Page
const RBACPage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Mock data initialization
  useEffect(() => {
    // Mock permissions
    setPermissions([
      {
        id: 'users_view',
        name: 'View Users',
        description: 'View user profiles and information',
        category: 'User Management',
        actions: ['view']
      },
      {
        id: 'users_manage',
        name: 'Manage Users',
        description: 'Create, update, and delete users',
        category: 'User Management',
        actions: ['create', 'update', 'delete']
      },
      {
        id: 'attendance_view',
        name: 'View Attendance',
        description: 'View attendance records',
        category: 'Attendance',
        actions: ['view']
      },
      {
        id: 'attendance_manage',
        name: 'Manage Attendance',
        description: 'Record and manage attendance',
        category: 'Attendance',
        actions: ['create', 'update', 'delete']
      },
      {
        id: 'tickets_view',
        name: 'View Tickets',
        description: 'View support tickets',
        category: 'Ticketing',
        actions: ['view']
      },
      {
        id: 'tickets_manage',
        name: 'Manage Tickets',
        description: 'Create and manage support tickets',
        category: 'Ticketing',
        actions: ['create', 'update', 'delete']
      },
      {
        id: 'reports_view',
        name: 'View Reports',
        description: 'Access system reports and analytics',
        category: 'Reports',
        actions: ['view']
      },
      {
        id: 'system_settings',
        name: 'System Settings',
        description: 'Configure system settings',
        category: 'Administration',
        actions: ['view', 'update']
      }
    ]);

    // Mock roles
    setRoles([
      {
        id: 'admin',
        name: 'Admin',
        description: 'Full system access',
        permissions: ['users_view', 'users_manage', 'attendance_view', 'attendance_manage', 'tickets_view', 'tickets_manage', 'reports_view', 'system_settings'],
        isSystemRole: true,
        userCount: 2,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      },
      {
        id: 'supervisor',
        name: 'Supervisor',
        description: 'Team management and oversight',
        permissions: ['users_view', 'attendance_view', 'attendance_manage', 'tickets_view', 'tickets_manage', 'reports_view'],
        isSystemRole: true,
        userCount: 5,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      },
      {
        id: 'fieldtech',
        name: 'FieldTech',
        description: 'Field operations and basic management',
        permissions: ['attendance_view', 'attendance_manage', 'tickets_view', 'tickets_manage'],
        isSystemRole: true,
        userCount: 15,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      },
      {
        id: 'sitestaff',
        name: 'SiteStaff',
        description: 'Basic site operations',
        permissions: ['attendance_view', 'tickets_view'],
        isSystemRole: true,
        userCount: 25,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      },
      {
        id: 'client',
        name: 'Client',
        description: 'Client access to reports and tickets',
        permissions: ['tickets_view', 'reports_view'],
        isSystemRole: true,
        userCount: 8,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      }
    ]);

    // Mock users
    setUsers([
      {
        id: '1',
        name: 'John Admin',
        email: 'john.admin@company.com',
        roles: ['admin'],
        isActive: true,
        lastLogin: new Date(),
        department: 'IT'
      },
      {
        id: '2',
        name: 'Sarah Supervisor',
        email: 'sarah.supervisor@company.com',
        roles: ['supervisor'],
        isActive: true,
        lastLogin: new Date(Date.now() - 3600000),
        department: 'Operations'
      },
      {
        id: '3',
        name: 'Mike Technician',
        email: 'mike.tech@company.com',
        roles: ['fieldtech'],
        isActive: true,
        lastLogin: new Date(Date.now() - 7200000),
        department: 'Field Operations'
      },
      {
        id: '4',
        name: 'Lisa Staff',
        email: 'lisa.staff@company.com',
        roles: ['sitestaff'],
        isActive: false,
        department: 'Site Operations'
      }
    ]);

    // Mock audit logs
    setAuditLogs([
      {
        id: '1',
        action: 'Login',
        resource: 'Authentication',
        userId: '1',
        userName: 'John Admin',
        timestamp: new Date(),
        details: { success: true },
        ipAddress: '192.168.1.100'
      },
      {
        id: '2',
        action: 'Update',
        resource: 'User Role',
        userId: '1',
        userName: 'John Admin',
        timestamp: new Date(Date.now() - 1800000),
        details: { targetUser: 'Mike Technician', newRole: 'FieldTech' },
        ipAddress: '192.168.1.100'
      },
      {
        id: '3',
        action: 'Create',
        resource: 'Ticket',
        userId: '3',
        userName: 'Mike Technician',
        timestamp: new Date(Date.now() - 3600000),
        details: { ticketId: 'T-001', title: 'Network Issue' },
        ipAddress: '192.168.1.150'
      }
    ]);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleCreateRole = (roleData: any) => {
    const newRole: Role = {
      id: Date.now().toString(),
      ...roleData,
      isSystemRole: false,
      userCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setRoles([...roles, newRole]);
  };

  const handleUpdateRole = (roleId: string, roleData: any) => {
    setRoles(prev =>
      prev.map(role =>
        role.id === roleId
          ? { ...role, ...roleData, updatedAt: new Date() }
          : role
      )
    );
  };

  const handleDeleteRole = (roleId: string) => {
    setRoles(prev => prev.filter(role => role.id !== roleId));
  };

  const handleUpdateUserRoles = (userId: string, newRoles: string[]) => {
    setUsers(prev =>
      prev.map(user =>
        user.id === userId
          ? { ...user, roles: newRoles }
          : user
      )
    );
  };

  const handleToggleUserStatus = (userId: string) => {
    setUsers(prev =>
      prev.map(user =>
        user.id === userId
          ? { ...user, isActive: !user.isActive }
          : user
      )
    );
  };

  return (
    <ProtectedRoute allowed={['Admin']}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Role-Based Access Control
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Comprehensive security and permissions management
          </Typography>
        </Box>

        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={handleTabChange} aria-label="rbac tabs">
              <Tab
                label="Roles"
                icon={<GroupIcon />}
                iconPosition="start"
                {...a11yProps(0)}
              />
              <Tab
                label="Users"
                icon={<PersonIcon />}
                iconPosition="start"
                {...a11yProps(1)}
              />
              <Tab
                label="Permissions"
                icon={<SecurityIcon />}
                iconPosition="start"
                {...a11yProps(2)}
              />
              <Tab
                label="Audit Log"
                icon={<ShieldIcon />}
                iconPosition="start"
                {...a11yProps(3)}
              />
            </Tabs>
          </Box>

          <TabPanel value={currentTab} index={0}>
            <RoleManagement
              roles={roles}
              permissions={permissions}
              onCreateRole={handleCreateRole}
              onUpdateRole={handleUpdateRole}
              onDeleteRole={handleDeleteRole}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <UserManagement
              users={users}
              roles={roles}
              onUpdateUserRoles={handleUpdateUserRoles}
              onToggleUserStatus={handleToggleUserStatus}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <PermissionsOverview
              permissions={permissions}
              roles={roles}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <AuditLog auditLogs={auditLogs} />
          </TabPanel>
        </Paper>
      </Container>
    </ProtectedRoute>
  );
};

export default RBACPage;
