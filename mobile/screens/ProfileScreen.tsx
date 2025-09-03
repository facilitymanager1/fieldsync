import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import ApiService from '../services/ApiServiceNew';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppSettings {
  pushNotifications: boolean;
  locationTracking: boolean;
  offlineSync: boolean;
  autoLogout: boolean;
  darkMode: boolean;
}

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { isTracking, startTracking, stopTracking } = useLocation();
  
  const [settings, setSettings] = useState<AppSettings>({
    pushNotifications: true,
    locationTracking: true,
    offlineSync: true,
    autoLogout: false,
    darkMode: false,
  });
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProfile, setEditProfile] = useState({
    firstName: user?.profile.firstName || '',
    lastName: user?.profile.lastName || '',
    email: user?.email || '',
    department: user?.profile.department || '',
    phone: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);

    // Handle location tracking toggle
    if (key === 'locationTracking') {
      if (value && !isTracking) {
        startTracking();
      } else if (!value && isTracking) {
        stopTracking();
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      await ApiService.updateProfile(editProfile);
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all offline data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['offlineTickets', 'offlineReports', 'syncQueue']);
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.profile.firstName?.[0]}{user?.profile.lastName?.[0]}
          </Text>
        </View>
        <TouchableOpacity style={styles.editAvatarButton}>
          <Icon name="camera-alt" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>
          {user?.profile.firstName} {user?.profile.lastName}
        </Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
        <View style={styles.roleContainer}>
          <Icon name="badge" size={16} color="#007AFF" />
          <Text style={styles.profileRole}>{user?.role}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => setShowEditModal(true)}
      >
        <Icon name="edit" size={20} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );

  const renderStatsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quick Stats</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="assignment" size={24} color="#2196F3" />
          <Text style={styles.statValue}>24</Text>
          <Text style={styles.statLabel}>Tickets Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="schedule" size={24} color="#4CAF50" />
          <Text style={styles.statValue}>2.1h</Text>
          <Text style={styles.statLabel}>Avg Resolution</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="star" size={24} color="#FF9800" />
          <Text style={styles.statValue}>4.8</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>
    </View>
  );

  const renderSettingsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>App Settings</Text>
      <View style={styles.settingsContainer}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Icon name="notifications" size={20} color="#666" />
            <Text style={styles.settingLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={settings.pushNotifications}
            onValueChange={(value) => handleSettingChange('pushNotifications', value)}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Icon name="location-on" size={20} color="#666" />
            <Text style={styles.settingLabel}>Location Tracking</Text>
          </View>
          <Switch
            value={settings.locationTracking}
            onValueChange={(value) => handleSettingChange('locationTracking', value)}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Icon name="sync" size={20} color="#666" />
            <Text style={styles.settingLabel}>Offline Sync</Text>
          </View>
          <Switch
            value={settings.offlineSync}
            onValueChange={(value) => handleSettingChange('offlineSync', value)}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Icon name="logout" size={20} color="#666" />
            <Text style={styles.settingLabel}>Auto Logout</Text>
          </View>
          <Switch
            value={settings.autoLogout}
            onValueChange={(value) => handleSettingChange('autoLogout', value)}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Icon name="brightness-6" size={20} color="#666" />
            <Text style={styles.settingLabel}>Dark Mode</Text>
          </View>
          <Switch
            value={settings.darkMode}
            onValueChange={(value) => handleSettingChange('darkMode', value)}
          />
        </View>
      </View>
    </View>
  );

  const renderActionsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionItem} onPress={handleClearCache}>
          <Icon name="delete-sweep" size={20} color="#FF9800" />
          <Text style={styles.actionLabel}>Clear Cache</Text>
          <Icon name="chevron-right" size={20} color="#CCC" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionItem}>
          <Icon name="help-outline" size={20} color="#2196F3" />
          <Text style={styles.actionLabel}>Help & Support</Text>
          <Icon name="chevron-right" size={20} color="#CCC" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionItem}>
          <Icon name="info-outline" size={20} color="#9C27B0" />
          <Text style={styles.actionLabel}>About</Text>
          <Icon name="chevron-right" size={20} color="#CCC" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionItem, styles.logoutAction]} onPress={handleLogout}>
          <Icon name="exit-to-app" size={20} color="#F44336" />
          <Text style={[styles.actionLabel, styles.logoutLabel]}>Logout</Text>
          <Icon name="chevron-right" size={20} color="#CCC" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderProfileHeader()}
      {renderStatsSection()}
      {renderSettingsSection()}
      {renderActionsSection()}

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>FieldSync Mobile v1.0.0</Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={editProfile.firstName}
              onChangeText={(text) => setEditProfile({ ...editProfile, firstName: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={editProfile.lastName}
              onChangeText={(text) => setEditProfile({ ...editProfile, lastName: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={editProfile.email}
              onChangeText={(text) => setEditProfile({ ...editProfile, email: text })}
              keyboardType="email-address"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Department"
              value={editProfile.department}
              onChangeText={(text) => setEditProfile({ ...editProfile, department: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={editProfile.phone}
              onChangeText={(text) => setEditProfile({ ...editProfile, phone: text })}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#666',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  editButton: {
    padding: 8,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  settingsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  actionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  logoutAction: {
    borderBottomWidth: 0,
  },
  logoutLabel: {
    color: '#F44336',
  },
  versionContainer: {
    alignItems: 'center',
    padding: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
});

export default ProfileScreen;
