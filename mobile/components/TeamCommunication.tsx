/**
 * Enhanced Team Communication Component
 * Real-time messaging with integrated ticket management
 * AI-powered suggestions and location-aware features
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ActionSheetIOS,
  Dimensions,
  Vibration,
} from 'react-native';

import {
  CommunicationService,
  Message,
  ConversationThread,
  ChatTicket,
  AISuggestion,
  UserPresence,
} from '../services/CommunicationService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Simple Icon Component (replacement for vector icons)
const SimpleIcon: React.FC<{ name: string; size?: number; color?: string; style?: any }> = ({ 
  name, 
  size = 24, 
  color = '#000', 
  style 
}) => {
  const getIconText = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'location-on': '📍',
      'send': '➤',
      'attach-file': '📎',
      'confirmation-number': '🎫',
      'keyboard-arrow-down': '▼',
      'more-vert': '⋮',
      'done': '✓',
      'done-all': '✓✓',
      'mic': '🎤',
      'close': '✕',
      'my-location': '📍',
    };
    return iconMap[iconName] || '•';
  };

  return (
    <Text style={[{ fontSize: size, color }, style]}>
      {getIconText(name)}
    </Text>
  );
};

// Component Props
interface TeamCommunicationProps {
  threadId?: string;
  initialThread?: ConversationThread;
  onThreadChange?: (thread: ConversationThread) => void;
  style?: any;
}

// State Interfaces
interface ChatState {
  messages: Message[];
  currentThread: ConversationThread | null;
  threads: ConversationThread[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  typingUsers: UserPresence[];
  unreadCounts: { [threadId: string]: number };
}

interface UIState {
  inputText: string;
  isRecording: boolean;
  showEmojiPicker: boolean;
  showTicketModal: boolean;
  showThreadSelector: boolean;
  showAISuggestions: boolean;
  selectedMessage: Message | null;
  aiSuggestions: AISuggestion[];
  showLocationPicker: boolean;
  isTyping: boolean;
}

// Main Component
const TeamCommunication: React.FC<TeamCommunicationProps> = ({
  threadId,
  initialThread,
  onThreadChange,
  style,
}) => {
  // State Management
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    currentThread: initialThread || null,
    threads: [],
    isLoading: false,
    hasMoreMessages: true,
    typingUsers: [],
    unreadCounts: {},
  });

  const [uiState, setUIState] = useState<UIState>({
    inputText: '',
    isRecording: false,
    showEmojiPicker: false,
    showTicketModal: false,
    showThreadSelector: false,
    showAISuggestions: false,
    selectedMessage: null,
    aiSuggestions: [],
    showLocationPicker: false,
    isTyping: false,
  });

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const communicationService = useRef(new CommunicationService()).current;

  // Effects
  useEffect(() => {
    initializeChat();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (threadId && threadId !== chatState.currentThread?.id) {
      loadThread(threadId);
    }
  }, [threadId]);

  useEffect(() => {
    if (chatState.currentThread && onThreadChange) {
      onThreadChange(chatState.currentThread);
    }
  }, [chatState.currentThread, onThreadChange]);

  // Initialization
  const initializeChat = async () => {
    try {
      setChatState(prev => ({ ...prev, isLoading: true }));
      
      const threads = await communicationService.getThreads();
      setChatState(prev => ({ 
        ...prev, 
        threads,
        currentThread: threads.find(t => t.id === threadId) || threads[0] || null,
        isLoading: false,
      }));

      if (chatState.currentThread) {
        await loadMessages(chatState.currentThread.id);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      setChatState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const setupVoiceRecording = () => {
    // Voice recording setup will be added when dependencies are resolved
    console.log('Voice recording setup placeholder');
  };

  const cleanup = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    communicationService.disconnect();
  };

  // Data Loading
  const loadThread = async (newThreadId: string) => {
    try {
      const thread = chatState.threads.find(t => t.id === newThreadId);
      if (thread) {
        setChatState(prev => ({ ...prev, currentThread: thread }));
        await loadMessages(newThreadId);
      }
    } catch (error) {
      console.error('Error loading thread:', error);
    }
  };

  const loadMessages = async (threadId: string, loadMore: boolean = false) => {
    try {
      const messages = await communicationService.getMessages(
        threadId,
        50,
        loadMore ? chatState.messages[0]?.id : undefined
      );

      setChatState(prev => ({
        ...prev,
        messages: loadMore ? [...messages, ...prev.messages] : messages,
        hasMoreMessages: messages.length === 50,
      }));

      // Mark messages as read
      if (messages.length > 0) {
        await communicationService.markAsRead(threadId, messages[0].id);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Message Sending
  const sendMessage = async () => {
    if (!uiState.inputText.trim() || !chatState.currentThread) return;

    try {
      const message = await communicationService.sendMessage(
        chatState.currentThread.id,
        uiState.inputText.trim(),
        'text'
      );

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, message],
      }));

      setUIState(prev => ({ ...prev, inputText: '' }));
      scrollToBottom();
      stopTyping();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const sendLocationMessage = async (isLive: boolean = false) => {
    if (!chatState.currentThread) return;

    try {
      const message = await communicationService.sendLocationMessage(
        chatState.currentThread.id,
        isLive,
        isLive ? new Date(Date.now() + 8 * 60 * 60 * 1000) : undefined // 8 hours
      );

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, message],
      }));

      scrollToBottom();
      setUIState(prev => ({ ...prev, showLocationPicker: false }));
    } catch (error) {
      console.error('Error sending location:', error);
      Alert.alert('Error', 'Failed to send location');
    }
  };

  const sendMediaMessage = async (mediaType: 'photo' | 'video') => {
    if (!chatState.currentThread) return;

    // Simplified media handling - will be enhanced when dependencies are resolved
    Alert.alert('Media Message', `${mediaType} message feature will be available soon`);
  };

  // Voice Recording
  const startVoiceRecording = async () => {
    // Voice recording will be implemented when dependencies are resolved
    Alert.alert('Voice Recording', 'Voice recording feature will be available soon');
  };

  const stopVoiceRecording = async () => {
    // Voice recording will be implemented when dependencies are resolved
    console.log('Stop voice recording placeholder');
  };

  // Typing Indicators
  const handleTextChange = (text: string) => {
    setUIState(prev => ({ ...prev, inputText: text }));
    
    if (!uiState.isTyping && text.length > 0 && chatState.currentThread) {
      startTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const startTyping = async () => {
    if (chatState.currentThread) {
      setUIState(prev => ({ ...prev, isTyping: true }));
      await communicationService.startTyping(chatState.currentThread.id);
    }
  };

  const stopTyping = async () => {
    if (chatState.currentThread && uiState.isTyping) {
      setUIState(prev => ({ ...prev, isTyping: false }));
      await communicationService.stopTyping(chatState.currentThread.id);
    }
  };

  // Ticket Management
  const createTicketFromMessage = async (message: Message) => {
    try {
      const title = `Issue: ${message.content.substring(0, 50)}...`;
      const ticket = await communicationService.createTicketFromMessage(message.id, title);
      
      Alert.alert(
        'Ticket Created',
        `Ticket #${ticket.id} has been created successfully`
      );
    } catch (error) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', 'Failed to create ticket');
    }
  };

  const showTicketModal = () => {
    setUIState(prev => ({ ...prev, showTicketModal: true }));
  };

  const createNewTicket = async (title: string, description: string, priority: ChatTicket['priority']) => {
    if (!chatState.currentThread) return;

    try {
      const ticket = await communicationService.createTicketInChat(
        chatState.currentThread.id,
        title,
        description,
        priority
      );

      Alert.alert(
        'Ticket Created',
        `Ticket #${ticket.id} has been created successfully`
      );

      setUIState(prev => ({ ...prev, showTicketModal: false }));
    } catch (error) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', 'Failed to create ticket');
    }
  };

  // AI Suggestions
  const handleAISuggestion = async (suggestion: AISuggestion) => {
    switch (suggestion.type) {
      case 'quick_reply':
        setUIState(prev => ({ ...prev, inputText: suggestion.content }));
        break;
      case 'location':
        sendLocationMessage();
        break;
      case 'ticket':
        showTicketModal();
        break;
      case 'action':
        // Handle custom actions
        break;
    }
  };

  // UI Helpers
  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return `Yesterday ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'away': return '#FF9800';
      case 'busy': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // Message Rendering
  const renderMessage = ({ item: message, index }: { item: Message; index: number }) => {
    const isOwnMessage = message.senderId === 'currentUserId'; // Replace with actual user ID
    const showAvatar = index === 0 || chatState.messages[index - 1].senderId !== message.senderId;
    const isGrouped = index < chatState.messages.length - 1 && 
                     chatState.messages[index + 1].senderId === message.senderId;

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
        !isGrouped && styles.messageSpacing,
      ]}>
        {!isOwnMessage && showAvatar && (
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(message.senderId) }]}>
              <Text style={styles.avatarText}>
                {message.senderName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
        ]}>
          {!isOwnMessage && showAvatar && (
            <Text style={styles.senderName}>{message.senderName}</Text>
          )}
          
          {message.replyTo && (
            <View style={styles.replyContainer}>
              <Text style={styles.replyText}>Replying to message...</Text>
            </View>
          )}
          
          {message.type === 'text' && (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}>
              {message.content}
            </Text>
          )}
          
          {message.type === 'location' && (
            <View style={styles.locationContainer}>
              <SimpleIcon name="location-on" size={20} color="#4CAF50" />
              <Text style={styles.locationText}>
                {message.location?.isLive ? 'Live Location' : 'Location'}
              </Text>
            </View>
          )}
          
          {message.type === 'image' && message.attachments && (
            <Image
              source={{ uri: message.attachments[0].url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          
          {message.type === 'system' && (
            <View style={styles.systemMessageContainer}>
              <Text style={styles.systemMessageText}>{message.content}</Text>
            </View>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {formatMessageTime(new Date(message.timestamp))}
            </Text>
            
            {isOwnMessage && (
              <View style={styles.messageStatus}>
                <SimpleIcon
                  name={message.metadata?.deliveryStatus === 'read' ? 'done-all' : 'done'}
                  size={16}
                  color={message.metadata?.deliveryStatus === 'read' ? '#4CAF50' : '#9E9E9E'}
                />
              </View>
            )}
          </View>
          
          {message.reactions.length > 0 && (
            <View style={styles.reactionsContainer}>
              {message.reactions.map((reaction, idx) => (
                <Text key={idx} style={styles.reaction}>
                  {reaction.emoji}
                </Text>
              ))}
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.messageActions}
          onPress={() => showMessageActions(message)}
        >
          <SimpleIcon name="more-vert" size={16} color="#9E9E9E" />
        </TouchableOpacity>
      </View>
    );
  };

  const showMessageActions = (message: Message) => {
    const actions = [
      'Cancel',
      'Reply',
      'React',
      'Create Ticket',
      'Copy',
      ...(message.senderId === 'currentUserId' ? ['Edit', 'Delete'] : []),
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: actions,
          cancelButtonIndex: 0,
          destructiveButtonIndex: actions.includes('Delete') ? actions.indexOf('Delete') : undefined,
        },
        (buttonIndex) => {
          handleMessageAction(message, actions[buttonIndex]);
        }
      );
    } else {
      Alert.alert(
        'Message Actions',
        'Choose an action',
        actions.slice(1).map(action => ({
          text: action,
          onPress: () => handleMessageAction(message, action),
          style: action === 'Delete' ? 'destructive' : 'default',
        }))
      );
    }
  };

  const handleMessageAction = async (message: Message, action: string) => {
    switch (action) {
      case 'Reply':
        // Implement reply functionality
        break;
      case 'React':
        // Show emoji picker
        break;
      case 'Create Ticket':
        await createTicketFromMessage(message);
        break;
      case 'Copy':
        // Copy to clipboard
        break;
      case 'Edit':
        // Implement edit functionality
        break;
      case 'Delete':
        await communicationService.deleteMessage(message.id);
        break;
    }
  };

  const getAvatarColor = (userId: string) => {
    const colors = ['#FF5722', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688'];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Render AI Suggestions
  const renderAISuggestions = () => {
    if (!uiState.showAISuggestions || uiState.aiSuggestions.length === 0) return null;

    return (
      <View style={styles.aiSuggestionsContainer}>
        <Text style={styles.aiSuggestionsTitle}>💡 Smart Suggestions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {uiState.aiSuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.aiSuggestionButton}
              onPress={() => handleAISuggestion(suggestion)}
            >
              <Text style={styles.aiSuggestionText}>{suggestion.content}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Main Render
  return (
    <SafeAreaView style={[styles.container, style]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.threadSelector}
            onPress={() => setUIState(prev => ({ ...prev, showThreadSelector: true }))}
          >
            <Text style={styles.threadName}>
              {chatState.currentThread?.name || 'Select Chat'}
            </Text>
            <SimpleIcon name="keyboard-arrow-down" size={24} color="#666" />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={showTicketModal}
            >
              <SimpleIcon name="confirmation-number" size={24} color="#2196F3" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setUIState(prev => ({ ...prev, showLocationPicker: true }))}
            >
              <SimpleIcon name="location-on" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Typing Indicators */}
        {chatState.typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>
              {chatState.typingUsers.map(u => u.userId).join(', ')} {chatState.typingUsers.length === 1 ? 'is' : 'are'} typing...
            </Text>
          </View>
        )}

        {/* AI Suggestions */}
        {renderAISuggestions()}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={chatState.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          inverted={false}
          onEndReached={() => {
            if (chatState.hasMoreMessages && chatState.currentThread) {
              loadMessages(chatState.currentThread.id, true);
            }
          }}
          onEndReachedThreshold={0.1}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => sendMediaMessage('photo')}
            >
              <SimpleIcon name="attach-file" size={24} color="#666" />
            </TouchableOpacity>
            
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={uiState.inputText}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              multiline
              maxLength={1000}
              blurOnSubmit={false}
            />
            
            {uiState.inputText.trim() ? (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={sendMessage}
              >
                <SimpleIcon name="send" size={24} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.voiceButton}
                onPressIn={startVoiceRecording}
                onPressOut={stopVoiceRecording}
              >
                <SimpleIcon 
                  name="mic" 
                  size={24} 
                  color={uiState.isRecording ? "#F44336" : "#666"} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Location Picker Modal */}
        <Modal
          visible={uiState.showLocationPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setUIState(prev => ({ ...prev, showLocationPicker: false }))}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.locationModal}>
              <Text style={styles.modalTitle}>Share Location</Text>
              
              <TouchableOpacity
                style={styles.locationOption}
                onPress={() => sendLocationMessage(false)}
              >
                <SimpleIcon name="location-on" size={24} color="#4CAF50" />
                <Text style={styles.locationOptionText}>Current Location</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.locationOption}
                onPress={() => sendLocationMessage(true)}
              >
                <SimpleIcon name="my-location" size={24} color="#2196F3" />
                <Text style={styles.locationOptionText}>Live Location (8 hours)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setUIState(prev => ({ ...prev, showLocationPicker: false }))}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Ticket Creation Modal */}
        <TicketModal
          visible={uiState.showTicketModal}
          onClose={() => setUIState(prev => ({ ...prev, showTicketModal: false }))}
          onSubmit={createNewTicket}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Ticket Creation Modal Component
