/**
 * UAN & ESIC Portal Integration Module with Verification APIs
 * 
 * Features:
 * - UAN (Universal Account Number) verification and validation
 * - ESIC portal integration for employee registration
 * - PF account linking and transfer processing
 * - ESIC medical benefit activation
 * - Real-time API verification with government portals
 * - Document upload and KYC verification
 * - Nomination management for PF and ESIC
 * - Transfer claims and settlement processing
 * - Compliance status tracking and reporting
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import UI components
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';

// Mock implementations for dependencies
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      firstName: 'John',
      lastName: 'Doe',
      employeeId: 'EMP001',
      dateOfBirth: '1990-01-15',
      fatherName: 'Father Name',
      gender: 'Male',
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F'
    },
    workDetails: {
      branchCode: 'BLR001',
      siteCode: 'SITE_BLR_001',
      joiningDate: '2024-01-15',
      previousEmployment: {
        companyName: 'Previous Company',
        pfNumber: 'PF12345678',
        uanNumber: 'UAN123456789012',
        esiNumber: 'ESI9876543210',
        dateOfLeaving: '2023-12-31'
      }
    },
    bankingData: {
      accountNumber: '1234567890',
      ifscCode: 'HDFC0000123',
      bankName: 'HDFC Bank',
      branchName: 'Bangalore Main'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    integration_title: 'UAN & ESIC Integration',
    integration_subtitle: 'Link your PF and ESIC accounts for seamless benefits',
    
    // UAN Section
    uan_verification: 'UAN Verification',
    uan_number: 'UAN Number',
    verify_uan: 'Verify UAN',
    uan_status: 'UAN Status',
    uan_linked: 'UAN Linked Successfully',
    uan_not_found: 'UAN Not Found',
    uan_mismatch: 'Details Mismatch',
    
    // ESIC Section
    esic_registration: 'ESIC Registration',
    esic_number: 'ESIC Number',
    verify_esic: 'Verify ESIC',
    esic_status: 'ESIC Status',
    esic_active: 'ESIC Account Active',
    esic_inactive: 'ESIC Account Inactive',
    esic_new_registration: 'New ESIC Registration',
    
    // PF Transfer
    pf_transfer: 'PF Account Transfer',
    previous_pf_number: 'Previous PF Number',
    previous_establishment: 'Previous Establishment',
    transfer_request: 'Transfer Request',
    transfer_status: 'Transfer Status',
    transfer_pending: 'Transfer Pending',
    transfer_completed: 'Transfer Completed',
    
    // KYC Verification
    kyc_verification: 'KYC Verification',
    aadhaar_verification: 'Aadhaar Verification',
    pan_verification: 'PAN Verification',
    bank_verification: 'Bank Account Verification',
    kyc_status: 'KYC Status',
    kyc_pending: 'KYC Pending',
    kyc_verified: 'KYC Verified',
    kyc_failed: 'KYC Failed',
    
    // Nomination Management
    nomination_management: 'Nomination Management',
    pf_nominee: 'PF Nominee',
    esic_nominee: 'ESIC Nominee',
    nominee_name: 'Nominee Name',
    nominee_relationship: 'Relationship',
    nominee_share: 'Share Percentage',
    nominee_aadhaar: 'Nominee Aadhaar',
    
    // API Integration Status
    api_integration: 'API Integration Status',
    epfo_api_status: 'EPFO API Status',
    esic_api_status: 'ESIC API Status',
    real_time_verification: 'Real-time Verification',
    batch_processing: 'Batch Processing',
    
    // Document Upload
    document_upload: 'Document Upload',
    aadhaar_card: 'Aadhaar Card',
    pan_card: 'PAN Card',
    bank_passbook: 'Bank Passbook',
    previous_pf_statement: 'Previous PF Statement',
    esic_card: 'ESIC Card',
    
    // Compliance Status
    compliance_status: 'Compliance Status',
    epf_compliance: 'EPF Compliance',
    esic_compliance: 'ESIC Compliance',
    statutory_compliance: 'Statutory Compliance',
    government_portal_sync: 'Government Portal Sync',
    
    // Error Messages
    uan_invalid: 'Invalid UAN format',
    esic_invalid: 'Invalid ESIC number format',
    api_error: 'API verification failed',
    network_error: 'Network connection error',
    verification_failed: 'Verification failed',
    
    // Success Messages
    verification_success: 'Verification successful',
    integration_complete: 'Integration completed',
    transfer_initiated: 'Transfer request initiated',
    registration_success: 'Registration successful',
    
    // Actions
    verify_now: 'Verify Now',
    initiate_transfer: 'Initiate Transfer',
    register_new: 'Register New',
    upload_documents: 'Upload Documents',
    sync_portals: 'Sync Portals',
    continue: 'Continue',
    
    // Help Text
    uan_help: 'UAN is a 12-digit unique number for PF account',
    esic_help: 'ESIC number is a 10-digit number for medical benefits',
    transfer_help: 'Transfer your previous PF balance to new account',
    kyc_help: 'Complete KYC for seamless benefit processing',
    
    // Relationship Options
    spouse: 'Spouse',
    father: 'Father',
    mother: 'Mother',
    son: 'Son',
    daughter: 'Daughter',
    brother: 'Brother',
    sister: 'Sister',
    
    // API Status
    api_connected: 'Connected',
    api_disconnected: 'Disconnected',
    api_maintenance: 'Under Maintenance',
    api_timeout: 'Timeout',
    
    // Processing Status
    processing: 'Processing...',
    validating: 'Validating...',
    syncing: 'Syncing...',
    completed: 'Completed',
    failed: 'Failed',
  };
  
  return texts[key] || key;
};

interface UANDetails {
  uanNumber: string;
  isVerified: boolean;
  employeeName: string;
  fatherName: string;
  dateOfBirth: string;
  joiningDate: string;
  pfBalance: number;
  lastContribution: string;
  establishmentName: string;
  establishmentCode: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface ESICDetails {
  esicNumber: string;
  isVerified: boolean;
  employeeName: string;
  ipNumber: string;
  dispatchingOffice: string;
  medicalBenefitActivated: boolean;
  cashBenefitActivated: boolean;
  familyMembersAdded: number;
  lastContribution: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface PFTransferDetails {
  previousPFNumber: string;
  previousEstablishment: string;
  currentPFNumber: string;
  transferAmount: number;
  transferRequestDate: string;
  transferStatus: 'pending' | 'approved' | 'completed' | 'rejected';
  approvalDate?: string;
  completionDate?: string;
  transferId: string;
}

interface NomineeDetails {
  name: string;
  relationship: string;
  aadhaarNumber: string;
  sharePercentage: number;
  dateOfBirth: string;
  address: string;
}

interface KYCStatus {
  aadhaarVerified: boolean;
  panVerified: boolean;
  bankVerified: boolean;
  documentsUploaded: boolean;
  biometricVerified: boolean;
  overallStatus: 'pending' | 'verified' | 'failed';
}

interface APIStatus {
  epfoAPI: 'connected' | 'disconnected' | 'maintenance' | 'timeout';
  esicAPI: 'connected' | 'disconnected' | 'maintenance' | 'timeout';
  lastSyncTime: string;
  syncFrequency: 'real-time' | 'hourly' | 'daily';
  errorCount: number;
}

interface IntegrationData {
  uanDetails: UANDetails;
  esicDetails: ESICDetails;
  pfTransfer: PFTransferDetails;
  pfNominee: NomineeDetails[];
  esicNominee: NomineeDetails[];
  kycStatus: KYCStatus;
  apiStatus: APIStatus;
  documentsUploaded: { [key: string]: boolean };
  complianceStatus: { [key: string]: boolean };
  integrationComplete: boolean;
  timestamp: string;
}

export default function UANESICIntegrationScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [integrationData, setIntegrationData] = useState<IntegrationData>({
    uanDetails: {
      uanNumber: '',
      isVerified: false,
      employeeName: '',
      fatherName: '',
      dateOfBirth: '',
      joiningDate: '',
      pfBalance: 0,
      lastContribution: '',
      establishmentName: '',
      establishmentCode: '',
      status: 'inactive',
    },
    esicDetails: {
      esicNumber: '',
      isVerified: false,
      employeeName: '',
      ipNumber: '',
      dispatchingOffice: '',
      medicalBenefitActivated: false,
      cashBenefitActivated: false,
      familyMembersAdded: 0,
      lastContribution: '',
      status: 'inactive',
    },
    pfTransfer: {
      previousPFNumber: '',
      previousEstablishment: '',
      currentPFNumber: '',
      transferAmount: 0,
      transferRequestDate: '',
      transferStatus: 'pending',
      transferId: '',
    },
    pfNominee: [],
    esicNominee: [],
    kycStatus: {
      aadhaarVerified: false,
      panVerified: false,
      bankVerified: false,
      documentsUploaded: false,
      biometricVerified: false,
      overallStatus: 'pending',
    },
    apiStatus: {
      epfoAPI: 'disconnected',
      esicAPI: 'disconnected',
      lastSyncTime: '',
      syncFrequency: 'real-time',
      errorCount: 0,
    },
    documentsUploaded: {},
    complianceStatus: {},
    integrationComplete: false,
    timestamp: '',
  });
  
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showNomineeModal, setShowNomineeModal] = useState(false);
  const [nomineeType, setNomineeType] = useState<'pf' | 'esic'>('pf');
  const [newNominee, setNewNominee] = useState<Partial<NomineeDetails>>({});

  useEffect(() => {
    checkAPIStatus();
    loadExistingData();
  }, []);

  const checkAPIStatus = async () => {
    setLoading(prev => ({ ...prev, apiStatus: true }));
    
    try {
      // Mock API status check
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIntegrationData(prev => ({
        ...prev,
        apiStatus: {
          epfoAPI: 'connected',
          esicAPI: 'connected',
          lastSyncTime: new Date().toISOString(),
          syncFrequency: 'real-time',
          errorCount: 0,
        },
      }));
    } catch (error) {
      setIntegrationData(prev => ({
        ...prev,
        apiStatus: {
          ...prev.apiStatus,
          epfoAPI: 'disconnected',
          esicAPI: 'disconnected',
          errorCount: prev.apiStatus.errorCount + 1,
        },
      }));
    } finally {
      setLoading(prev => ({ ...prev, apiStatus: false }));
    }
  };

  const loadExistingData = () => {
    // Pre-populate with existing data if available
    if (userData?.workDetails?.previousEmployment) {
      const { previousEmployment } = userData.workDetails;
      setIntegrationData(prev => ({
        ...prev,
        uanDetails: {
          ...prev.uanDetails,
          uanNumber: previousEmployment.uanNumber || '',
        },
        esicDetails: {
          ...prev.esicDetails,
          esicNumber: previousEmployment.esiNumber || '',
        },
        pfTransfer: {
          ...prev.pfTransfer,
          previousPFNumber: previousEmployment.pfNumber || '',
          previousEstablishment: previousEmployment.companyName || '',
        },
      }));
    }
  };

  const verifyUAN = async () => {
    if (!integrationData.uanDetails.uanNumber) {
      setErrors(prev => ({ ...prev, uan: 'UAN number is required' }));
      return;
    }

    // Validate UAN format (12 digits)
    if (!/^\d{12}$/.test(integrationData.uanDetails.uanNumber)) {
      setErrors(prev => ({ ...prev, uan: getLocalizedText('uan_invalid', language) }));
      return;
    }

    setLoading(prev => ({ ...prev, uan: true }));
    setErrors(prev => ({ ...prev, uan: '' }));

    try {
      // Mock UAN verification API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock successful verification
      const mockUANData: UANDetails = {
        uanNumber: integrationData.uanDetails.uanNumber,
        isVerified: true,
        employeeName: userData?.personalData?.firstName + ' ' + userData?.personalData?.lastName || '',
        fatherName: userData?.personalData?.fatherName || '',
        dateOfBirth: userData?.personalData?.dateOfBirth || '',
        joiningDate: userData?.workDetails?.joiningDate || '',
        pfBalance: 45000,
        lastContribution: '2023-12-31',
        establishmentName: 'Previous Company Pvt Ltd',
        establishmentCode: 'KN/BLR/12345',
        status: 'active',
      };

      setIntegrationData(prev => ({
        ...prev,
        uanDetails: mockUANData,
        kycStatus: {
          ...prev.kycStatus,
          aadhaarVerified: true,
          panVerified: true,
        },
      }));

      Alert.alert('Success', getLocalizedText('verification_success', language));
    } catch (error) {
      setErrors(prev => ({ ...prev, uan: getLocalizedText('api_error', language) }));
    } finally {
      setLoading(prev => ({ ...prev, uan: false }));
    }
  };

  const verifyESIC = async () => {
    if (!integrationData.esicDetails.esicNumber) {
      setErrors(prev => ({ ...prev, esic: 'ESIC number is required' }));
      return;
    }

    // Validate ESIC format (10 digits)
    if (!/^\d{10}$/.test(integrationData.esicDetails.esicNumber)) {
      setErrors(prev => ({ ...prev, esic: getLocalizedText('esic_invalid', language) }));
      return;
    }

    setLoading(prev => ({ ...prev, esic: true }));
    setErrors(prev => ({ ...prev, esic: '' }));

    try {
      // Mock ESIC verification API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const mockESICData: ESICDetails = {
        esicNumber: integrationData.esicDetails.esicNumber,
        isVerified: true,
        employeeName: userData?.personalData?.firstName + ' ' + userData?.personalData?.lastName || '',
        ipNumber: 'IP001234567',
        dispatchingOffice: 'Bangalore ESIC Office',
        medicalBenefitActivated: true,
        cashBenefitActivated: true,
        familyMembersAdded: 2,
        lastContribution: '2023-12-31',
        status: 'active',
      };

      setIntegrationData(prev => ({
        ...prev,
        esicDetails: mockESICData,
        kycStatus: {
          ...prev.kycStatus,
          bankVerified: true,
        },
      }));

      Alert.alert('Success', getLocalizedText('verification_success', language));
    } catch (error) {
      setErrors(prev => ({ ...prev, esic: getLocalizedText('api_error', language) }));
    } finally {
      setLoading(prev => ({ ...prev, esic: false }));
    }
  };

  const initiatePFTransfer = async () => {
    if (!integrationData.pfTransfer.previousPFNumber || !integrationData.uanDetails.isVerified) {
      Alert.alert('Error', 'Please verify UAN and provide previous PF number');
      return;
    }

    setLoading(prev => ({ ...prev, pfTransfer: true }));

    try {
      // Mock PF transfer initiation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const transferId = 'TXN' + Date.now();
      
      setIntegrationData(prev => ({
        ...prev,
        pfTransfer: {
          ...prev.pfTransfer,
          transferRequestDate: new Date().toISOString().split('T')[0],
          transferStatus: 'pending',
          transferId,
          currentPFNumber: 'KN/BLR/54321/' + userData?.personalData?.employeeId,
          transferAmount: prev.uanDetails.pfBalance,
        },
      }));

      Alert.alert('Success', getLocalizedText('transfer_initiated', language));
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate transfer');
    } finally {
      setLoading(prev => ({ ...prev, pfTransfer: false }));
    }
  };

  const addNominee = () => {
    if (!newNominee.name || !newNominee.relationship || !newNominee.sharePercentage) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const nominee: NomineeDetails = {
      name: newNominee.name!,
      relationship: newNominee.relationship!,
      aadhaarNumber: newNominee.aadhaarNumber || '',
      sharePercentage: newNominee.sharePercentage!,
      dateOfBirth: newNominee.dateOfBirth || '',
      address: newNominee.address || '',
    };

    if (nomineeType === 'pf') {
      setIntegrationData(prev => ({
        ...prev,
        pfNominee: [...prev.pfNominee, nominee],
      }));
    } else {
      setIntegrationData(prev => ({
        ...prev,
        esicNominee: [...prev.esicNominee, nominee],
      }));
    }

    setNewNominee({});
    setShowNomineeModal(false);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Check if critical verifications are done
    if (!integrationData.uanDetails.isVerified) {
      newErrors.integration = 'UAN verification required';
    }

    if (!integrationData.esicDetails.isVerified) {
      newErrors.integration = 'ESIC verification required';
    }

    // Check API connectivity
    if (integrationData.apiStatus.epfoAPI !== 'connected' || 
        integrationData.apiStatus.esicAPI !== 'connected') {
      newErrors.api = 'API connectivity issues detected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalData: IntegrationData = {
      ...integrationData,
      integrationComplete: true,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `integration_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ integrationData: finalData });
    } catch (error) {
      console.error('Failed to save integration data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const renderAPIStatus = () => (
    <Card title={getLocalizedText('api_integration', language)} variant="outlined" margin={8}>
      <View style={styles.apiStatusContainer}>
        <View style={styles.apiRow}>
          <Text style={styles.apiLabel}>EPFO API:</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: integrationData.apiStatus.epfoAPI === 'connected' ? '#4CAF50' : '#F44336'
          }]}>
            <Text style={styles.statusText}>
              {getLocalizedText(`api_${integrationData.apiStatus.epfoAPI}`, language)}
            </Text>
          </View>
        </View>

        <View style={styles.apiRow}>
          <Text style={styles.apiLabel}>ESIC API:</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: integrationData.apiStatus.esicAPI === 'connected' ? '#4CAF50' : '#F44336'
          }]}>
            <Text style={styles.statusText}>
              {getLocalizedText(`api_${integrationData.apiStatus.esicAPI}`, language)}
            </Text>
          </View>
        </View>

        {integrationData.apiStatus.lastSyncTime && (
          <Text style={styles.syncInfo}>
            Last Sync: {new Date(integrationData.apiStatus.lastSyncTime).toLocaleString()}
          </Text>
        )}

        {loading.apiStatus && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.loadingText}>Checking API status...</Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderUANSection = () => (
    <Card title={getLocalizedText('uan_verification', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('uan_help', language)}
      </Text>

      <Input
        label={getLocalizedText('uan_number', language)}
        value={integrationData.uanDetails.uanNumber}
        onChangeText={(text) => setIntegrationData(prev => ({
          ...prev,
          uanDetails: { ...prev.uanDetails, uanNumber: text }
        }))}
        placeholder="123456789012"
        keyboardType="numeric"
        maxLength={12}
        error={errors.uan}
      />

      <Button
        title={getLocalizedText('verify_uan', language)}
        onPress={verifyUAN}
        variant="primary"
        size="medium"
        loading={loading.uan}
        disabled={!integrationData.uanDetails.uanNumber || loading.uan}
      />

      {integrationData.uanDetails.isVerified && (
        <View style={styles.verifiedSection}>
          <Text style={styles.verifiedTitle}>UAN Verification Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Employee Name:</Text>
            <Text style={styles.detailValue}>{integrationData.uanDetails.employeeName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>PF Balance:</Text>
            <Text style={styles.detailValue}>₹{integrationData.uanDetails.pfBalance.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Establishment:</Text>
            <Text style={styles.detailValue}>{integrationData.uanDetails.establishmentName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
        </View>
      )}
    </Card>
  );

  const renderESICSection = () => (
    <Card title={getLocalizedText('esic_registration', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('esic_help', language)}
      </Text>

      <Input
        label={getLocalizedText('esic_number', language)}
        value={integrationData.esicDetails.esicNumber}
        onChangeText={(text) => setIntegrationData(prev => ({
          ...prev,
          esicDetails: { ...prev.esicDetails, esicNumber: text }
        }))}
        placeholder="1234567890"
        keyboardType="numeric"
        maxLength={10}
        error={errors.esic}
      />

      <Button
        title={getLocalizedText('verify_esic', language)}
        onPress={verifyESIC}
        variant="primary"
        size="medium"
        loading={loading.esic}
        disabled={!integrationData.esicDetails.esicNumber || loading.esic}
      />

      {integrationData.esicDetails.isVerified && (
        <View style={styles.verifiedSection}>
          <Text style={styles.verifiedTitle}>ESIC Verification Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Employee Name:</Text>
            <Text style={styles.detailValue}>{integrationData.esicDetails.employeeName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>IP Number:</Text>
            <Text style={styles.detailValue}>{integrationData.esicDetails.ipNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Medical Benefits:</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: integrationData.esicDetails.medicalBenefitActivated ? '#4CAF50' : '#F44336'
            }]}>
              <Text style={styles.statusText}>
                {integrationData.esicDetails.medicalBenefitActivated ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Family Members:</Text>
            <Text style={styles.detailValue}>{integrationData.esicDetails.familyMembersAdded}</Text>
          </View>
        </View>
      )}
    </Card>
  );

  const renderPFTransferSection = () => (
    <Card title={getLocalizedText('pf_transfer', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('transfer_help', language)}
      </Text>

      <Input
        label={getLocalizedText('previous_pf_number', language)}
        value={integrationData.pfTransfer.previousPFNumber}
        onChangeText={(text) => setIntegrationData(prev => ({
          ...prev,
          pfTransfer: { ...prev.pfTransfer, previousPFNumber: text }
        }))}
        placeholder="KN/BLR/12345/001"
      />

      <Input
        label={getLocalizedText('previous_establishment', language)}
        value={integrationData.pfTransfer.previousEstablishment}
        onChangeText={(text) => setIntegrationData(prev => ({
          ...prev,
          pfTransfer: { ...prev.pfTransfer, previousEstablishment: text }
        }))}
        placeholder="Previous Company Name"
      />

      <Button
        title={getLocalizedText('initiate_transfer', language)}
        onPress={initiatePFTransfer}
        variant="secondary"
        size="medium"
        loading={loading.pfTransfer}
        disabled={!integrationData.uanDetails.isVerified || loading.pfTransfer}
      />

      {integrationData.pfTransfer.transferId && (
        <View style={styles.transferSection}>
          <Text style={styles.transferTitle}>Transfer Request Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transfer ID:</Text>
            <Text style={styles.detailValue}>{integrationData.pfTransfer.transferId}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={styles.detailValue}>₹{integrationData.pfTransfer.transferAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
              <Text style={styles.statusText}>
                {integrationData.pfTransfer.transferStatus.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      )}
    </Card>
  );

  const renderNomineeSection = () => (
    <Card title={getLocalizedText('nomination_management', language)} variant="outlined" margin={8}>
      <View style={styles.nomineeContainer}>
        <View style={styles.nomineeSection}>
          <Text style={styles.nomineeTitle}>PF Nominees ({integrationData.pfNominee.length})</Text>
          {integrationData.pfNominee.map((nominee, index) => (
            <View key={index} style={styles.nomineeCard}>
              <Text style={styles.nomineeName}>{nominee.name}</Text>
              <Text style={styles.nomineeDetails}>
                {nominee.relationship} - {nominee.sharePercentage}%
              </Text>
            </View>
          ))}
          <Button
            title="Add PF Nominee"
            onPress={() => {
              setNomineeType('pf');
              setShowNomineeModal(true);
            }}
            variant="outline"
            size="small"
          />
        </View>

        <View style={styles.nomineeSection}>
          <Text style={styles.nomineeTitle}>ESIC Nominees ({integrationData.esicNominee.length})</Text>
          {integrationData.esicNominee.map((nominee, index) => (
            <View key={index} style={styles.nomineeCard}>
              <Text style={styles.nomineeName}>{nominee.name}</Text>
              <Text style={styles.nomineeDetails}>
                {nominee.relationship} - {nominee.sharePercentage}%
              </Text>
            </View>
          ))}
          <Button
            title="Add ESIC Nominee"
            onPress={() => {
              setNomineeType('esic');
              setShowNomineeModal(true);
            }}
            variant="outline"
            size="small"
          />
        </View>
      </View>
    </Card>
  );

  const renderKYCStatus = () => (
    <Card title={getLocalizedText('kyc_verification', language)} variant="outlined" margin={8}>
      <View style={styles.kycContainer}>
        <View style={styles.kycRow}>
          <Text style={styles.kycLabel}>Aadhaar Verification:</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: integrationData.kycStatus.aadhaarVerified ? '#4CAF50' : '#F44336'
          }]}>
            <Text style={styles.statusText}>
              {integrationData.kycStatus.aadhaarVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.kycRow}>
          <Text style={styles.kycLabel}>PAN Verification:</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: integrationData.kycStatus.panVerified ? '#4CAF50' : '#F44336'
          }]}>
            <Text style={styles.statusText}>
              {integrationData.kycStatus.panVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.kycRow}>
          <Text style={styles.kycLabel}>Bank Verification:</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: integrationData.kycStatus.bankVerified ? '#4CAF50' : '#F44336'
          }]}>
            <Text style={styles.statusText}>
              {integrationData.kycStatus.bankVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('integration_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('integration_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderAPIStatus()}
        {renderUANSection()}
        {renderESICSection()}
        {renderPFTransferSection()}
        {renderNomineeSection()}
        {renderKYCStatus()}

        {errors.integration && (
          <Text style={styles.errorText}>{errors.integration}</Text>
        )}

        {errors.api && (
          <Text style={styles.errorText}>{errors.api}</Text>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={getLocalizedText('sync_portals', language)}
          onPress={checkAPIStatus}
          variant="outline"
          size="medium"
        />
        
        <Button
          title={getLocalizedText('continue', language)}
          onPress={handleSubmit}
          variant="primary"
          size="medium"
        />
      </View>

      {/* Nominee Modal */}
      <Modal
        visible={showNomineeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNomineeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add {nomineeType.toUpperCase()} Nominee
            </Text>
            
            <Input
              label={getLocalizedText('nominee_name', language)}
              value={newNominee.name || ''}
              onChangeText={(text) => setNewNominee(prev => ({ ...prev, name: text }))}
              placeholder="Nominee Name"
            />
            
            <TouchableOpacity
              style={styles.relationshipButton}
              onPress={() => {
                // Show relationship picker
                Alert.alert('Relationship', 'Select relationship', [
                  { text: 'Spouse', onPress: () => setNewNominee(prev => ({ ...prev, relationship: 'Spouse' })) },
                  { text: 'Father', onPress: () => setNewNominee(prev => ({ ...prev, relationship: 'Father' })) },
                  { text: 'Mother', onPress: () => setNewNominee(prev => ({ ...prev, relationship: 'Mother' })) },
                  { text: 'Son', onPress: () => setNewNominee(prev => ({ ...prev, relationship: 'Son' })) },
                  { text: 'Daughter', onPress: () => setNewNominee(prev => ({ ...prev, relationship: 'Daughter' })) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            >
              <Text style={styles.relationshipText}>
                {newNominee.relationship || 'Select Relationship'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
            
            <Input
              label={getLocalizedText('nominee_share', language)}
              value={newNominee.sharePercentage?.toString() || ''}
              onChangeText={(text) => setNewNominee(prev => ({ ...prev, sharePercentage: parseFloat(text) || 0 }))}
              placeholder="100"
              keyboardType="numeric"
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowNomineeModal(false)}
                variant="text"
                size="medium"
              />
              <Button
                title="Add"
                onPress={addNominee}
                variant="primary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  apiStatusContainer: {
    gap: 12,
  },
  apiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  apiLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  syncInfo: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#757575',
  },
  verifiedSection: {
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  verifiedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#424242',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  transferSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  transferTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 12,
  },
  nomineeContainer: {
    gap: 20,
  },
  nomineeSection: {
    gap: 8,
  },
  nomineeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  nomineeCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  nomineeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  nomineeDetails: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  kycContainer: {
    gap: 8,
  },
  kycRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  kycLabel: {
    fontSize: 14,
    color: '#424242',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  spacer: {
    height: 100,
  },
  actions: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 20,
  },
  relationshipButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  relationshipText: {
    fontSize: 14,
    color: '#212121',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#757575',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
});
