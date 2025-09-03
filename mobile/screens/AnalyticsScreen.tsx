import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ApiService from '../services/ApiServiceNew';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  ticketMetrics: {
    totalTickets: number;
    completedTickets: number;
    averageResolutionTime: number;
    customerSatisfaction: number;
  };
  performanceMetrics: {
    activeStaff: number;
    averageResponseTime: number;
    firstCallResolution: number;
    utilizationRate: number;
  };
  trendData: {
    period: string;
    tickets: number;
    completed: number;
  }[];
  topIssues: {
    category: string;
    count: number;
    percentage: number;
  }[];
}

const AnalyticsScreen: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    ticketMetrics: {
      totalTickets: 0,
      completedTickets: 0,
      averageResolutionTime: 0,
      customerSatisfaction: 0,
    },
    performanceMetrics: {
      activeStaff: 0,
      averageResponseTime: 0,
      firstCallResolution: 0,
      utilizationRate: 0,
    },
    trendData: [],
    topIssues: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const { user } = useAuth();
  const { isConnected } = useSocket();

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      // Try to load real analytics data
      try {
        const data = await ApiService.getAnalytics({ period: selectedPeriod });
        setAnalyticsData(data);
      } catch (error) {
        console.error('Failed to load analytics from API:', error);
        // Use mock data if API fails
        setAnalyticsData(getMockAnalyticsData());
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      setAnalyticsData(getMockAnalyticsData());
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadAnalyticsData();
    setIsRefreshing(false);
  };

  const getMockAnalyticsData = (): AnalyticsData => ({
    ticketMetrics: {
      totalTickets: 245,
      completedTickets: 198,
      averageResolutionTime: 2.4,
      customerSatisfaction: 4.6,
    },
    performanceMetrics: {
      activeStaff: 15,
      averageResponseTime: 12,
      firstCallResolution: 78,
      utilizationRate: 85,
    },
    trendData: [
      { period: 'Mon', tickets: 35, completed: 28 },
      { period: 'Tue', tickets: 42, completed: 35 },
      { period: 'Wed', tickets: 38, completed: 32 },
      { period: 'Thu', tickets: 45, completed: 40 },
      { period: 'Fri', tickets: 52, completed: 45 },
      { period: 'Sat', tickets: 28, completed: 25 },
      { period: 'Sun', tickets: 22, completed: 20 },
    ],
    topIssues: [
      { category: 'HVAC Systems', count: 45, percentage: 32 },
      { category: 'Elevators', count: 32, percentage: 23 },
      { category: 'Electrical', count: 28, percentage: 20 },
      { category: 'Plumbing', count: 22, percentage: 16 },
      { category: 'Security', count: 13, percentage: 9 },
    ],
  });

  const renderMetricCard = (
    title: string,
    value: string | number,
    subtitle: string,
    icon: string,
    color: string,
    trend?: number
  ) => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={styles.metricHeader}>
        <Icon name={icon} size={24} color={color} />
        {trend !== undefined && (
          <View style={styles.trendContainer}>
            <Icon
              name={trend >= 0 ? 'trending-up' : 'trending-down'}
              size={16}
              color={trend >= 0 ? '#4CAF50' : '#F44336'}
            />
            <Text style={[styles.trendText, { color: trend >= 0 ? '#4CAF50' : '#F44336' }]}>
              {Math.abs(trend)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderSimpleChart = (data: { period: string; tickets: number; completed: number }[]) => {
    const maxValue = Math.max(...data.map(d => Math.max(d.tickets, d.completed)));
    const chartHeight = 120;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Tickets Trend - {selectedPeriod}</Text>
        <View style={styles.chart}>
          {data.map((item, index) => {
            const ticketHeight = (item.tickets / maxValue) * chartHeight;
            const completedHeight = (item.completed / maxValue) * chartHeight;
            
            return (
              <View key={index} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      styles.ticketsBar,
                      { height: ticketHeight },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      styles.completedBar,
                      { height: completedHeight },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{item.period}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>Total Tickets</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Completed</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTopIssuesChart = (issues: { category: string; count: number; percentage: number }[]) => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Top Issue Categories</Text>
      <View style={styles.issuesList}>
        {issues.map((issue, index) => (
          <View key={index} style={styles.issueItem}>
            <View style={styles.issueInfo}>
              <Text style={styles.issueCategory}>{issue.category}</Text>
              <Text style={styles.issueCount}>{issue.count} tickets</Text>
            </View>
            <View style={styles.issueProgress}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${issue.percentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.issuePercentage}>{issue.percentage}%</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {['day', 'week', 'month'].map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && styles.activePeriodButton,
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.activePeriodButtonText,
            ]}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Performance insights and metrics</Text>
        </View>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Live Data' : 'Cached Data'}
          </Text>
        </View>
      </View>

      {/* Period Selector */}
      {renderPeriodSelector()}

      {/* Ticket Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ticket Metrics</Text>
        <View style={styles.metricsGrid}>
          {renderMetricCard(
            'Total Tickets',
            analyticsData.ticketMetrics.totalTickets,
            'This period',
            'assignment',
            '#2196F3',
            12
          )}
          {renderMetricCard(
            'Completed',
            analyticsData.ticketMetrics.completedTickets,
            `${Math.round((analyticsData.ticketMetrics.completedTickets / analyticsData.ticketMetrics.totalTickets) * 100)}% completion rate`,
            'assignment-turned-in',
            '#4CAF50',
            8
          )}
          {renderMetricCard(
            'Avg Resolution',
            `${analyticsData.ticketMetrics.averageResolutionTime}h`,
            'Hours to resolve',
            'schedule',
            '#FF9800',
            -5
          )}
          {renderMetricCard(
            'Satisfaction',
            `${analyticsData.ticketMetrics.customerSatisfaction}/5`,
            'Customer rating',
            'star',
            '#9C27B0',
            3
          )}
        </View>
      </View>

      {/* Performance Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Performance</Text>
        <View style={styles.metricsGrid}>
          {renderMetricCard(
            'Active Staff',
            analyticsData.performanceMetrics.activeStaff,
            'Currently working',
            'people',
            '#00BCD4'
          )}
          {renderMetricCard(
            'Response Time',
            `${analyticsData.performanceMetrics.averageResponseTime}m`,
            'Average first response',
            'timer',
            '#FF5722'
          )}
          {renderMetricCard(
            'First Call Resolution',
            `${analyticsData.performanceMetrics.firstCallResolution}%`,
            'Resolved on first contact',
            'done-all',
            '#8BC34A'
          )}
          {renderMetricCard(
            'Utilization',
            `${analyticsData.performanceMetrics.utilizationRate}%`,
            'Staff efficiency',
            'trending-up',
            '#673AB7'
          )}
        </View>
      </View>

      {/* Trends Chart */}
      {renderSimpleChart(analyticsData.trendData)}

      {/* Top Issues */}
      {renderTopIssuesChart(analyticsData.topIssues)}

      {/* Additional Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Insights</Text>
        <View style={styles.insightsContainer}>
          <View style={styles.insightCard}>
            <Icon name="lightbulb-outline" size={24} color="#FF9800" />
            <Text style={styles.insightText}>
              HVAC issues account for 32% of all tickets. Consider preventive maintenance.
            </Text>
          </View>
          <View style={styles.insightCard}>
            <Icon name="trending-up" size={24} color="#4CAF50" />
            <Text style={styles.insightText}>
              Resolution time improved by 15% this month compared to last month.
            </Text>
          </View>
          <View style={styles.insightCard}>
            <Icon name="people" size={24} color="#2196F3" />
            <Text style={styles.insightText}>
              Peak activity is on Thursday-Friday. Consider staff scheduling optimization.
            </Text>
          </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  connectionStatus: {
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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activePeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activePeriodButtonText: {
    color: '#FFFFFF',
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
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    marginBottom: 16,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
  },
  bar: {
    width: 8,
    marginHorizontal: 1,
    borderRadius: 4,
  },
  ticketsBar: {
    backgroundColor: '#2196F3',
  },
  completedBar: {
    backgroundColor: '#4CAF50',
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  issuesList: {
    marginTop: 8,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  issueInfo: {
    flex: 1,
    marginRight: 12,
  },
  issueCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  issueCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  issueProgress: {
    flex: 1,
    alignItems: 'flex-end',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  issuePercentage: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  insightsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default AnalyticsScreen;
