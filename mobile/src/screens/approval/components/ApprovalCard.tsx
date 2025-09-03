/**
 * Approval Card Component - Individual employee approval card
 * Features: Status indicators, validation checkboxes, quick actions
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmployeeApprovalSummary, EmployeeStatus } from '../../../types/approval';

interface ApprovalCardProps {
  approval: EmployeeApprovalSummary;
  isSelected: boolean;
  onPress: () => void;
  onSelect: () => void;
  onQuickApprove?: () => void;
  onQuickReject?: () => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  approval,
  isSelected,
  onPress,
  onSelect,
  onQuickApprove,
  onQuickReject,
}) => {
  
  // Get status color and icon
  const getStatusConfig = (status: EmployeeStatus) => {
    switch (status) {
      case EmployeeStatus.IN_PROGRESS:
        return { color: '#FF9500', icon: 'time-outline', text: 'In Progress' };
      case EmployeeStatus.EXIST:
        return { color: '#34C759', icon: 'checkmark-circle-outline', text: 'Approved' };
      case EmployeeStatus.REJECTED:
        return { color: '#FF3B30', icon: 'close-circle-outline', text: 'Rejected' };
      default:
        return { color: '#8E8E93', icon: 'help-circle-outline', text: 'Unknown' };
    }
  };

  // Calculate validation completion
  const getValidationProgress = () => {
    const checks = approval.validationChecks;
    const total = 4;
    const completed = [checks.hr, checks.esi, checks.pf, checks.uan].filter(Boolean).length;
    return { completed, total, percentage: (completed / total) * 100 };
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#FF3B30';
      case 'medium': return '#FF9500';
      case 'low': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const statusConfig = getStatusConfig(approval.status);
  const validationProgress = getValidationProgress();
  const priorityColor = getPriorityColor(approval.priority);

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  return (
    <View style={[styles.container, isSelected && styles.selectedContainer]}>
      {/* Selection Checkbox */}
      <TouchableOpacity
        style={styles.checkbox}
        onPress={onSelect}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={[styles.checkboxBox, isSelected && styles.checkboxSelected]}>
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="white" />
          )}
        </View>
      </TouchableOpacity>

      {/* Main Content */}
      <TouchableOpacity style={styles.content} onPress={onPress}>
        {/* Header Row */}
        <View style={styles.header}>
          {/* Employee Info */}
          <View style={styles.employeeInfo}>
            <View style={styles.profileSection}>
              {approval.profilePhoto ? (
                <Image source={{ uri: approval.profilePhoto }} style={styles.profileImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>
                    {approval.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.nameSection}>
                <Text style={styles.employeeName} numberOfLines={1}>
                  {approval.name}
                </Text>
                <Text style={styles.phoneNumber}>
                  {approval.phoneNumber}
                </Text>
                <View style={styles.idRow}>
                  <Text style={styles.tempId}>
                    {approval.tempId || 'No ID'}
                  </Text>
                  {approval.permanentId && (
                    <Text style={styles.permanentId}>
                      → {approval.permanentId}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Status and Priority */}
          <View style={styles.statusSection}>
            <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
            <View style={styles.statusBadge}>
              <Ionicons 
                name={statusConfig.icon as any} 
                size={16} 
                color={statusConfig.color} 
              />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.text}
              </Text>
            </View>
          </View>
        </View>

        {/* Validation Checkboxes */}
        <View style={styles.validationSection}>
          <View style={styles.validationHeader}>
            <Text style={styles.validationTitle}>Validation Progress</Text>
            <Text style={styles.validationPercentage}>
              {validationProgress.completed}/{validationProgress.total} ({Math.round(validationProgress.percentage)}%)
            </Text>
          </View>
          
          <View style={styles.checkboxRow}>
            {[
              { key: 'hr', label: 'HR', checked: approval.validationChecks.hr },
              { key: 'esi', label: 'ESI', checked: approval.validationChecks.esi },
              { key: 'pf', label: 'PF', checked: approval.validationChecks.pf },
              { key: 'uan', label: 'UAN', checked: approval.validationChecks.uan },
            ].map(({ key, label, checked }) => (
              <View key={key} style={styles.validationCheckbox}>
                <View style={[
                  styles.validationBox,
                  checked && styles.validationBoxChecked
                ]}>
                  {checked && (
                    <Ionicons name="checkmark" size={12} color="white" />
                  )}
                </View>
                <Text style={[
                  styles.validationLabel,
                  checked && styles.validationLabelChecked
                ]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Rejection Reason */}
        {approval.status === EmployeeStatus.REJECTED && approval.rejectionReason && (
          <View style={styles.rejectionSection}>
            <Ionicons name="warning-outline" size={16} color="#FF3B30" />
            <Text style={styles.rejectionReason} numberOfLines={2}>
              {approval.rejectionReason}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.submittedDate}>
            Submitted: {formatDate(approval.submittedAt)}
          </Text>
          {approval.approvedAt && (
            <Text style={styles.approvedDate}>
              Approved: {formatDate(approval.approvedAt)}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Quick Actions */}
      {approval.status === EmployeeStatus.IN_PROGRESS && (
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.approveButton]}
            onPress={onQuickApprove}
          >
            <Ionicons name="checkmark" size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.rejectButton]}
            onPress={onQuickReject}
          >
            <Ionicons name="close" size={16} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  selectedContainer: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  checkbox: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
  },
  nameSection: {
    marginLeft: 12,
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tempId: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  permanentId: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
    marginLeft: 4,
  },
  statusSection: {
    alignItems: 'flex-end',
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  validationSection: {
    marginBottom: 12,
  },
  validationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  validationPercentage: {
    fontSize: 12,
    color: '#8E8E93',
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  validationCheckbox: {
    alignItems: 'center',
    flex: 1,
  },
  validationBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#C7C7CC',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  validationBoxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  validationLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  validationLabelChecked: {
    color: '#34C759',
  },
  rejectionSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF2F2',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  rejectionReason: {
    fontSize: 12,
    color: '#FF3B30',
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submittedDate: {
    fontSize: 11,
    color: '#8E8E93',
  },
  approvedDate: {
    fontSize: 11,
    color: '#34C759',
  },
  quickActions: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  quickActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
});