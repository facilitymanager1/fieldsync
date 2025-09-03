/**
 * HR Approval Dashboard - Main interface for HR approval workflow
 * Features: Status filtering, validation checkboxes, bulk operations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Components
import { ApprovalCard } from './components/ApprovalCard';
import { ApprovalFilters } from './components/ApprovalFilters';
import { ApprovalStats } from './components/ApprovalStats';
import { BulkActionBar } from './components/BulkActionBar';
import { RejectionModal } from './components/RejectionModal';

// Types
import { 
  EmployeeApprovalSummary, 
  EmployeeStatus, 
  ApprovalFilters as ApprovalFiltersType,
  ApprovalStats as ApprovalStatsType 
} from '../../types/approval';

// Services
import { approvalApiService } from '../../services/approvalApiService';

interface ApprovalDashboardProps {
  navigation: any;
}

export const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({ navigation }) => {
  // State management
  const [approvals, setApprovals] = useState<EmployeeApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filters, setFilters] = useState<ApprovalFiltersType>({});
  const [stats, setStats] = useState<ApprovalStatsType | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [employeeToReject, setEmployeeToReject] = useState<EmployeeApprovalSummary | null>(null);

  // Load approvals data
  const loadApprovals = useCallback(async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 1 : page;
      const response = await approvalApiService.getApprovals(filters, currentPage);
      
      if (resetPage) {
        setApprovals(response.approvals);
        setPage(1);
      } else {
        setApprovals(prev => [...prev, ...response.approvals]);
      }
      
      setHasMore(response.pagination.page < response.pagination.pages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading approvals:', error);
      Alert.alert('Error', 'Failed to load approval data');
      setLoading(false);
    }
  }, [filters, page]);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const statsData = await approvalApiService.getApprovalStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Initial load
  useFocusEffect(
    useCallback(() => {
      loadApprovals(true);
      loadStats();
    }, [])
  );

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await Promise.all([loadApprovals(true), loadStats()]);
    setRefreshing(false);
  }, [loadApprovals, loadStats]);

  // Filter change handler
  const handleFilterChange = useCallback((newFilters: ApprovalFiltersType) => {
    setFilters(newFilters);
    setPage(1);
    setApprovals([]);
    setLoading(true);
  }, []);

  // Load more items (pagination)
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  // Item selection handlers
  const handleItemSelect = useCallback((itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedItems.length === approvals.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(approvals.map(item => item.id));
    }
  }, [selectedItems, approvals]);

  // Navigation handlers
  const handleItemPress = useCallback((approval: EmployeeApprovalSummary) => {
    navigation.navigate('ApprovalDetails', { approvalId: approval.id });
  }, [navigation]);

  // Bulk actions
  const handleBulkApprove = useCallback(async () => {
    if (selectedItems.length === 0) return;

    Alert.alert(
      'Bulk Approve',
      `Are you sure you want to approve ${selectedItems.length} employee(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approvalApiService.bulkUpdateApprovals(selectedItems, {
                status: EmployeeStatus.EXIST,
                validationChecks: { hr: true, esi: true, pf: true, uan: true }
              });
              
              setSelectedItems([]);
              handleRefresh();
              
              Alert.alert('Success', `${selectedItems.length} employee(s) approved successfully`);
            } catch (error) {
              Alert.alert('Error', 'Failed to approve employees');
            }
          }
        }
      ]
    );
  }, [selectedItems, handleRefresh]);

  const handleBulkReject = useCallback(async () => {
    if (selectedItems.length === 0) return;

    // For bulk operations, we'll use a simpler prompt for now
    // In a full implementation, you could create a bulk rejection modal
    Alert.prompt(
      'Bulk Reject',
      'Enter reason for rejection:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Rejection reason is required');
              return;
            }

            try {
              await approvalApiService.bulkUpdateApprovals(selectedItems, {
                status: EmployeeStatus.REJECTED,
                rejectionReason: reason,
                rejectionCategory: 'policy' // Default category for bulk rejections
              });
              
              setSelectedItems([]);
              handleRefresh();
              
              Alert.alert('Success', `${selectedItems.length} employee(s) rejected`);
            } catch (error) {
              Alert.alert('Error', 'Failed to reject employees');
            }
          }
        }
      ],
      'plain-text'
    );
  }, [selectedItems, handleRefresh]);

  // Render approval item
  const renderApprovalItem = ({ item }: { item: EmployeeApprovalSummary }) => (
    <ApprovalCard
      approval={item}
      isSelected={selectedItems.includes(item.id)}
      onPress={() => handleItemPress(item)}
      onSelect={() => handleItemSelect(item.id)}
      onQuickApprove={() => handleQuickApprove(item)}
      onQuickReject={() => handleQuickReject(item)}
    />
  );

  // Quick actions
  const handleQuickApprove = useCallback(async (approval: EmployeeApprovalSummary) => {
    try {
      await approvalApiService.updateApproval(approval.id, {
        status: EmployeeStatus.EXIST,
        validationChecks: { hr: true, esi: true, pf: true, uan: true }
      });
      
      handleRefresh();
      Alert.alert('Success', `${approval.name} approved successfully`);
    } catch (error) {
      Alert.alert('Error', 'Failed to approve employee');
    }
  }, [handleRefresh]);

  const handleQuickReject = useCallback((approval: EmployeeApprovalSummary) => {
    setEmployeeToReject(approval);
    setRejectionModalVisible(true);
  }, []);

  const handleRejectionSubmit = useCallback(async (employee: EmployeeApprovalSummary, reason: string, category: string) => {
    try {
      await approvalApiService.updateApproval(employee.id, {
        status: EmployeeStatus.REJECTED,
        rejectionReason: reason,
        rejectionCategory: category
      });
      
      handleRefresh();
      Alert.alert('Success', `${employee.name} rejected successfully`);
    } catch (error) {
      Alert.alert('Error', 'Failed to reject employee');
    }
  }, [handleRefresh]);

  // Render footer
  const renderFooter = () => {
    if (!loading) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No Approvals Found</Text>
      <Text style={styles.emptySubtitle}>
        {Object.keys(filters).length > 0 
          ? 'Try adjusting your filters'
          : 'No pending approvals at this time'
        }
      </Text>
    </View>
  );

  if (loading && page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading approvals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Statistics Header */}
      {stats && <ApprovalStats stats={stats} />}
      
      {/* Filters */}
      <ApprovalFilters 
        filters={filters}
        onFiltersChange={handleFilterChange}
      />
      
      {/* Bulk Action Bar */}
      {selectedItems.length > 0 && (
        <BulkActionBar
          selectedCount={selectedItems.length}
          totalCount={approvals.length}
          onSelectAll={handleSelectAll}
          onApprove={handleBulkApprove}
          onReject={handleBulkReject}
          onClearSelection={() => setSelectedItems([])}
        />
      )}
      
      {/* Approval List */}
      <FlatList
        data={approvals}
        renderItem={renderApprovalItem}
        keyExtractor={(item) => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
          />
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={approvals.length === 0 ? styles.emptyContainer : undefined}
        showsVerticalScrollIndicator={false}
      />

      {/* Rejection Modal */}
      <RejectionModal
        visible={rejectionModalVisible}
        employee={employeeToReject}
        onClose={() => {
          setRejectionModalVisible(false);
          setEmployeeToReject(null);
        }}
        onReject={handleRejectionSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});