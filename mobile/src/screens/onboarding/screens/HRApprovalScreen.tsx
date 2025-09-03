/**
 * HR Approval Screen - HR verification and approval workflow
 * 
 * Features:
 * - Employee list view with status management (In Progress, Exist, Rejected)
 * - HR validation checkboxes (HR, ESI, PF, UAN)
 * - Status change from In Progress to Exist with Contract end date and Permanent ID
 * - Rejection workflow with reason entry
 * - Notifications for approvals/rejections
 * - Validation and verification controls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    user: { role: 'hr', id: 'HR001' }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    hr_approval_title: 'HR Approval Dashboard',
    hr_approval_subtitle: 'Review and approve employee onboarding',
    in_progress: 'In Progress',
    exist: 'Exist',
    rejected: 'Rejected',
    employee_details: 'Employee Details',
    approvals_validations: 'Approvals & Validations',
    status_management: 'Status Management',
    temp_id: 'Temp Employee ID',
    permanent_id: 'Permanent Employee ID',
    employee_name: 'Employee Name',
    profile_photo: 'Profile Photo',
    phone_number: 'Phone Number',
    status: 'Status',
    hr_validation: 'HR Validation',
    esi_validation: 'ESI Validation',
    pf_validation: 'PF Validation',
    uan_validation: 'UAN Validation',
    validated: 'Validated',
    pending: 'Pending',
    contract_end_date: 'Contract End Date',
    reason_for_rejection: 'Reason for Rejection',
    change_status_to_exist: 'Change Status to Exist',
    change_status_to_rejected: 'Change Status to Rejected',
    approve: 'Approve',
    reject: 'Reject',
    save_changes: 'Save Changes',
    cancel: 'Cancel',
    view_employee: 'View Employee',
    edit_employee: 'Edit Employee',
    basic_details: 'Basic Details',
    pan_number: 'PAN Number',
    aadhar_number: 'Aadhaar Number',
    date_of_birth: 'Date of Birth',
    address: 'Address',
    educational_details: 'Educational Details',
    employment_details: 'Employment Details',
    net_salary: 'Net Salary',
    designation: 'Designation',
    department: 'Department',
    dd_mm_yyyy: 'DD/MM/YYYY',
    required_field: 'This field is required',
    success_message: 'Changes saved successfully',
    error_message: 'Failed to save changes',
    confirmation_title: 'Confirm Action',
    approve_confirmation: 'Are you sure you want to approve this employee?',
    reject_confirmation: 'Are you sure you want to reject this employee?',
    status_change_confirmation: 'Are you sure you want to change the status?',
    notification_sent: 'Notification sent to field officer',
  };
  return texts[key] || key;
};

interface Employee {
  id: string;
  tempId: string;
  permanentId?: string;
  name: string;
  profilePhoto?: string;
  phoneNumber: string;
  email: string;
  panNumber: string;
  aadhaarNumber: string;
  dateOfBirth: string;
  address: string;
  designation: string;
  department: string;
  netSalary: number;
  status: 'in_progress' | 'exist' | 'rejected';
  validations: {
    hr: boolean;
    esi: boolean;
    pf: boolean;
    uan: boolean;
  };
  contractEndDate?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface HRApprovalData {
  selectedEmployee?: Employee;
  statusChange?: {
    newStatus: 'exist' | 'rejected';
    contractEndDate?: string;
    permanentId?: string;
    rejectionReason?: string;
  };
  timestamp: string;
}

export default function HRApprovalScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [activeTab, setActiveTab] = useState<'in_progress' | 'exist' | 'rejected'>('in_progress');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [statusChangeData, setStatusChangeData] = useState({
    newStatus: 'exist' as 'exist' | 'rejected',
    contractEndDate: '',
    permanentId: '',
    rejectionReason: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      // Mock data - in real app, would fetch from API
      const mockEmployees: Employee[] = [
        {
          id: '1',
          tempId: 'TMP001',
          name: 'John Doe',
          phoneNumber: '9876543210',
          email: 'john.doe@example.com',
          panNumber: 'ABCDE1234F',
          aadhaarNumber: '1234-5678-9012',
          dateOfBirth: '01/01/1990',
          address: '123 Main St, Bangalore',
          designation: 'Software Engineer',
          department: 'IT',
          netSalary: 50000,
          status: 'in_progress',
          validations: {
            hr: false,
            esi: false,
            pf: false,
            uan: false,
          },
          createdAt: '2024-01-15',
          updatedAt: '2024-01-15',
        },
        {
          id: '2',
          tempId: 'TMP002',
          permanentId: 'EMP001',
          name: 'Jane Smith',
          phoneNumber: '9876543211',
          email: 'jane.smith@example.com',
          panNumber: 'FGHIJ5678K',
          aadhaarNumber: '9876-5432-1098',
          dateOfBirth: '15/05/1992',
          address: '456 Park Ave, Bangalore',
          designation: 'Business Analyst',
          department: 'Operations',
          netSalary: 45000,
          status: 'exist',
          validations: {
            hr: true,
            esi: true,
            pf: true,
            uan: true,
          },
          contractEndDate: '20/01/2024',
          createdAt: '2024-01-10',
          updatedAt: '2024-01-20',
        },
        {
          id: '3',
          tempId: 'TMP003',
          name: 'Mike Johnson',
          phoneNumber: '9876543212',
          email: 'mike.johnson@example.com',
          panNumber: 'KLMNO9012P',
          aadhaarNumber: '5555-6666-7777',
          dateOfBirth: '30/08/1988',
          address: '789 Oak St, Bangalore',
          designation: 'Security Guard',
          department: 'Security',
          netSalary: 18000,
          status: 'rejected',
          validations: {
            hr: false,
            esi: false,
            pf: false,
            uan: false,
          },
          rejectionReason: 'Document verification failed - PAN card details do not match Aadhaar information',
          createdAt: '2024-01-12',
          updatedAt: '2024-01-18',
        },
      ];
      
      setEmployees(mockEmployees);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const getFilteredEmployees = () => {
    return employees.filter(emp => emp.status === activeTab);
  };

  const handleValidationToggle = (employeeId: string, validationType: keyof Employee['validations']) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === employeeId 
        ? { 
            ...emp, 
            validations: { 
              ...emp.validations, 
              [validationType]: !emp.validations[validationType] 
            },
            updatedAt: new Date().toISOString().split('T')[0]
          }
        : emp
    ));

    // Send notification for validation changes
    Alert.alert(
      'Validation Updated',
      `${validationType.toUpperCase()} validation has been ${employees.find(e => e.id === employeeId)?.validations[validationType] ? 'removed' : 'added'}`
    );
  };

  const handleStatusChange = (employee: Employee, newStatus: 'exist' | 'rejected') => {
    setSelectedEmployee(employee);
    setStatusChangeData({
      newStatus,
      contractEndDate: newStatus === 'exist' ? new Date().toLocaleDateString('en-GB') : '',
      permanentId: newStatus === 'exist' ? `EMP${String(employees.length + 1).padStart(3, '0')}` : '',
      rejectionReason: '',
    });
    setShowStatusChange(true);
  };

  const validateStatusChange = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (statusChangeData.newStatus === 'exist') {
      if (!statusChangeData.contractEndDate.trim()) {
        newErrors.contractEndDate = getLocalizedText('required_field', language);
      }
      if (!statusChangeData.permanentId.trim()) {
        newErrors.permanentId = getLocalizedText('required_field', language);
      }
    } else if (statusChangeData.newStatus === 'rejected') {
      if (!statusChangeData.rejectionReason.trim()) {
        newErrors.rejectionReason = getLocalizedText('required_field', language);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const confirmStatusChange = () => {
    if (!validateStatusChange()) return;

    const action = statusChangeData.newStatus === 'exist' ? 'approve' : 'reject';
    const message = getLocalizedText(`${action}_confirmation`, language);

    Alert.alert(
      getLocalizedText('confirmation_title', language),
      message,
      [
        { text: getLocalizedText('cancel', language), style: 'cancel' },
        {
          text: getLocalizedText(action, language),
          style: statusChangeData.newStatus === 'rejected' ? 'destructive' : 'default',
          onPress: executeStatusChange,
        },
      ]
    );
  };

  const executeStatusChange = async () => {
    if (!selectedEmployee) return;

    try {
      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id 
          ? { 
              ...emp, 
              status: statusChangeData.newStatus,
              contractEndDate: statusChangeData.contractEndDate || undefined,
              permanentId: statusChangeData.permanentId || undefined,
              rejectionReason: statusChangeData.rejectionReason || undefined,
              updatedAt: new Date().toISOString().split('T')[0]
            }
          : emp
      ));

      // Close modal
      setShowStatusChange(false);
      setSelectedEmployee(null);

      // Show success message
      Alert.alert(
        getLocalizedText('success_message', language),
        getLocalizedText('notification_sent', language)
      );

      // Switch to appropriate tab
      setActiveTab(statusChangeData.newStatus);

    } catch (error) {
      console.error('Failed to change status:', error);
      Alert.alert('Error', getLocalizedText('error_message', language));
    }
  };

  const renderEmployeeCard = ({ item: employee }: { item: Employee }) => (
    <View style={styles.employeeCard}>
      <View style={styles.employeeHeader}>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{employee.name}</Text>
          <Text style={styles.employeeDetail}>
            {getLocalizedText('temp_id', language)}: {employee.tempId}
          </Text>
          {employee.permanentId && (
            <Text style={styles.employeeDetail}>
              {getLocalizedText('permanent_id', language)}: {employee.permanentId}
            </Text>
          )}
          <Text style={styles.employeeDetail}>
            {getLocalizedText('phone_number', language)}: {employee.phoneNumber}
          </Text>
        </View>
        <View style={[styles.statusBadge, styles[`status${employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}` as keyof typeof styles]]}>
          <Text style={styles.statusText}>
            {getLocalizedText(employee.status, language)}
          </Text>
        </View>
      </View>

      {/* Validation Checkboxes */}
      <View style={styles.validationContainer}>
        <Text style={styles.validationTitle}>
          {getLocalizedText('approvals_validations', language)}
        </Text>
        <View style={styles.validationGrid}>
          {(['hr', 'esi', 'pf', 'uan'] as const).map((validation) => (
            <TouchableOpacity
              key={validation}
              style={styles.validationItem}
              onPress={() => handleValidationToggle(employee.id, validation)}
              disabled={employee.status !== 'in_progress'}
            >
              <Text style={styles.checkbox}>
                {employee.validations[validation] ? '✅' : '☑️'}
              </Text>
              <Text style={styles.validationLabel}>
                {getLocalizedText(`${validation}_validation`, language)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => {
            setSelectedEmployee(employee);
            setShowEmployeeDetails(true);
          }}
        >
          <Text style={styles.viewButtonText}>
            {getLocalizedText('view_employee', language)}
          </Text>
        </TouchableOpacity>

        {employee.status === 'in_progress' && (
          <>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => handleStatusChange(employee, 'exist')}
            >
              <Text style={styles.approveButtonText}>
                {getLocalizedText('approve', language)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleStatusChange(employee, 'rejected')}
            >
              <Text style={styles.rejectButtonText}>
                {getLocalizedText('reject', language)}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {employee.status === 'exist' && userData?.user?.role === 'hr' && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setSelectedEmployee(employee);
              setShowEmployeeDetails(true);
            }}
          >
            <Text style={styles.editButtonText}>
              {getLocalizedText('edit_employee', language)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Rejection Reason */}
      {employee.status === 'rejected' && employee.rejectionReason && (
        <View style={styles.rejectionContainer}>
          <Text style={styles.rejectionTitle}>
            {getLocalizedText('reason_for_rejection', language)}:
          </Text>
          <Text style={styles.rejectionText}>
            {employee.rejectionReason}
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmployeeDetailsModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <Text style={styles.modalTitle}>
          {getLocalizedText('employee_details', language)}
        </Text>

        <ScrollView style={styles.modalContent}>
          {selectedEmployee && (
            <>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  {getLocalizedText('basic_details', language)}
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {getLocalizedText('employee_name', language)}:
                  </Text>
                  <Text style={styles.detailValue}>{selectedEmployee.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {getLocalizedText('pan_number', language)}:
                  </Text>
                  <Text style={styles.detailValue}>{selectedEmployee.panNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {getLocalizedText('aadhar_number', language)}:
                  </Text>
                  <Text style={styles.detailValue}>{selectedEmployee.aadhaarNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {getLocalizedText('date_of_birth', language)}:
                  </Text>
                  <Text style={styles.detailValue}>{selectedEmployee.dateOfBirth}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  {getLocalizedText('employment_details', language)}
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {getLocalizedText('designation', language)}:
                  </Text>
                  <Text style={styles.detailValue}>{selectedEmployee.designation}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {getLocalizedText('department', language)}:
                  </Text>
                  <Text style={styles.detailValue}>{selectedEmployee.department}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {getLocalizedText('net_salary', language)}:
                  </Text>
                  <Text style={styles.detailValue}>₹{selectedEmployee.netSalary.toLocaleString()}</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => {
              setShowEmployeeDetails(false);
              setSelectedEmployee(null);
            }}
          >
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderStatusChangeModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <Text style={styles.modalTitle}>
          {getLocalizedText('status_management', language)}
        </Text>

        <ScrollView style={styles.modalContent}>
          {selectedEmployee && (
            <>
              <Text style={styles.selectedEmployeeName}>
                {selectedEmployee.name} ({selectedEmployee.tempId})
              </Text>

              {statusChangeData.newStatus === 'exist' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      {getLocalizedText('contract_end_date', language)} *
                    </Text>
                    <TextInput
                      style={[styles.textInput, errors.contractEndDate ? styles.inputError : null]}
                      value={statusChangeData.contractEndDate}
                      onChangeText={(text) => setStatusChangeData(prev => ({ ...prev, contractEndDate: text }))}
                      placeholder={getLocalizedText('dd_mm_yyyy', language)}
                    />
                    {errors.contractEndDate && (
                      <Text style={styles.errorText}>{errors.contractEndDate}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      {getLocalizedText('permanent_id', language)} *
                    </Text>
                    <TextInput
                      style={[styles.textInput, errors.permanentId ? styles.inputError : null]}
                      value={statusChangeData.permanentId}
                      onChangeText={(text) => setStatusChangeData(prev => ({ ...prev, permanentId: text }))}
                      placeholder="Enter permanent employee ID"
                    />
                    {errors.permanentId && (
                      <Text style={styles.errorText}>{errors.permanentId}</Text>
                    )}
                  </View>
                </>
              )}

              {statusChangeData.newStatus === 'rejected' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    {getLocalizedText('reason_for_rejection', language)} *
                  </Text>
                  <TextInput
                    style={[styles.textArea, errors.rejectionReason ? styles.inputError : null]}
                    value={statusChangeData.rejectionReason}
                    onChangeText={(text) => setStatusChangeData(prev => ({ ...prev, rejectionReason: text }))}
                    placeholder="Enter detailed reason for rejection"
                    multiline
                    numberOfLines={4}
                  />
                  {errors.rejectionReason && (
                    <Text style={styles.errorText}>{errors.rejectionReason}</Text>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => {
              setShowStatusChange(false);
              setSelectedEmployee(null);
              setErrors({});
            }}
          >
            <Text style={styles.modalCancelButtonText}>
              {getLocalizedText('cancel', language)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modalConfirmButton,
              statusChangeData.newStatus === 'rejected' && styles.modalRejectButton
            ]}
            onPress={confirmStatusChange}
          >
            <Text style={styles.modalConfirmButtonText}>
              {statusChangeData.newStatus === 'exist' 
                ? getLocalizedText('approve', language)
                : getLocalizedText('reject', language)
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('hr_approval_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('hr_approval_subtitle', language)}
        </Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['in_progress', 'exist', 'rejected'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {getLocalizedText(tab, language)}
            </Text>
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {employees.filter(emp => emp.status === tab).length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Employee List */}
      <FlatList
        data={getFilteredEmployees()}
        renderItem={renderEmployeeCard}
        keyExtractor={(item) => item.id}
        style={styles.employeeList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No employees found in {getLocalizedText(activeTab, language)} status
            </Text>
          </View>
        )}
      />

      {/* Modals */}
      {showEmployeeDetails && renderEmployeeDetailsModal()}
      {showStatusChange && renderStatusChangeModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 16,
    color: '#757575',
    marginRight: 8,
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 12,
    color: '#424242',
    fontWeight: '500',
  },
  employeeList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  employeeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  employeeDetail: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  statusInProgress: {
    backgroundColor: '#FFF3E0',
  },
  statusExist: {
    backgroundColor: '#E8F5E8',
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  validationContainer: {
    marginBottom: 16,
  },
  validationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 12,
  },
  validationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  checkbox: {
    fontSize: 16,
    marginRight: 8,
  },
  validationLabel: {
    fontSize: 14,
    color: '#424242',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  viewButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '500',
  },
  approveButton: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  approveButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  rejectButton: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  rejectButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
  rejectionContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F44336',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalContent: {
    maxHeight: 400,
  },
  selectedEmployeeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#424242',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCloseButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#757575',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#757575',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modalRejectButton: {
    backgroundColor: '#F44336',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});