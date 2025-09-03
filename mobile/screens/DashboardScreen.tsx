import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLocation } from '../context/LocationContext';
import ApiService from '../services/ApiServiceNew';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

interface DashboardMetrics {
  totalTickets: number;
  openTickets: number;
  completedTickets: number;
  overdueTickets: number;
  activeStaff: number;
  todayReports: number;
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

const DashboardScreen: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalTickets: 0,
    openTickets: 0,
    completedTickets: 0,
    overdueTickets: 0,
    activeStaff: 0,
    todayReports: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { currentLocation, isTracking, startTracking } = useLocation();

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    // Start location tracking for field staff
    if (user?.role === 'FieldTech' && !isTracking) {
      startTracking();
    }
  }, [user, isTracking]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load metrics
      const tickets = await ApiService.getTickets();
      const staff = await ApiService.getStaff();
      
      const metricsData = {
        totalTickets: tickets.length,
        openTickets: tickets.filter((t: any) => t.status === 'open').length,
        completedTickets: tickets.filter((t: any) => t.status === 'completed').length,
        overdueTickets: tickets.filter((t: any) => t.priority === 'urgent').length,
        activeStaff: staff.filter((u: any) => u.profile?.isActive).length,
        todayReports: 5, // Mock data for now
      };

      // Mock recent activity for now
      const activityData = [
        {
          id: '1',
          type: 'ticket',
          title: 'New Ticket Created',
          description: 'Elevator maintenance required',
          timestamp: new Date(Date.now() - 300000).toISOString(),
        },
        {
          id: '2',
          type: 'location',
          title: 'Location Updated',
          description: 'Staff arrived at Building A',
          timestamp: new Date(Date.now() - 600000).toISOString(),
        },
      ];

      setMetrics(metricsData);
      setRecentActivity(activityData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Use mock data if API fails
      setMetrics({
        totalTickets: 15,
        openTickets: 8,
        completedTickets: 5,
        overdueTickets: 2,
        activeStaff: 12,
        todayReports: 5,
      });
      setRecentActivity([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const handleQuickAction = (action: string) => {
    Alert.alert('Quick Action', `${action} feature coming soon!`);
  };

  const renderMetricCard = (
    title: string,
    value: number,
    icon: string,
    color: string,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={[styles.metricCard, { borderLeftColor: color }]}
      onPress={onPress}
    >
      <View style={styles.metricHeader}>
        <Icon name={icon} size={24} color={color} />
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
    </TouchableOpacity>
  );

  const renderQuickAction = (title: string, icon: string, color: string, action: string) => (
    <TouchableOpacity
      style={[styles.quickActionCard, { backgroundColor: color }]}
      onPress={() => handleQuickAction(action)}
    >
      <Icon name={icon} size={32} color="#FFFFFF" />
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const renderActivityItem = (item: RecentActivity) => (
    <View key={item.id} style={styles.activityItem}>
      <View style={styles.activityIcon}>
        <Icon
          name={getActivityIcon(item.type)}
          size={20}
          color="#007AFF"
        />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <Text style={styles.activityTime}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case 'ticket': return 'assignment';
      case 'location': return 'location-on';
      case 'report': return 'assessment';
      default: return 'info';
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>
            Welcome back, {user?.profile.firstName}!
          </Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Location Status */}
      {user?.role === 'FieldTech' && (
        <View style={styles.locationCard}>
          <Icon name="location-on" size={20} color="#007AFF" />
          <Text style={styles.locationText}>
            {isTracking
              ? currentLocation
                ? `Location: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                : 'Getting location...'
              : 'Location tracking disabled'
            }
          </Text>
        </View>
      )}

      {/* Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <View style={styles.metricsGrid}>
          {renderMetricCard('Total Tickets', metrics.totalTickets, 'assignment', '#007AFF')}
          {renderMetricCard('Open Tickets', metrics.openTickets, 'assignment-turned-in', '#FF9800')}
          {renderMetricCard('Completed', metrics.completedTickets, 'assignment-turned-in', '#4CAF50')}
          {renderMetricCard('Overdue', metrics.overdueTickets, 'assignment-late', '#F44336')}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {renderQuickAction('New Ticket', 'add-circle', '#007AFF', 'create-ticket')}
          {renderQuickAction('Scan QR', 'qr-code-scanner', '#4CAF50', 'scan-qr')}
          {renderQuickAction('Report Issue', 'report-problem', '#FF9800', 'report-issue')}
          {renderQuickAction('View Map', 'map', '#9C27B0', 'view-map')}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityContainer}>
          {recentActivity.length > 0 ? (
            recentActivity.map(renderActivityItem)
          ) : (
            <Text style={styles.noActivityText}>No recent activity</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    margin: 20,
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    flex: 1,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (width - 50) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  metricTitle: {
    fontSize: 14,
    color: '#666',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (width - 50) / 2,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  activityContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  noActivityText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    padding: 20,
  },
});

export default DashboardScreen;
