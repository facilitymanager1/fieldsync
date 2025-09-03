/**
 * Bulk Action Bar Component - Multi-select operations
 * Provides bulk approve, reject, and selection controls
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onApprove: () => void;
  onReject: () => void;
  onClearSelection: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onApprove,
  onReject,
  onClearSelection,
}) => {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <Animated.View style={styles.container}>
      {/* Selection Info */}
      <View style={styles.selectionInfo}>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={onSelectAll}
        >
          <View style={[
            styles.selectAllCheckbox,
            isAllSelected && styles.selectAllCheckboxSelected
          ]}>
            {isAllSelected ? (
              <Ionicons name="checkmark" size={16} color="white" />
            ) : selectedCount > 0 ? (
              <View style={styles.partialSelectionIndicator} />
            ) : null}
          </View>
          <Text style={styles.selectAllText}>
            {selectedCount === 0 
              ? 'Select All' 
              : isAllSelected 
                ? 'Deselect All'
                : `${selectedCount} of ${totalCount} selected`
            }
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={onClearSelection}
        >
          <Ionicons name="close" size={20} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={onApprove}
          disabled={selectedCount === 0}
        >
          <Ionicons name="checkmark-circle" size={20} color="white" />
          <Text style={styles.actionButtonText}>Approve</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{selectedCount}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={onReject}
          disabled={selectedCount === 0}
        >
          <Ionicons name="close-circle" size={20} color="white" />
          <Text style={styles.actionButtonText}>Reject</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{selectedCount}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectAllCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  selectAllCheckboxSelected: {
    backgroundColor: '#007AFF',
  },
  partialSelectionIndicator: {
    width: 12,
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
  selectAllText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  clearButton: {
    padding: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 4,
    position: 'relative',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  countBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  countBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});