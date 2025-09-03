/**
 * Rejection Modal Component - Handle approval rejections with detailed reasons
 * Provides categorized rejection reasons and custom input
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmployeeApprovalSummary } from '../../../types/approval';

interface RejectionModalProps {
  visible: boolean;
  employee: EmployeeApprovalSummary | null;
  onClose: () => void;
  onReject: (employee: EmployeeApprovalSummary, reason: string, category: string) => void;
}

// Predefined rejection categories and reasons
const REJECTION_CATEGORIES = [
  {
    id: 'documents',
    label: 'Document Issues',
    icon: 'document-text-outline',
    color: '#FF9500',
    reasons: [
      'Missing Aadhaar card',
      'Invalid PAN card details',
      'Blurred or unclear documents',
      'Document verification failed',
      'Expired documents',
      'Mismatched information across documents'
    ]
  },
  {
    id: 'personal_info',
    label: 'Personal Information',
    icon: 'person-outline',
    color: '#007AFF',
    reasons: [
      'Incomplete personal details',
      'Invalid contact information',
      'Address verification failed',
      'Age criteria not met',
      'Educational qualification mismatch'
    ]
  },
  {
    id: 'statutory',
    label: 'Statutory Compliance',
    icon: 'shield-outline',
    color: '#34C759',
    reasons: [
      'ESI registration issues',
      'PF account verification failed',
      'UAN details incorrect',
      'Previous employment conflicts',
      'Statutory form incomplete'
    ]
  },
  {
    id: 'background',
    label: 'Background Verification',
    icon: 'search-outline',
    color: '#FF3B30',
    reasons: [
      'Previous employer verification failed',
      'Employment gap concerns',
      'Reference check issues',
      'Criminal background check failed',
      'Credit history concerns'
    ]
  },
  {
    id: 'medical',
    label: 'Medical/Health',
    icon: 'medical-outline',
    color: '#AF52DE',
    reasons: [
      'Medical fitness certificate missing',
      'Health screening failed',
      'Pre-existing condition concerns',
      'Vaccination records incomplete',
      'Medical examination pending'
    ]
  },
  {
    id: 'policy',
    label: 'Policy Violations',
    icon: 'warning-outline',
    color: '#FF6B6B',
    reasons: [
      'Company policy violations',
      'Conflict of interest',
      'Previous termination record',
      'Non-compete agreement issues',
      'Ethics code violations'
    ]
  }
];

export const RejectionModal: React.FC<RejectionModalProps> = ({
  visible,
  employee,
  onClose,
  onReject,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');

  // Reset state when modal closes
  React.useEffect(() => {
    if (!visible) {
      setSelectedCategory(null);
      setSelectedReason(null);
      setCustomReason('');
      setAdditionalComments('');
    }
  }, [visible]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedReason(null);
  };

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    setCustomReason('');
  };

  const handleCustomReasonChange = (text: string) => {
    setCustomReason(text);
    setSelectedReason(null);
  };

  const handleReject = () => {
    const finalReason = selectedReason || customReason.trim();
    
    if (!finalReason) {
      Alert.alert('Error', 'Please select or enter a rejection reason');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a rejection category');
      return;
    }

    if (!employee) return;

    const category = REJECTION_CATEGORIES.find(cat => cat.id === selectedCategory);
    const fullReason = additionalComments.trim() 
      ? `${finalReason}\n\nAdditional Comments: ${additionalComments.trim()}`
      : finalReason;

    onReject(employee, fullReason, category?.label || 'Other');
    onClose();
  };

  const selectedCategoryData = REJECTION_CATEGORIES.find(cat => cat.id === selectedCategory);

  if (!employee) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Reject Application</Text>
          <TouchableOpacity 
            onPress={handleReject}
            disabled={!selectedCategory || (!selectedReason && !customReason.trim())}
          >
            <Text style={[
              styles.rejectButton,
              (!selectedCategory || (!selectedReason && !customReason.trim())) && styles.rejectButtonDisabled
            ]}>
              Reject
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Employee Info */}
          <View style={styles.employeeSection}>
            <Text style={styles.sectionTitle}>Employee Details</Text>
            <View style={styles.employeeCard}>
              <Text style={styles.employeeName}>{employee.name}</Text>
              <Text style={styles.employeePhone}>{employee.phoneNumber}</Text>
              <Text style={styles.employeeTempId}>Temp ID: {employee.tempId}</Text>
            </View>
          </View>

          {/* Rejection Categories */}
          <View style={styles.categoriesSection}>
            <Text style={styles.sectionTitle}>Rejection Category</Text>
            <View style={styles.categoriesGrid}>
              {REJECTION_CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      isSelected && { 
                        backgroundColor: `${category.color}20`,
                        borderColor: category.color
                      }
                    ]}
                    onPress={() => handleCategorySelect(category.id)}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                      <Ionicons name={category.icon as any} size={20} color={category.color} />
                    </View>
                    <Text style={[
                      styles.categoryLabel,
                      isSelected && { color: category.color }
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Rejection Reasons */}
          {selectedCategoryData && (
            <View style={styles.reasonsSection}>
              <Text style={styles.sectionTitle}>Rejection Reason</Text>
              
              {/* Predefined Reasons */}
              <View style={styles.reasonsList}>
                {selectedCategoryData.reasons.map((reason, index) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.reasonItem,
                        isSelected && styles.reasonItemSelected
                      ]}
                      onPress={() => handleReasonSelect(reason)}
                    >
                      <View style={[
                        styles.reasonCheckbox,
                        isSelected && styles.reasonCheckboxSelected
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>
                      <Text style={[
                        styles.reasonText,
                        isSelected && styles.reasonTextSelected
                      ]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Reason Input */}
              <View style={styles.customReasonSection}>
                <Text style={styles.customReasonLabel}>Or enter custom reason:</Text>
                <TextInput
                  style={styles.customReasonInput}
                  placeholder="Describe the specific reason for rejection..."
                  value={customReason}
                  onChangeText={handleCustomReasonChange}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Additional Comments */}
              <View style={styles.commentsSection}>
                <Text style={styles.commentsLabel}>Additional Comments (Optional):</Text>
                <TextInput
                  style={styles.commentsInput}
                  placeholder="Any additional notes or guidance for the applicant..."
                  value={additionalComments}
                  onChangeText={setAdditionalComments}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  cancelButton: {
    fontSize: 16,
    color: '#8E8E93',
  },
  rejectButton: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  rejectButtonDisabled: {
    color: '#C7C7CC',
  },
  modalContent: {
    flex: 1,
  },
  employeeSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  employeeCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  employeePhone: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  employeeTempId: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  categoriesSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    padding: 12,
    marginHorizontal: '1%',
    marginVertical: 4,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  reasonsSection: {
    padding: 16,
  },
  reasonsList: {
    marginBottom: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  reasonItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  reasonCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reasonCheckboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  reasonTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  customReasonSection: {
    marginBottom: 20,
  },
  customReasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 80,
    backgroundColor: 'white',
  },
  commentsSection: {
    marginBottom: 20,
  },
  commentsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  commentsInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 80,
    backgroundColor: 'white',
  },
});