"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Badge,
  Divider,
  IconButton,
  InputAdornment,
  Fab,
  AppBar,
  Toolbar,
  Drawer,
  Switch,
  FormControlLabel,
  Menu,
  ListItemButton
} from '@mui/material';
import {
  Chat as ChatIcon,
  Group as GroupIcon,
  Notifications as NotificationsIcon,
  Announcement as AnnouncementIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Phone as PhoneIcon,
  VideoCall as VideoCallIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  Archive as ArchiveIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as ReadIcon,
  Circle as UnreadIcon
} from '@mui/icons-material';
import ProtectedRoute from '../../ProtectedRoute';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'system' | 'ticket_update';
  attachments?: Attachment[];
  isRead: boolean;
  isStarred: boolean;
  replyTo?: string;
  ticketId?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'team' | 'announcement';
  name: string;
  avatar?: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  isActive: boolean;
  isPinned: boolean;
  isMuted: boolean;
  description?: string;
  createdBy: string;
  createdAt: Date;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  avatar?: string;
  lastSeen?: Date;
}

interface Notification {
  id: string;
  type: 'message' | 'ticket' | 'system' | 'announcement';
  title: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  icon?: string;
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
      id={`communication-tabpanel-${index}`}
      aria-labelledby={`communication-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `communication-tab-${index}`,
    'aria-controls': `communication-tabpanel-${index}`,
  };
}

// Chat Interface Component
interface ChatInterfaceProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string, type: 'text' | 'image' | 'file') => void;
  teamMembers: TeamMember[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversation,
  messages,
  onSendMessage,
  teamMembers
}) => {
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim(), 'text');
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (type: 'image' | 'file') => {
    // Simulate file upload
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getMessageTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isMessageFromCurrentUser = (senderId: string) => {
    return senderId === 'current-user'; // Replace with actual current user logic
  };

  if (!conversation) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <ChatIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.secondary">
          Select a conversation to start chatting
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Header */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={conversation.avatar}>
            {conversation.name[0]}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{conversation.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {conversation.type === 'direct' ? 'Direct Message' : 
               conversation.type === 'group' ? `${conversation.participants.length} members` :
               conversation.type === 'team' ? 'Team Chat' : 'Announcements'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton>
              <PhoneIcon />
            </IconButton>
            <IconButton>
              <VideoCallIcon />
            </IconButton>
            <IconButton>
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Messages Area */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 1,
          backgroundColor: 'grey.50'
        }}
      >
        {messages.map((message, index) => {
          const isOwn = isMessageFromCurrentUser(message.senderId);
          const showAvatar = !isOwn && (index === 0 || messages[index - 1].senderId !== message.senderId);
          
          return (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                mb: 1,
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: 1
              }}
            >
              {!isOwn && (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    visibility: showAvatar ? 'visible' : 'hidden'
                  }}
                  src={message.senderAvatar}
                >
                  {message.senderName[0]}
                </Avatar>
              )}
              
              <Paper
                sx={{
                  p: 1.5,
                  maxWidth: '70%',
                  backgroundColor: isOwn ? 'primary.main' : 'white',
                  color: isOwn ? 'white' : 'text.primary'
                }}
              >
                {!isOwn && showAvatar && (
                  <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    {message.senderName}
                  </Typography>
                )}
                
                {message.type === 'ticket_update' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AssignmentIcon sx={{ fontSize: 16 }} />
                    <Typography variant="caption">Ticket Update</Typography>
                  </Box>
                )}
                
                <Typography variant="body2">{message.content}</Typography>
                
                {message.attachments && message.attachments.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {message.attachments.map((attachment) => (
                      <Chip
                        key={attachment.id}
                        label={attachment.name}
                        size="small"
                        icon={<AttachFileIcon />}
                        sx={{ mr: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
                
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.5,
                    opacity: 0.7,
                    fontSize: '0.7rem'
                  }}
                >
                  {getMessageTime(message.timestamp)}
                  {isOwn && (
                    <CheckIcon sx={{ fontSize: 12, ml: 0.5 }} />
                  )}
                </Typography>
              </Paper>
            </Box>
          );
        })}
        
        {isTyping && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
            <Avatar sx={{ width: 24, height: 24 }}>...</Avatar>
            <Typography variant="caption" color="text.secondary">
              Someone is typing...
            </Typography>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <IconButton
            onClick={() => setShowAttachMenu(true)}
            sx={{ mb: 0.5 }}
          >
            <AttachFileIcon />
          </IconButton>
          
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            variant="outlined"
            size="small"
          />
          
          <IconButton
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            color="primary"
            sx={{ mb: 0.5 }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          // Handle file upload
          console.log('File selected:', e.target.files?.[0]);
        }}
      />

      {/* Attachment Menu */}
      <Menu
        open={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        anchorEl={null}
      >
        <MenuItem onClick={() => handleFileUpload('image')}>
          <ListItemIcon><AttachFileIcon /></ListItemIcon>
          <ListItemText>Upload Image</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFileUpload('file')}>
          <ListItemIcon><AttachFileIcon /></ListItemIcon>
          <ListItemText>Upload File</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

// Conversations List Component
interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onCreateConversation: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ConversationsList: React.FC<ConversationsListProps> = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  onCreateConversation,
  searchQuery,
  onSearchChange
}) => {
  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'group': return <GroupIcon />;
      case 'team': return <GroupIcon />;
      case 'announcement': return <AnnouncementIcon />;
      default: return <PersonIcon />;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search and New Chat */}
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          size="small"
          sx={{ mb: 2 }}
        />
        
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateConversation}
        >
          New Conversation
        </Button>
      </Box>

      {/* Conversations List */}
      <List sx={{ flexGrow: 1, overflow: 'auto', px: 1 }}>
        {filteredConversations.map((conversation) => (
          <ListItemButton
            key={conversation.id}
            selected={selectedConversation?.id === conversation.id}
            onClick={() => onSelectConversation(conversation)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                '&:hover': {
                  backgroundColor: 'primary.light',
                },
              },
            }}
          >
            <ListItemAvatar>
              <Badge
                badgeContent={conversation.unreadCount}
                color="error"
                invisible={conversation.unreadCount === 0}
              >
                <Avatar src={conversation.avatar}>
                  {getConversationIcon(conversation.type)}
                </Avatar>
              </Badge>
            </ListItemAvatar>
            
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: conversation.unreadCount > 0 ? 'bold' : 'normal',
                      flexGrow: 1
                    }}
                  >
                    {conversation.name}
                  </Typography>
                  {conversation.isPinned && <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                  {conversation.isMuted && <NotificationsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                </Box>
              }
              secondary={
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {conversation.lastMessage?.content || 'No messages yet'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {conversation.lastMessage?.timestamp.toLocaleDateString()}
                  </Typography>
                </Box>
              }
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};

// Notifications Panel Component
interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return <ChatIcon />;
      case 'ticket': return <AssignmentIcon />;
      case 'announcement': return <AnnouncementIcon />;
      case 'system': return <SettingsIcon />;
      default: return <NotificationsIcon />;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Notifications
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                color="error"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={onMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </Box>
      </Box>

      <List sx={{ flexGrow: 1, overflow: 'auto' }}>
        {notifications.map((notification) => (
          <ListItem
            key={notification.id}
            sx={{
              backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
              borderLeft: notification.isRead ? 'none' : `4px solid ${getPriorityColor(notification.priority)}.main`
            }}
          >
            <ListItemIcon>
              {getNotificationIcon(notification.type)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: notification.isRead ? 'normal' : 'bold' }}
                  >
                    {notification.title}
                  </Typography>
                  <Chip
                    label={notification.priority}
                    size="small"
                    color={getPriorityColor(notification.priority)}
                  />
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {notification.content}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {notification.timestamp.toLocaleString()}
                  </Typography>
                </Box>
              }
            />
            {!notification.isRead && (
              <IconButton
                size="small"
                onClick={() => onMarkAsRead(notification.id)}
              >
                <CheckIcon />
              </IconButton>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

// Main Communication Component
const CommunicationPage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [createConversationDialog, setCreateConversationDialog] = useState(false);

  // Mock data initialization
  useEffect(() => {
    // Mock conversations
    setConversations([
      {
        id: '1',
        type: 'team',
        name: 'Technical Support Team',
        participants: ['tech1', 'tech2', 'tech3'],
        unreadCount: 3,
        isActive: true,
        isPinned: true,
        isMuted: false,
        createdBy: 'admin',
        createdAt: new Date(),
        lastMessage: {
          id: 'm1',
          senderId: 'tech1',
          senderName: 'John Doe',
          content: 'Network issue in Building A has been resolved',
          timestamp: new Date(),
          type: 'text',
          isRead: false,
          isStarred: false
        }
      },
      {
        id: '2',
        type: 'direct',
        name: 'Sarah Davis',
        participants: ['current-user', 'maint2'],
        unreadCount: 1,
        isActive: true,
        isPinned: false,
        isMuted: false,
        createdBy: 'current-user',
        createdAt: new Date(),
        lastMessage: {
          id: 'm2',
          senderId: 'maint2',
          senderName: 'Sarah Davis',
          content: 'Can you review the safety inspection report?',
          timestamp: new Date(),
          type: 'text',
          isRead: false,
          isStarred: false
        }
      },
      {
        id: '3',
        type: 'announcement',
        name: 'Company Announcements',
        participants: ['all'],
        unreadCount: 0,
        isActive: true,
        isPinned: true,
        isMuted: false,
        createdBy: 'admin',
        createdAt: new Date(),
        lastMessage: {
          id: 'm3',
          senderId: 'admin',
          senderName: 'Admin',
          content: 'New safety protocols will be implemented next week',
          timestamp: new Date(),
          type: 'text',
          isRead: true,
          isStarred: false
        }
      }
    ]);

    // Mock messages for selected conversation
    setMessages([
      {
        id: 'm1',
        senderId: 'tech1',
        senderName: 'John Doe',
        content: 'Hey team, we have a network issue in Building A',
        timestamp: new Date(Date.now() - 3600000),
        type: 'text',
        isRead: true,
        isStarred: false
      },
      {
        id: 'm2',
        senderId: 'current-user',
        senderName: 'You',
        content: 'I can take a look at it. What are the symptoms?',
        timestamp: new Date(Date.now() - 3000000),
        type: 'text',
        isRead: true,
        isStarred: false
      },
      {
        id: 'm3',
        senderId: 'tech1',
        senderName: 'John Doe',
        content: 'Users reporting intermittent connectivity. I\'ve created ticket #1 for tracking.',
        timestamp: new Date(Date.now() - 1800000),
        type: 'ticket_update',
        isRead: true,
        isStarred: false,
        ticketId: '1'
      },
      {
        id: 'm4',
        senderId: 'tech3',
        senderName: 'Mike Johnson',
        content: 'Issue has been resolved. Router restart fixed the problem.',
        timestamp: new Date(Date.now() - 300000),
        type: 'text',
        isRead: false,
        isStarred: false
      }
    ]);

    // Mock notifications
    setNotifications([
      {
        id: 'n1',
        type: 'ticket',
        title: 'New Ticket Assigned',
        content: 'Ticket #2 "HVAC malfunction" has been assigned to you',
        timestamp: new Date(Date.now() - 1800000),
        isRead: false,
        priority: 'high'
      },
      {
        id: 'n2',
        type: 'message',
        title: 'New Message',
        content: 'Sarah Davis sent you a message',
        timestamp: new Date(Date.now() - 900000),
        isRead: false,
        priority: 'medium'
      },
      {
        id: 'n3',
        type: 'announcement',
        title: 'Company Announcement',
        content: 'New safety protocols will be implemented',
        timestamp: new Date(Date.now() - 86400000),
        isRead: true,
        priority: 'low'
      }
    ]);

    // Mock team members
    setTeamMembers([
      { id: 'tech1', name: 'John Doe', role: 'Senior Tech', status: 'online' },
      { id: 'tech2', name: 'Jane Smith', role: 'Hardware Specialist', status: 'away' },
      { id: 'tech3', name: 'Mike Johnson', role: 'Network Admin', status: 'online' },
      { id: 'maint1', name: 'Bob Wilson', role: 'Maintenance Lead', status: 'busy' },
      { id: 'maint2', name: 'Sarah Davis', role: 'Safety Officer', status: 'online' }
    ]);

    // Select first conversation by default
    setSelectedConversation(conversations[0] || null);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSendMessage = (content: string, type: 'text' | 'image' | 'file') => {
    if (!selectedConversation) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'current-user',
      senderName: 'You',
      content,
      timestamp: new Date(),
      type,
      isRead: true,
      isStarred: false
    };

    setMessages(prev => [...prev, newMessage]);

    // Update conversation's last message
    setConversations(prev =>
      prev.map(conv =>
        conv.id === selectedConversation.id
          ? { ...conv, lastMessage: newMessage }
          : conv
      )
    );
  };

  const handleMarkNotificationAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId
          ? { ...notif, isRead: true }
          : notif
      )
    );
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, isRead: true }))
    );
  };

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;
  const unreadMessagesCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <ProtectedRoute allowed={['Admin', 'Supervisor', 'FieldTech', 'SiteStaff']}>
      <Container maxWidth={false} sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 0 }}>
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Team Communication
            </Typography>
            <IconButton color="inherit">
              <SettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, display: 'flex' }}>
          <Paper sx={{ width: 80, display: 'flex', flexDirection: 'column' }}>
            <Tabs
              orientation="vertical"
              value={currentTab}
              onChange={handleTabChange}
              sx={{ flexGrow: 1 }}
            >
              <Tab
                icon={
                  <Badge badgeContent={unreadMessagesCount} color="error">
                    <ChatIcon />
                  </Badge>
                }
                {...a11yProps(0)}
              />
              <Tab
                icon={<GroupIcon />}
                {...a11yProps(1)}
              />
              <Tab
                icon={
                  <Badge badgeContent={unreadNotificationsCount} color="error">
                    <NotificationsIcon />
                  </Badge>
                }
                {...a11yProps(2)}
              />
              <Tab
                icon={<AnnouncementIcon />}
                {...a11yProps(3)}
              />
            </Tabs>
          </Paper>

          <TabPanel value={currentTab} index={0}>
            <Box sx={{ height: '100%', display: 'flex' }}>
              <Paper sx={{ width: 320, borderRadius: 0 }}>
                <ConversationsList
                  conversations={conversations}
                  selectedConversation={selectedConversation}
                  onSelectConversation={setSelectedConversation}
                  onCreateConversation={() => setCreateConversationDialog(true)}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </Paper>
              
              <Box sx={{ flexGrow: 1 }}>
                <ChatInterface
                  conversation={selectedConversation}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  teamMembers={teamMembers}
                />
              </Box>
            </Box>
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Team Members</Typography>
              <Grid container spacing={2}>
                {teamMembers.map((member) => (
                  <Grid item xs={12} md={6} lg={4} key={member.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Badge
                            color={
                              member.status === 'online' ? 'success' :
                              member.status === 'away' ? 'warning' :
                              member.status === 'busy' ? 'error' : 'default'
                            }
                            variant="dot"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          >
                            <Avatar src={member.avatar}>{member.name[0]}</Avatar>
                          </Badge>
                          <Box>
                            <Typography variant="subtitle1">{member.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {member.role}
                            </Typography>
                            <Chip
                              label={member.status}
                              size="small"
                              color={
                                member.status === 'online' ? 'success' :
                                member.status === 'away' ? 'warning' :
                                member.status === 'busy' ? 'error' : 'default'
                              }
                            />
                          </Box>
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button size="small" startIcon={<ChatIcon />}>
                            Message
                          </Button>
                          <Button size="small" startIcon={<PhoneIcon />}>
                            Call
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <NotificationsPanel
              notifications={notifications}
              onMarkAsRead={handleMarkNotificationAsRead}
              onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Company Announcements</Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                Important announcements and updates will appear here.
              </Alert>
              
              <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 3 }}>
                Create Announcement
              </Button>

              {/* Announcement list would go here */}
              <Typography variant="body1" color="text.secondary">
                No announcements at this time.
              </Typography>
            </Box>
          </TabPanel>
        </Box>
      </Container>
    </ProtectedRoute>
  );
};

export default CommunicationPage;
