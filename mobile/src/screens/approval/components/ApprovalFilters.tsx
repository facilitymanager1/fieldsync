/**
 * Approval Filters Component - Status and criteria filtering
 * Provides filtering options for the approval dashboard
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { 
  ApprovalFilters as ApprovalFiltersType, 
  EmployeeStatus 
} from '../../../types/approval';

interface ApprovalFiltersProps {
  filters: ApprovalFiltersType;
  onFiltersChange: (filters: ApprovalFiltersType) => void;
}

export const ApprovalFilters: React.FC<ApprovalFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery || '');

  // Status filter options
  const statusOptions = [
    { value: EmployeeStatus.IN_PROGRESS, label: 'In Progress', color: '#FF9500' },
    { value: EmployeeStatus.EXIST, label: 'Approved', color: '#34C759' },
    { value: EmployeeStatus.REJECTED, label: 'Rejected', color: '#FF3B30' },
  ];

  // Validation status options
  const validationOptions = [
    { value: 'pending', label: 'Pending Validation', icon: 'hourglass-outline' },
    { value: 'partial', label: 'Partial Validation', icon: 'checkmark-outline' },
    { value: 'complete', label: 'Full Validation', icon: 'checkmark-done-outline' },
  ];

  // Priority options
  const priorityOptions = [
    { value: 'high', label: 'High Priority', color: '#FF3B30' },
    { value: 'medium', label: 'Medium Priority', color: '#FF9500' },
    { value: 'low', label: 'Low Priority', color: '#34C759' },
  ];

  // Handle status filter toggle
  const handleStatusToggle = (status: EmployeeStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    onFiltersChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined
    });
  };

  // Handle validation status filter
  const handleValidationStatusChange = (status: 'pending' | 'partial' | 'complete' | undefined) => {
    onFiltersChange({
      ...filters,
      validationStatus: filters.validationStatus === status ? undefined : status
    });
  };

  // Handle priority filter toggle
  const handlePriorityToggle = (priority: 'low' | 'medium' | 'high') => {
    const currentPriorities = filters.priority || [];
    const newPriorities = currentPriorities.includes(priority)
      ? currentPriorities.filter(p => p !== priority)
      : [...currentPriorities, priority];
    
    onFiltersChange({
      ...filters,
      priority: newPriorities.length > 0 ? newPriorities : undefined
    });
  };

  // Handle search
  const handleSearchSubmit = () => {
    onFiltersChange({
      ...filters,
      searchQuery: searchQuery.trim() || undefined
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    onFiltersChange({});
  };

  // Count active filters
  const activeFilterCount = [
    filters.status?.length,
    filters.validationStatus ? 1 : 0,
    filters.priority?.length,
    filters.searchQuery ? 1 : 0
  ].reduce((sum, count) => sum + (count || 0), 0);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchText}
            placeholder="Search by name, ID, or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options-outline" size={20} color="#007AFF" />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Status Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.quickFilters}
        contentContainerStyle={styles.quickFiltersContent}
      >
        {statusOptions.map((option) => {
          const isSelected = filters.status?.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.quickFilterChip,
                isSelected && { backgroundColor: `${option.color}20`, borderColor: option.color }
              ]}
              onPress={() => handleStatusToggle(option.value)}
            >
              <Text style={[
                styles.quickFilterText,
                isSelected && { color: option.color }
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter Options</Text>
            <TouchableOpacity onPress={handleClearFilters}>
              <Text style={styles.modalClearButton}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Status Filters */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Status</Text>
              {statusOptions.map((option) => {
                const isSelected = filters.status?.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.filterOption}
                    onPress={() => handleStatusToggle(option.value)}
                  >
                    <View style={styles.filterOptionLeft}>
                      <View style={[styles.colorIndicator, { backgroundColor: option.color }]} />
                      <Text style={styles.filterOptionText}>{option.label}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Validation Status */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Validation Status</Text>
              {validationOptions.map((option) => {
                const isSelected = filters.validationStatus === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.filterOption}
                    onPress={() => handleValidationStatusChange(option.value as any)}
                  >
                    <View style={styles.filterOptionLeft}>
                      <Ionicons name={option.icon as any} size={20} color="#8E8E93" />
                      <Text style={styles.filterOptionText}>{option.label}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Priority Filters */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Priority</Text>
              {priorityOptions.map((option) => {
                const isSelected = filters.priority?.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.filterOption}
                    onPress={() => handlePriorityToggle(option.value)}
                  >
                    <View style={styles.filterOptionLeft}>
                      <View style={[styles.colorIndicator, { backgroundColor: option.color }]} />
                      <Text style={styles.filterOptionText}>{option.label}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 12,
  },
  searchText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 8,
  },
  filterButton: {
    position: 'relative',
    padding: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  quickFilters: {
    paddingLeft: 16,
  },
  quickFiltersContent: {
    paddingRight: 16,
  },
  quickFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginRight: 8,
  },
  quickFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalClearButton: {
    fontSize: 16,
    color: '#FF3B30',
  },
  modalContent: {
    flex: 1,
  },
  filterSection: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterOptionText: {
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 12,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});