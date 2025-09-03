import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAnalytics, useOnboardingAnalytics } from '../hooks/useAnalytics';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import ReportGenerator from '../components/ReportGenerator';
import { useTranslation } from '../hooks/useLocalization';
import { useOfflineSync } from '../hooks/useOfflineSync';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface AnalyticsScreenProps {
  route?: {
    params?: {
      userId?: string;
      initialTab?: 'dashboard' | 'reports' | 'settings';
    };
  };
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { isOnline, syncStats } = useOfflineSync();
  
  const {
    isInitialized,
    userId,
    config,
    updateConfig,
    setUserId,
    trackScreenView,
    trackUserAction
  } = useAnalytics();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'settings'>(
    route?.params?.initialTab || 'dashboard'
  );
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(config.enableTracking);

  useEffect(() => {
    // Track screen view
    trackScreenView('AnalyticsScreen', Date.now());

    // Set user ID if provided
    if (route?.params?.userId && route.params.userId !== userId) {
      setUserId(route.params.userId);
    }
  }, [route?.params?.userId]);

  useEffect(() => {
    // Update local state when config changes
    setAnalyticsEnabled(config.enableTracking);
  }, [config.enableTracking]);

  const handleTabChange = (tab: 'dashboard' | 'reports' | 'settings') => {
    setActiveTab(tab);
    trackUserAction('tab_change', 'analytics_tab', { tab });
  };

  const handleToggleAnalytics = () => {
    const newValue = !analyticsEnabled;
    setAnalyticsEnabled(newValue);
    updateConfig({ enableTracking: newValue });
    
    trackUserAction('toggle_analytics', 'settings_switch', { enabled: newValue });
    
    Alert.alert(
      'Analytics Settings',
      `Analytics tracking has been ${newValue ? 'enabled' : 'disabled'}`,
      [{ text: 'OK' }]
    );
  };

  const handleToggleCrashReporting = () => {
    const newValue = !config.enableCrashReporting;
    updateConfig({ enableCrashReporting: newValue });
    
    trackUserAction('toggle_crash_reporting', 'settings_switch', { enabled: newValue });
  };

  const handleTogglePerformanceTracking = () => {
    const newValue = !config.enablePerformanceTracking;
    updateConfig({ enablePerformanceTracking: newValue });
    
    trackUserAction('toggle_performance_tracking', 'settings_switch', { enabled: newValue });
  };

  const handleGenerateReport = (reportType?: 'onboarding' | 'engagement' | 'performance') => {
    setShowReportGenerator(true);
    trackUserAction('open_report_generator', 'button', { reportType });
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {[
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'reports', label: 'Reports', icon: 'assessment' },
        { id: 'settings', label: 'Settings', icon: 'settings' }
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => handleTabChange(tab.id as any)}
        >
          <Icon
            name={tab.icon}
            size={24}
            color={activeTab === tab.id ? '#2196F3' : '#666'}
          />
          <Text style={[
            styles.tabText,
            activeTab === tab.id && styles.activeTabText
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatusIndicator = () => (
    <View style={styles.statusContainer}>
      <View style={[styles.statusIndicator, isOnline ? styles.online : styles.offline]}>
        <Icon
          name={isOnline ? 'cloud-done' : 'cloud-off'}
          size={16}
          color="#FFFFFF"
        />
        <Text style={styles.statusText}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
      
      {syncStats.pendingItems > 0 && (
        <View style={styles.pendingIndicator}>
          <Text style={styles.pendingText}>
            {syncStats.pendingItems} pending
          </Text>
        </View>
      )}
    </View>
  );

  const renderDashboardTab = () => (
    <AnalyticsDashboard
      userId={userId}
      showOnboardingMetrics={true}
      showEngagementMetrics={true}
      showPerformanceMetrics={true}
    />
  );

  const renderReportsTab = () => (
    <ScrollView style={styles.reportsContainer}>
      <View style={styles.reportsHeader}>
        <Text style={styles.reportsTitle}>Analytics Reports</Text>
        <Text style={styles.reportsSubtitle}>
          Generate detailed reports for analysis and compliance
        </Text>
      </View>

      <View style={styles.reportTypes}>
        <TouchableOpacity
          style={styles.reportTypeCard}
          onPress={() => handleGenerateReport('onboarding')}
        >
          <View style={styles.reportTypeIcon}>
            <Icon name="person-add" size={32} color="#4CAF50" />
          </View>
          <Text style={styles.reportTypeTitle}>Onboarding Report</Text>
          <Text style={styles.reportTypeDescription}>
            Employee onboarding completion rates, drop-off analysis, and time metrics
          </Text>
          <View style={styles.reportTypeAction}>
            <Text style={styles.reportTypeActionText}>Generate Report</Text>
            <Icon name="arrow-forward" size={20} color="#4CAF50" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.reportTypeCard}
          onPress={() => handleGenerateReport('engagement')}
        >
          <View style={styles.reportTypeIcon}>
            <Icon name="people" size={32} color="#2196F3" />
          </View>
          <Text style={styles.reportTypeTitle}>Engagement Report</Text>
          <Text style={styles.reportTypeDescription}>
            User interaction patterns, feature usage, and retention metrics
          </Text>
          <View style={styles.reportTypeAction}>
            <Text style={styles.reportTypeActionText}>Generate Report</Text>
            <Icon name="arrow-forward" size={20} color="#2196F3" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.reportTypeCard}
          onPress={() => handleGenerateReport('performance')}
        >
          <View style={styles.reportTypeIcon}>
            <Icon name="speed" size={32} color="#FF9800" />
          </View>
          <Text style={styles.reportTypeTitle}>Performance Report</Text>
          <Text style={styles.reportTypeDescription}>
            App performance metrics, load times, and optimization opportunities
          </Text>
          <View style={styles.reportTypeAction}>
            <Text style={styles.reportTypeActionText}>Generate Report</Text>
            <Icon name="arrow-forward" size={20} color="#FF9800" />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.customReportButton}
        onPress={() => setShowReportGenerator(true)}
      >
        <Icon name="add-circle" size={24} color="#FFFFFF" />
        <Text style={styles.customReportButtonText}>Create Custom Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSettingsTab = () => (
    <ScrollView style={styles.settingsContainer}>
      <View style={styles.settingsSection}>
        <Text style={styles.settingsTitle}>Analytics Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Analytics Tracking</Text>
            <Text style={styles.settingDescription}>
              Collect usage data to improve the application
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingToggle, analyticsEnabled && styles.settingToggleActive]}
            onPress={handleToggleAnalytics}
          >
            <View style={[
              styles.settingToggleThumb,
              analyticsEnabled && styles.settingToggleThumbActive
            ]} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Crash Reporting</Text>
            <Text style={styles.settingDescription}>
              Help us fix issues by sending crash reports
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingToggle, config.enableCrashReporting && styles.settingToggleActive]}
            onPress={handleToggleCrashReporting}
          >
            <View style={[
              styles.settingToggleThumb,
              config.enableCrashReporting && styles.settingToggleThumbActive
            ]} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Performance Tracking</Text>
            <Text style={styles.settingDescription}>
              Monitor app performance and optimization metrics
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingToggle, config.enablePerformanceTracking && styles.settingToggleActive]}
            onPress={handleTogglePerformanceTracking}
          >
            <View style={[
              styles.settingToggleThumb,
              config.enablePerformanceTracking && styles.settingToggleThumbActive
            ]} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsTitle}>Data Management</Text>
        
        <View style={styles.settingInfo}>
          <Text style={styles.infoText}>
            Analytics data is stored locally and synced when online. 
            You can disable tracking at any time without affecting app functionality.
          </Text>
        </View>

        <View style={styles.configInfo}>
          <Text style={styles.configTitle}>Current Configuration</Text>
          <Text style={styles.configItem}>Batch Size: {config.batchSize}</Text>
          <Text style={styles.configItem}>Upload Interval: {config.uploadInterval / 1000}s</Text>
          <Text style={styles.configItem}>Retention: {config.retentionDays} days</Text>
          <Text style={styles.configItem}>Debug Mode: {config.enableDebugMode ? 'On' : 'Off'}</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboardTab();
      case 'reports':
        return renderReportsTab();
      case 'settings':
        return renderSettingsTab();
      default:
        return null;
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing Analytics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Analytics</Text>
        
        {renderStatusIndicator()}
      </View>

      {renderTabBar()}

      <View style={styles.content}>
        {renderTabContent()}
      </View>

      <ReportGenerator
        visible={showReportGenerator}
        onClose={() => setShowReportGenerator(false)}
        userId={userId}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  online: {
    backgroundColor: '#4CAF50',
  },
  offline: {
    backgroundColor: '#FF9800',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  pendingIndicator: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  reportsContainer: {
    flex: 1,
  },
  reportsHeader: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  reportsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  reportsSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  reportTypes: {
    padding: 16,
  },
  reportTypeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportTypeIcon: {
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTypeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  reportTypeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  reportTypeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTypeActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 8,
  },
  customReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  customReportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsContainer: {
    flex: 1,
  },
  settingsSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 8,
    padding: 16,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  settingToggle: {
    width: 48,
    height: 28,
    backgroundColor: '#E0E0E0',
    borderRadius: 14,
    padding: 2,
  },
  settingToggleActive: {
    backgroundColor: '#4CAF50',
  },
  settingToggleThumb: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  settingToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  configInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  configTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  configItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});

export default AnalyticsScreen;