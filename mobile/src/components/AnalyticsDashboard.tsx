import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsReport } from '../services/analyticsService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface AnalyticsDashboardProps {
  userId?: string;
  showOnboardingMetrics?: boolean;
  showEngagementMetrics?: boolean;
  showPerformanceMetrics?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: string;
  color: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  userId,
  showOnboardingMetrics = true,
  showEngagementMetrics = true,
  showPerformanceMetrics = true,
  dateRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  }
}) => {
  const {
    generateOnboardingReport,
    generateEngagementReport,
    generatePerformanceReport,
    loading,
    error
  } = useAnalytics();

  const [onboardingReport, setOnboardingReport] = useState<AnalyticsReport | null>(null);
  const [engagementReport, setEngagementReport] = useState<AnalyticsReport | null>(null);
  const [performanceReport, setPerformanceReport] = useState<AnalyticsReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'onboarding' | 'engagement' | 'performance'>('overview');

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    try {
      setRefreshing(true);

      const promises = [];
      
      if (showOnboardingMetrics) {
        promises.push(generateOnboardingReport(dateRange));
      }
      
      if (showEngagementMetrics) {
        promises.push(generateEngagementReport(dateRange));
      }
      
      if (showPerformanceMetrics) {
        promises.push(generatePerformanceReport(dateRange));
      }

      const [onboarding, engagement, performance] = await Promise.all(promises);
      
      if (showOnboardingMetrics && onboarding) setOnboardingReport(onboarding);
      if (showEngagementMetrics && engagement) setEngagementReport(engagement);
      if (showPerformanceMetrics && performance) setPerformanceReport(performance);

    } catch (error) {
      Alert.alert('Error', 'Failed to load analytics reports');
      console.error('Error loading reports:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getOverviewMetrics = (): MetricCard[] => {
    const metrics: MetricCard[] = [];

    if (onboardingReport?.data) {
      metrics.push({
        title: 'Completion Rate',
        value: `${onboardingReport.data.completionRate?.toFixed(1) || 0}%`,
        change: 5.2,
        changeType: 'increase',
        icon: 'trending-up',
        color: '#4CAF50'
      });

      metrics.push({
        title: 'Total Started',
        value: onboardingReport.data.totalStarted || 0,
        change: 12,
        changeType: 'increase',
        icon: 'person-add',
        color: '#2196F3'
      });
    }

    if (engagementReport?.data) {
      metrics.push({
        title: 'Active Users',
        value: engagementReport.data.uniqueUsers || 0,
        change: -2.1,
        changeType: 'decrease',
        icon: 'people',
        color: '#FF9800'
      });

      metrics.push({
        title: 'Avg Session',
        value: `${Math.round((engagementReport.data.averageSessionDuration || 0) / 60)}m`,
        change: 8.5,
        changeType: 'increase',
        icon: 'access-time',
        color: '#9C27B0'
      });
    }

    if (performanceReport?.data) {
      metrics.push({
        title: 'Avg Load Time',
        value: `${(performanceReport.data.averageScreenLoadTime || 0).toFixed(1)}s`,
        change: -15.3,
        changeType: 'increase', // Decrease in load time is good
        icon: 'speed',
        color: '#00BCD4'
      });

      metrics.push({
        title: 'Error Rate',
        value: `${(performanceReport.data.errorRate || 0).toFixed(2)}%`,
        change: -23.4,
        changeType: 'increase', // Decrease in errors is good
        icon: 'error',
        color: '#F44336'
      });
    }

    return metrics;
  };

  const renderMetricCard = (metric: MetricCard) => (
    <View key={metric.title} style={[styles.metricCard, { borderLeftColor: metric.color }]}>
      <View style={styles.metricHeader}>
        <Icon name={metric.icon} size={24} color={metric.color} />
        <Text style={styles.metricTitle}>{metric.title}</Text>
      </View>
      
      <Text style={styles.metricValue}>{metric.value}</Text>
      
      {metric.change !== undefined && (
        <View style={styles.changeContainer}>
          <Icon
            name={metric.changeType === 'increase' ? 'trending-up' : 'trending-down'}
            size={16}
            color={metric.changeType === 'increase' ? '#4CAF50' : '#F44336'}
          />
          <Text style={[
            styles.changeText,
            { color: metric.changeType === 'increase' ? '#4CAF50' : '#F44336' }
          ]}>
            {Math.abs(metric.change)}%
          </Text>
        </View>
      )}
    </View>
  );

  const renderTabButton = (tab: string, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, selectedTab === tab && styles.activeTabButton]}
      onPress={() => setSelectedTab(tab as any)}
    >
      <Text style={[styles.tabButtonText, selectedTab === tab && styles.activeTabButtonText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderOnboardingDetails = () => {
    if (!onboardingReport?.data) return null;

    const data = onboardingReport.data;

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>Onboarding Analytics</Text>
        
        <View style={styles.detailsGrid}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Completion Rate</Text>
            <Text style={styles.detailValue}>{data.completionRate?.toFixed(1) || 0}%</Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Avg Time to Complete</Text>
            <Text style={styles.detailValue}>
              {Math.round((data.averageTimeToComplete || 0) / 60)} min
            </Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Total Started</Text>
            <Text style={styles.detailValue}>{data.totalStarted || 0}</Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Total Completed</Text>
            <Text style={styles.detailValue}>{data.totalCompleted || 0}</Text>
          </View>
        </View>

        {data.dropoffAnalysis && data.dropoffAnalysis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>Dropoff Analysis</Text>
            {data.dropoffAnalysis.slice(0, 3).map((item: any, index: number) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listItemText}>{item.step}</Text>
                <Text style={styles.listItemValue}>{item.count} users</Text>
              </View>
            ))}
          </View>
        )}

        {data.errorAnalysis && data.errorAnalysis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>Common Errors</Text>
            {data.errorAnalysis.slice(0, 3).map((item: any, index: number) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listItemText}>{item.type}</Text>
                <Text style={styles.listItemValue}>{item.count} occurrences</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEngagementDetails = () => {
    if (!engagementReport?.data) return null;

    const data = engagementReport.data;

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>User Engagement</Text>
        
        <View style={styles.detailsGrid}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Total Interactions</Text>
            <Text style={styles.detailValue}>{data.totalInteractions || 0}</Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Unique Users</Text>
            <Text style={styles.detailValue}>{data.uniqueUsers || 0}</Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Avg Session Duration</Text>
            <Text style={styles.detailValue}>
              {Math.round((data.averageSessionDuration || 0) / 60)}m
            </Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>User Retention</Text>
            <Text style={styles.detailValue}>{(data.userRetention || 0).toFixed(1)}%</Text>
          </View>
        </View>

        {data.mostUsedFeatures && data.mostUsedFeatures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>Most Used Features</Text>
            {data.mostUsedFeatures.slice(0, 5).map((item: any, index: number) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listItemText}>{item.feature}</Text>
                <Text style={styles.listItemValue}>{item.usage} uses</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPerformanceDetails = () => {
    if (!performanceReport?.data) return null;

    const data = performanceReport.data;

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        
        <View style={styles.detailsGrid}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Avg Screen Load</Text>
            <Text style={styles.detailValue}>
              {(data.averageScreenLoadTime || 0).toFixed(1)}s
            </Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Avg API Response</Text>
            <Text style={styles.detailValue}>
              {(data.averageApiResponseTime || 0).toFixed(0)}ms
            </Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Crash Rate</Text>
            <Text style={styles.detailValue}>{(data.crashRate || 0).toFixed(3)}%</Text>
          </View>
          
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Error Rate</Text>
            <Text style={styles.detailValue}>{(data.errorRate || 0).toFixed(2)}%</Text>
          </View>
        </View>

        {data.slowestScreens && data.slowestScreens.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>Slowest Screens</Text>
            {data.slowestScreens.slice(0, 5).map((item: any, index: number) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listItemText}>{item.screen}</Text>
                <Text style={styles.listItemValue}>{item.loadTime.toFixed(1)}s</Text>
              </View>
            ))}
          </View>
        )}

        {data.slowestApis && data.slowestApis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>Slowest APIs</Text>
            {data.slowestApis.slice(0, 5).map((item: any, index: number) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listItemText}>{item.endpoint}</Text>
                <Text style={styles.listItemValue}>{item.responseTime.toFixed(0)}ms</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'overview':
        return (
          <View style={styles.overviewContainer}>
            <View style={styles.metricsGrid}>
              {getOverviewMetrics().map(renderMetricCard)}
            </View>
          </View>
        );
      case 'onboarding':
        return renderOnboardingDetails();
      case 'engagement':
        return renderEngagementDetails();
      case 'performance':
        return renderPerformanceDetails();
      default:
        return null;
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={48} color="#F44336" />
        <Text style={styles.errorText}>Failed to load analytics</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReports}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadReports}>
          <Icon name="refresh" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        {renderTabButton('overview', 'Overview')}
        {showOnboardingMetrics && renderTabButton('onboarding', 'Onboarding')}
        {showEngagementMetrics && renderTabButton('engagement', 'Engagement')}
        {showPerformanceMetrics && renderTabButton('performance', 'Performance')}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadReports} />
        }
      >
        {renderTabContent()}
      </ScrollView>
    </View>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  overviewContainer: {
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: cardWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  detailsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  detailCard: {
    width: cardWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  listItemValue: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnalyticsDashboard;