/**
 * Approval Statistics Component - Dashboard overview stats
 * Shows key metrics for HR approval workflow
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ApprovalStats as ApprovalStatsType } from '../../../types/approval';

interface ApprovalStatsProps {
  stats: ApprovalStatsType;
}

export const ApprovalStats: React.FC<ApprovalStatsProps> = ({ stats }) => {

  // Format approval time
  const formatApprovalTime = (milliseconds: number) => {
    const hours = Math.round(milliseconds / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  // Get status color
  const getStatusColor = (status: 'success' | 'warning' | 'danger' | 'info') => {
    switch (status) {
      case 'success': return '#34C759';
      case 'warning': return '#FF9500';
      case 'danger': return '#FF3B30';
      case 'info': return '#007AFF';
      default: return '#8E8E93';
    }
  };

  const statCards = [
    {
      title: 'Total',
      value: stats.total.toString(),
      subtitle: 'Applications',
      color: getStatusColor('info'),
      icon: 'people-outline'
    },
    {
      title: 'In Progress',
      value: stats.inProgress.toString(),
      subtitle: 'Pending',
      color: getStatusColor('warning'),
      icon: 'time-outline'
    },
    {
      title: 'Approved',
      value: stats.exist.toString(),
      subtitle: 'Complete',
      color: getStatusColor('success'),
      icon: 'checkmark-circle-outline'
    },
    {
      title: 'Rejected',
      value: stats.rejected.toString(),
      subtitle: 'Declined',
      color: getStatusColor('danger'),
      icon: 'close-circle-outline'
    }
  ];

  const validationCards = [
    {
      title: 'HR Pending',
      value: stats.pendingHRApproval.toString(),
      color: getStatusColor('warning'),
      icon: 'person-outline'
    },
    {
      title: 'ESI Pending',
      value: stats.pendingESIApproval.toString(),
      color: getStatusColor('warning'),
      icon: 'medical-outline'
    },
    {
      title: 'PF Pending',
      value: stats.pendingPFApproval.toString(),
      color: getStatusColor('warning'),
      icon: 'card-outline'
    },
    {
      title: 'UAN Pending',
      value: stats.pendingUANApproval.toString(),
      color: getStatusColor('warning'),
      icon: 'shield-outline'
    }
  ];

  return (
    <View style={styles.container}>
      {/* Main Statistics */}
      <View style={styles.statsGrid}>
        {statCards.map((card, index) => (
          <TouchableOpacity key={index} style={styles.statCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: `${card.color}20` }]}>
                <Ionicons name={card.icon as any} size={20} color={card.color} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
            </View>
            <Text style={[styles.cardValue, { color: card.color }]}>
              {card.value}
            </Text>
            <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Validation Statistics */}
      <View style={styles.validationSection}>
        <Text style={styles.sectionTitle}>Validation Status</Text>
        <View style={styles.validationGrid}>
          {validationCards.map((card, index) => (
            <View key={index} style={styles.validationCard}>
              <View style={styles.validationHeader}>
                <Ionicons name={card.icon as any} size={16} color={card.color} />
                <Text style={styles.validationTitle}>{card.title}</Text>
              </View>
              <Text style={[styles.validationValue, { color: card.color }]}>
                {card.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Metrics */}
      <View style={styles.metricsSection}>
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <Text style={styles.metricLabel}>Avg. Approval Time</Text>
          </View>
          <Text style={styles.metricValue}>
            {stats.averageApprovalTime ? formatApprovalTime(stats.averageApprovalTime) : 'N/A'}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            <Text style={styles.metricLabel}>Today's Submissions</Text>
          </View>
          <Text style={styles.metricValue}>{stats.todaysSubmissions}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 2,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
  validationSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  validationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  validationCard: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  validationTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 4,
    textAlign: 'center',
  },
  validationValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  metricsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
});