interface TicketModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, priority: ChatTicket['priority']) => void;
}

const TicketModal: React.FC<TicketModalProps> = ({ visible, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ChatTicket['priority']>('medium');

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a ticket title');
      return;
    }
    
    onSubmit(title.trim(), description.trim(), priority);
    setTitle('');
    setDescription('');
    setPriority('medium');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.ticketModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Ticket</Text>
            <TouchableOpacity onPress={onClose}>
              <SimpleIcon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.modalInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter ticket title"
              maxLength={100}
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue..."
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            
            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.priorityContainer}>
              {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    priority === p && styles.priorityButtonSelected,
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[
                    styles.priorityButtonText,
                    priority === p && styles.priorityButtonTextSelected,
                  ]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Create Ticket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  threadSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  threadName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  aiSuggestionsContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  aiSuggestionsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  aiSuggestionButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    marginLeft: 16,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: '#1976D2',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageSpacing: {
    marginTop: 8,
  },
  avatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  ownMessageBubble: {
    backgroundColor: '#2196F3',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  replyContainer: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 12,
    color: '#666',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFF',
  },
  otherMessageText: {
    color: '#333',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 8,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  systemMessageContainer: {
    alignItems: 'center',
  },
  systemMessageText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  messageStatus: {
    marginLeft: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  reaction: {
    fontSize: 16,
    marginRight: 4,
  },
  messageActions: {
    padding: 4,
    alignSelf: 'center',
  },
  inputContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButton: {
    padding: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: screenWidth * 0.8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  locationOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  ticketModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  priorityButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  priorityButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  priorityButtonText: {
    fontSize: 14,
    color: '#666',
  },
  priorityButtonTextSelected: {
    color: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default TeamCommunication;
