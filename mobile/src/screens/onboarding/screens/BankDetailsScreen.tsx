/**
 * Bank Details Screen - Banking information collection
 * 
 * Features:
 * - Bank account details form
 * - IFSC code validation and bank name auto-fill
 * - Account type selection
 * - UPI ID collection
 * - Bank document upload
 * - Account verification option
 * - Salary account preference
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import UI components
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      firstName: 'John',
      lastName: 'Doe',
      panNumber: 'ABCDE1234F'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    bank_title: 'Bank Details',
    bank_subtitle: 'Please provide your banking information for salary payments',
    account_details: 'Account Details',
    bank_name: 'Bank Name',
    account_number: 'Account Number',
    confirm_account_number: 'Confirm Account Number',
    ifsc_code: 'IFSC Code',
    account_type: 'Account Type',
    account_holder_name: 'Account Holder Name',
    branch_name: 'Branch Name',
    branch_address: 'Branch Address',
    upi_details: 'UPI Details',
    upi_id: 'UPI ID',
    verify_upi: 'Verify UPI ID',
    preferences: 'Preferences',
    salary_account: 'Use as Salary Account',
    bank_documents: 'Bank Documents',
    upload_passbook: 'Upload Bank Passbook/Statement',
    upload_cancelled_cheque: 'Upload Cancelled Cheque',
    verify_account: 'Verify Account',
    continue: 'Continue',
    skip: 'Skip for Now',
    
    // Account types
    savings: 'Savings',
    current: 'Current',
    salary: 'Salary',
    nri: 'NRI',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_account_number: 'Please enter a valid account number',
    account_number_mismatch: 'Account numbers do not match',
    invalid_ifsc: 'Please enter a valid IFSC code',
    invalid_upi: 'Please enter a valid UPI ID',
    account_verified: 'Account verified successfully',
    verification_failed: 'Account verification failed',
    
    // Placeholders
    enter_bank_name: 'Enter bank name',
    enter_account_number: '1234567890123456',
    enter_ifsc_code: 'SBIN0001234',
    enter_account_holder: 'As per bank records',
    enter_branch_name: 'Main Branch',
    enter_branch_address: 'Branch address',
    enter_upi_id: 'username@bankname',
    
    // Help texts
    ifsc_help: 'You can find IFSC code on your cheque book or passbook',
    account_number_help: 'Enter your complete account number',
    upi_help: 'Optional: For faster payments and reimbursements',
    salary_account_help: 'This account will be used for salary credits',
  };
  return texts[key] || key;
};

interface BankDetailsData {
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  accountType: string;
  accountHolderName: string;
  branchName: string;
  branchAddress: string;
  upiId: string;
  isSalaryAccount: boolean;
  passbookUri?: string;
  chequeUri?: string;
  isVerified: boolean;
  timestamp: string;
}

const ACCOUNT_TYPES = ['savings', 'current', 'salary', 'nri'];

// Mock IFSC database
const IFSC_DATA: { [key: string]: { bankName: string; branchName: string; branchAddress: string } } = {
  'SBIN0001234': {
    bankName: 'State Bank of India',
    branchName: 'MG Road Branch',
    branchAddress: 'MG Road, Bangalore, Karnataka - 560001',
  },
  'HDFC0000123': {
    bankName: 'HDFC Bank',
    branchName: 'Koramangala Branch',
    branchAddress: 'Koramangala, Bangalore, Karnataka - 560034',
  },
  'ICIC0001234': {
    bankName: 'ICICI Bank',
    branchName: 'Electronic City Branch',
    branchAddress: 'Electronic City, Bangalore, Karnataka - 560100',
  },
  'AXIS0001234': {
    bankName: 'Axis Bank',
    branchName: 'Whitefield Branch',
    branchAddress: 'Whitefield, Bangalore, Karnataka - 560066',
  },
  'PUNB0123456': {
    bankName: 'Punjab National Bank',
    branchName: 'Indiranagar Branch',
    branchAddress: 'Indiranagar, Bangalore, Karnataka - 560038',
  },
};

export default function BankDetailsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [bankData, setBankData] = useState<BankDetailsData>({
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    accountType: '',
    accountHolderName: '',
    branchName: '',
    branchAddress: '',
    upiId: '',
    isSalaryAccount: true,
    isVerified: false,
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showAccountTypePicker, setShowAccountTypePicker] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showUpiVerification, setShowUpiVerification] = useState(false);

  useEffect(() => {
    loadSavedData();
    prefillAccountHolderName();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`bank_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setBankData(data);
      }
    } catch (error) {
      console.error('Failed to load saved bank data:', error);
    }
  };

  const prefillAccountHolderName = () => {
    if (userData?.personalData) {
      const fullName = `${userData.personalData.firstName} ${userData.personalData.lastName}`.trim();
      setBankData(prev => ({
        ...prev,
        accountHolderName: fullName,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Bank name
    if (!bankData.bankName.trim()) {
      newErrors.bankName = getLocalizedText('required_field', language);
    }

    // Account number
    if (!bankData.accountNumber.trim()) {
      newErrors.accountNumber = getLocalizedText('required_field', language);
    } else if (bankData.accountNumber.length < 9 || bankData.accountNumber.length > 20) {
      newErrors.accountNumber = getLocalizedText('invalid_account_number', language);
    }

    // Confirm account number
    if (!bankData.confirmAccountNumber.trim()) {
      newErrors.confirmAccountNumber = getLocalizedText('required_field', language);
    } else if (bankData.accountNumber !== bankData.confirmAccountNumber) {
      newErrors.confirmAccountNumber = getLocalizedText('account_number_mismatch', language);
    }

    // IFSC code
    if (!bankData.ifscCode.trim()) {
      newErrors.ifscCode = getLocalizedText('required_field', language);
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankData.ifscCode)) {
      newErrors.ifscCode = getLocalizedText('invalid_ifsc', language);
    }

    // Account type
    if (!bankData.accountType) {
      newErrors.accountType = getLocalizedText('required_field', language);
    }

    // Account holder name
    if (!bankData.accountHolderName.trim()) {
      newErrors.accountHolderName = getLocalizedText('required_field', language);
    }

    // UPI ID (if provided)
    if (bankData.upiId.trim() && !/^[\w.-]+@[\w.-]+$/.test(bankData.upiId)) {
      newErrors.upiId = getLocalizedText('invalid_upi', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof BankDetailsData, value: string | boolean) => {
    setBankData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Auto-fill bank details based on IFSC code
    if (field === 'ifscCode' && typeof value === 'string' && value.length === 11) {
      const bankInfo = IFSC_DATA[value.toUpperCase()];
      if (bankInfo) {
        setBankData(prev => ({
          ...prev,
          bankName: bankInfo.bankName,
          branchName: bankInfo.branchName,
          branchAddress: bankInfo.branchAddress,
        }));
      }
    }
  };

  const verifyAccount = async () => {
    if (!bankData.accountNumber || !bankData.ifscCode) {
      Alert.alert('Error', 'Please enter account number and IFSC code first.');
      return;
    }

    setIsVerifying(true);
    
    try {
      // Simulate account verification API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock verification result
      const isValid = Math.random() > 0.3; // 70% success rate
      
      if (isValid) {
        setBankData(prev => ({ ...prev, isVerified: true }));
        Alert.alert('Success', getLocalizedText('account_verified', language));
      } else {
        Alert.alert('Verification Failed', getLocalizedText('verification_failed', language));
      }
    } catch (error) {
      console.error('Account verification error:', error);
      Alert.alert('Error', 'Verification service is currently unavailable.');
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyUPI = async () => {
    if (!bankData.upiId) {
      Alert.alert('Error', 'Please enter UPI ID first.');
      return;
    }

    setShowUpiVerification(true);
    
    try {
      // Simulate UPI verification
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert('UPI Verified', `UPI ID ${bankData.upiId} is valid and active.`);
    } catch (error) {
      Alert.alert('UPI Verification Failed', 'Please check your UPI ID.');
    } finally {
      setShowUpiVerification(false);
    }
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: BankDetailsData = {
      ...bankData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `bank_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ bankData: finalData });
    } catch (error) {
      console.error('Failed to save bank data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Bank Details?',
      'Bank details are required for salary payments and reimbursements.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            bankData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const uploadDocument = (type: 'passbook' | 'cheque') => {
    Alert.alert(
      'Upload Document',
      `${type === 'passbook' ? 'Bank passbook/statement' : 'Cancelled cheque'} upload functionality will be implemented`
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('bank_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('bank_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Details */}
        <Card title={getLocalizedText('account_details', language)} variant="outlined" margin={8}>
          {/* IFSC Code */}
          <Input
            label={getLocalizedText('ifsc_code', language)}
            value={bankData.ifscCode}
            onChangeText={(text) => handleInputChange('ifscCode', text.toUpperCase())}
            error={errors.ifscCode}
            required
            placeholder={getLocalizedText('enter_ifsc_code', language)}
            autoCapitalize="characters"
            maxLength={11}
            helpText={getLocalizedText('ifsc_help', language)}
          />

          {/* Bank Name */}
          <Input
            label={getLocalizedText('bank_name', language)}
            value={bankData.bankName}
            onChangeText={(text) => handleInputChange('bankName', text)}
            error={errors.bankName}
            required
            placeholder={getLocalizedText('enter_bank_name', language)}
            editable={!bankData.bankName || !IFSC_DATA[bankData.ifscCode]}
          />

          {/* Branch Name */}
          <Input
            label={getLocalizedText('branch_name', language)}
            value={bankData.branchName}
            onChangeText={(text) => handleInputChange('branchName', text)}
            placeholder={getLocalizedText('enter_branch_name', language)}
          />

          {/* Branch Address */}
          <Input
            label={getLocalizedText('branch_address', language)}
            value={bankData.branchAddress}
            onChangeText={(text) => handleInputChange('branchAddress', text)}
            placeholder={getLocalizedText('enter_branch_address', language)}
            multiline
            numberOfLines={2}
          />

          {/* Account Type */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('account_type', language)} *
            </Text>
            <TouchableOpacity
              style={[styles.pickerButton, errors.accountType && styles.inputError]}
              onPress={() => setShowAccountTypePicker(!showAccountTypePicker)}
            >
              <Text style={[styles.pickerButtonText, !bankData.accountType && styles.placeholderText]}>
                {bankData.accountType 
                  ? getLocalizedText(bankData.accountType, language)
                  : 'Select account type'
                }
              </Text>
              <Text style={styles.pickerArrow}>{showAccountTypePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showAccountTypePicker && (
              <View style={styles.pickerContainer}>
                {ACCOUNT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      bankData.accountType === type && styles.pickerOptionSelected
                    ]}
                    onPress={() => {
                      handleInputChange('accountType', type);
                      setShowAccountTypePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      bankData.accountType === type && styles.pickerOptionTextSelected
                    ]}>
                      {getLocalizedText(type, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.accountType && (
              <Text style={styles.errorText}>{errors.accountType}</Text>
            )}
          </View>

          {/* Account Holder Name */}
          <Input
            label={getLocalizedText('account_holder_name', language)}
            value={bankData.accountHolderName}
            onChangeText={(text) => handleInputChange('accountHolderName', text)}
            error={errors.accountHolderName}
            required
            placeholder={getLocalizedText('enter_account_holder', language)}
          />

          {/* Account Number */}
          <Input
            label={getLocalizedText('account_number', language)}
            value={bankData.accountNumber}
            onChangeText={(text) => handleInputChange('accountNumber', text.replace(/\D/g, ''))}
            error={errors.accountNumber}
            required
            placeholder={getLocalizedText('enter_account_number', language)}
            keyboardType="numeric"
            secureTextEntry
            helpText={getLocalizedText('account_number_help', language)}
          />

          {/* Confirm Account Number */}
          <Input
            label={getLocalizedText('confirm_account_number', language)}
            value={bankData.confirmAccountNumber}
            onChangeText={(text) => handleInputChange('confirmAccountNumber', text.replace(/\D/g, ''))}
            error={errors.confirmAccountNumber}
            required
            placeholder={getLocalizedText('enter_account_number', language)}
            keyboardType="numeric"
          />

          {/* Verify Account Button */}
          <View style={styles.verifyButtonContainer}>
            <Button
              title={getLocalizedText('verify_account', language)}
              onPress={verifyAccount}
              variant={bankData.isVerified ? 'primary' : 'outline'}
              size="medium"
              loading={isVerifying}
              disabled={!bankData.accountNumber || !bankData.ifscCode || bankData.isVerified}
              icon={bankData.isVerified ? <Text style={styles.verifiedIcon}>✓</Text> : undefined}
            />
          </View>
        </Card>

        {/* UPI Details */}
        <Card title={getLocalizedText('upi_details', language)} variant="outlined" margin={8}>
          <Input
            label={getLocalizedText('upi_id', language)}
            value={bankData.upiId}
            onChangeText={(text) => handleInputChange('upiId', text.toLowerCase())}
            error={errors.upiId}
            placeholder={getLocalizedText('enter_upi_id', language)}
            keyboardType="email-address"
            autoCapitalize="none"
            helpText={getLocalizedText('upi_help', language)}
          />

          {bankData.upiId && (
            <View style={styles.verifyButtonContainer}>
              <Button
                title={getLocalizedText('verify_upi', language)}
                onPress={verifyUPI}
                variant="outline"
                size="small"
                loading={showUpiVerification}
              />
            </View>
          )}
        </Card>

        {/* Preferences */}
        <Card title={getLocalizedText('preferences', language)} variant="outlined" margin={8}>
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceContent}>
              <Text style={styles.preferenceLabel}>
                {getLocalizedText('salary_account', language)}
              </Text>
              <Text style={styles.preferenceHelp}>
                {getLocalizedText('salary_account_help', language)}
              </Text>
            </View>
            <Switch
              value={bankData.isSalaryAccount}
              onValueChange={(value) => handleInputChange('isSalaryAccount', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={bankData.isSalaryAccount ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </Card>

        {/* Bank Documents */}
        <Card title={getLocalizedText('bank_documents', language)} variant="outlined" margin={8}>
          <View style={styles.documentSection}>
            <Button
              title={getLocalizedText('upload_passbook', language)}
              onPress={() => uploadDocument('passbook')}
              variant="outline"
              size="medium"
              icon={<Text style={styles.uploadIcon}>📄</Text>}
              fullWidth
            />
          </View>

          <View style={styles.documentSection}>
            <Button
              title={getLocalizedText('upload_cancelled_cheque', language)}
              onPress={() => uploadDocument('cheque')}
              variant="outline"
              size="medium"
              icon={<Text style={styles.uploadIcon}>📄</Text>}
              fullWidth
            />
          </View>
        </Card>
        
        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={getLocalizedText('skip', language)}
          onPress={handleSkip}
          variant="text"
          size="medium"
        />
        
        <Button
          title={getLocalizedText('continue', language)}
          onPress={handleContinue}
          variant="primary"
          size="medium"
          disabled={!bankData.accountNumber || !bankData.ifscCode || !bankData.bankName}
        />
      </View>
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
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#F44336',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#212121',
  },
  placeholderText: {
    color: '#999',
  },
  pickerArrow: {
    fontSize: 14,
    color: '#757575',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 160,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#212121',
  },
  pickerOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  verifyButtonContainer: {
    marginTop: 12,
  },
  verifiedIcon: {
    fontSize: 16,
    color: '#fff',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  preferenceContent: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 4,
  },
  preferenceHelp: {
    fontSize: 14,
    color: '#757575',
  },
  documentSection: {
    marginBottom: 12,
  },
  uploadIcon: {
    fontSize: 16,
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
});
