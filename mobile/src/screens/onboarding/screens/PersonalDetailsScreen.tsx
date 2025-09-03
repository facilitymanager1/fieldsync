/**
 * Personal Details Screen - Additional personal information collection
 * 
 * Features:
 * - Extended personal information form
 * - Parent/Guardian details
 * - Emergency contact information
 * - Blood group selection
 * - Marital status (conditional fields)
 * - Multi-language support
 * - Form validation
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
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    aadhaarData: { name: 'John Doe', dateOfBirth: '01/01/1990' }
  },
  calculateAge: (dob: string) => {
    const today = new Date();
    const birthDate = new Date(dob.split('/').reverse().join('-'));
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    personal_details_title: 'Personal Details',
    personal_details_subtitle: 'Please provide additional personal information',
    mobile_number: 'Mobile Number',
    email_address: 'Email Address',
    blood_group: 'Blood Group',
    marital_status: 'Marital Status',
    single: 'Single',
    married: 'Married',
    divorced: 'Divorced',
    widowed: 'Widowed',
    spouse_name: 'Spouse Name',
    marriage_date: 'Marriage Date',
    father_name: 'Father\'s Name',
    mother_name: 'Mother\'s Name',
    emergency_contact: 'Emergency Contact',
    emergency_contact_name: 'Emergency Contact Name',
    emergency_contact_number: 'Emergency Contact Number',
    emergency_contact_relation: 'Relationship',
    relation_father: 'Father',
    relation_mother: 'Mother',
    relation_spouse: 'Spouse',
    relation_sibling: 'Sibling',
    relation_friend: 'Friend',
    relation_other: 'Other',
    mobile_placeholder: '+91 XXXXX XXXXX',
    email_placeholder: 'your.email@example.com',
    required_field: 'This field is required',
    invalid_mobile: 'Please enter a valid 10-digit mobile number',
    invalid_email: 'Please enter a valid email address',
    continue: 'Continue',
    skip: 'Skip for Now',
    dd_mm_yyyy: 'DD/MM/YYYY',
    blood_groups: 'Blood Groups',
    select_blood_group: 'Select Blood Group',
    personal_info: 'Personal Information',
    family_info: 'Family Information',
    emergency_info: 'Emergency Contact',
  };
  return texts[key] || key;
};

interface PersonalDetailsData {
  mobileNumber: string;
  emailAddress: string;
  bloodGroup: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  spouseName?: string;
  marriageDate?: string;
  fatherName: string;
  motherName: string;
  emergencyContact: {
    name: string;
    number: string;
    relation: 'father' | 'mother' | 'spouse' | 'sibling' | 'friend' | 'other';
  };
  timestamp: string;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PersonalDetailsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData, calculateAge } = useOnboarding();
  
  const [personalData, setPersonalData] = useState<PersonalDetailsData>({
    mobileNumber: '',
    emailAddress: '',
    bloodGroup: '',
    maritalStatus: 'single',
    fatherName: '',
    motherName: '',
    emergencyContact: {
      name: '',
      number: '',
      relation: 'father',
    },
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);
  const [showRelationPicker, setShowRelationPicker] = useState(false);

  useEffect(() => {
    // Load any saved data and pre-fill from previous steps
    loadSavedData();
    prefillFromAadhaar();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`personal_details_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setPersonalData(data);
      }
    } catch (error) {
      console.error('Failed to load saved personal details:', error);
    }
  };

  const prefillFromAadhaar = () => {
    // Pre-fill emergency contact with father's name if available
    if (userData?.aadhaarData?.name) {
      setPersonalData(prev => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          name: prev.emergencyContact.name || prev.fatherName,
        },
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Mobile number validation
    if (!personalData.mobileNumber.trim()) {
      newErrors.mobileNumber = getLocalizedText('required_field', language);
    } else if (!/^[6-9]\d{9}$/.test(personalData.mobileNumber.replace(/\s/g, ''))) {
      newErrors.mobileNumber = getLocalizedText('invalid_mobile', language);
    }

    // Email validation
    if (!personalData.emailAddress.trim()) {
      newErrors.emailAddress = getLocalizedText('required_field', language);
    } else if (!/\S+@\S+\.\S+/.test(personalData.emailAddress)) {
      newErrors.emailAddress = getLocalizedText('invalid_email', language);
    }

    // Father's name
    if (!personalData.fatherName.trim()) {
      newErrors.fatherName = getLocalizedText('required_field', language);
    }

    // Mother's name
    if (!personalData.motherName.trim()) {
      newErrors.motherName = getLocalizedText('required_field', language);
    }

    // Spouse details if married
    if (personalData.maritalStatus === 'married') {
      if (!personalData.spouseName?.trim()) {
        newErrors.spouseName = getLocalizedText('required_field', language);
      }
      if (!personalData.marriageDate?.trim()) {
        newErrors.marriageDate = getLocalizedText('required_field', language);
      }
    }

    // Emergency contact validation
    if (!personalData.emergencyContact.name.trim()) {
      newErrors.emergencyContactName = getLocalizedText('required_field', language);
    }

    if (!personalData.emergencyContact.number.trim()) {
      newErrors.emergencyContactNumber = getLocalizedText('required_field', language);
    } else if (!/^[6-9]\d{9}$/.test(personalData.emergencyContact.number.replace(/\s/g, ''))) {
      newErrors.emergencyContactNumber = getLocalizedText('invalid_mobile', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('emergencyContact.')) {
      const contactField = field.split('.')[1];
      setPersonalData(prev => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          [contactField]: value,
        },
      }));
    } else {
      setPersonalData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear error when user starts typing
    const errorKey = field.replace('.', '');
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const formatMobileNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{5})(\d{5})/, '$1 $2');
    }
    return cleaned.slice(0, 10).replace(/(\d{5})(\d{5})/, '$1 $2');
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: PersonalDetailsData = {
      ...personalData,
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to local storage
      await AsyncStorage.setItem(
        `personal_details_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ personalDetails: finalData });
    } catch (error) {
      console.error('Failed to save personal details:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Personal Details?',
      'Personal details help us provide better service. You can complete this later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            personalDetails: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderPersonalInfoSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('personal_info', language)}
      </Text>

      {/* Mobile Number */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('mobile_number', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.mobileNumber ? styles.inputError : null]}
          value={formatMobileNumber(personalData.mobileNumber)}
          onChangeText={(text) => handleInputChange('mobileNumber', text.replace(/\s/g, ''))}
          placeholder={getLocalizedText('mobile_placeholder', language)}
          keyboardType="phone-pad"
          maxLength={11} // Including space
        />
        {errors.mobileNumber && (
          <Text style={styles.errorText}>{errors.mobileNumber}</Text>
        )}
      </View>

      {/* Email Address */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('email_address', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.emailAddress ? styles.inputError : null]}
          value={personalData.emailAddress}
          onChangeText={(text) => handleInputChange('emailAddress', text)}
          placeholder={getLocalizedText('email_placeholder', language)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errors.emailAddress && (
          <Text style={styles.errorText}>{errors.emailAddress}</Text>
        )}
      </View>

      {/* Blood Group */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('blood_group', language)}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowBloodGroupPicker(!showBloodGroupPicker)}
        >
          <Text style={[styles.pickerButtonText, !personalData.bloodGroup && styles.placeholderText]}>
            {personalData.bloodGroup || getLocalizedText('select_blood_group', language)}
          </Text>
          <Text style={styles.pickerArrow}>{showBloodGroupPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showBloodGroupPicker && (
          <View style={styles.pickerContainer}>
            {BLOOD_GROUPS.map((group) => (
              <TouchableOpacity
                key={group}
                style={[
                  styles.pickerOption,
                  personalData.bloodGroup === group && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  handleInputChange('bloodGroup', group);
                  setShowBloodGroupPicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  personalData.bloodGroup === group && styles.pickerOptionTextSelected
                ]}>
                  {group}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Marital Status */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('marital_status', language)} *
        </Text>
        <View style={styles.radioContainer}>
          {(['single', 'married', 'divorced', 'widowed'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.radioButton,
                personalData.maritalStatus === status && styles.radioButtonSelected
              ]}
              onPress={() => handleInputChange('maritalStatus', status)}
            >
              <Text style={[
                styles.radioButtonText,
                personalData.maritalStatus === status && styles.radioButtonTextSelected
              ]}>
                {getLocalizedText(status, language)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Spouse Details (if married) */}
      {personalData.maritalStatus === 'married' && (
        <>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('spouse_name', language)} *
            </Text>
            <TextInput
              style={[styles.textInput, errors.spouseName ? styles.inputError : null]}
              value={personalData.spouseName || ''}
              onChangeText={(text) => handleInputChange('spouseName', text)}
              placeholder="Enter spouse's full name"
              autoCapitalize="words"
            />
            {errors.spouseName && (
              <Text style={styles.errorText}>{errors.spouseName}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('marriage_date', language)} *
            </Text>
            <TextInput
              style={[styles.textInput, errors.marriageDate ? styles.inputError : null]}
              value={personalData.marriageDate || ''}
              onChangeText={(text) => handleInputChange('marriageDate', text)}
              placeholder={getLocalizedText('dd_mm_yyyy', language)}
              keyboardType="numeric"
            />
            {errors.marriageDate && (
              <Text style={styles.errorText}>{errors.marriageDate}</Text>
            )}
          </View>
        </>
      )}
    </View>
  );

  const renderFamilyInfoSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('family_info', language)}
      </Text>

      {/* Father's Name */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('father_name', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.fatherName ? styles.inputError : null]}
          value={personalData.fatherName}
          onChangeText={(text) => handleInputChange('fatherName', text)}
          placeholder="Enter father's full name"
          autoCapitalize="words"
        />
        {errors.fatherName && (
          <Text style={styles.errorText}>{errors.fatherName}</Text>
        )}
      </View>

      {/* Mother's Name */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('mother_name', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.motherName ? styles.inputError : null]}
          value={personalData.motherName}
          onChangeText={(text) => handleInputChange('motherName', text)}
          placeholder="Enter mother's full name"
          autoCapitalize="words"
        />
        {errors.motherName && (
          <Text style={styles.errorText}>{errors.motherName}</Text>
        )}
      </View>
    </View>
  );

  const renderEmergencyContactSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('emergency_info', language)}
      </Text>

      {/* Emergency Contact Name */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('emergency_contact_name', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.emergencyContactName ? styles.inputError : null]}
          value={personalData.emergencyContact.name}
          onChangeText={(text) => handleInputChange('emergencyContact.name', text)}
          placeholder="Enter emergency contact name"
          autoCapitalize="words"
        />
        {errors.emergencyContactName && (
          <Text style={styles.errorText}>{errors.emergencyContactName}</Text>
        )}
      </View>

      {/* Emergency Contact Number */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('emergency_contact_number', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.emergencyContactNumber ? styles.inputError : null]}
          value={formatMobileNumber(personalData.emergencyContact.number)}
          onChangeText={(text) => handleInputChange('emergencyContact.number', text.replace(/\s/g, ''))}
          placeholder={getLocalizedText('mobile_placeholder', language)}
          keyboardType="phone-pad"
          maxLength={11}
        />
        {errors.emergencyContactNumber && (
          <Text style={styles.errorText}>{errors.emergencyContactNumber}</Text>
        )}
      </View>

      {/* Relationship */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('emergency_contact_relation', language)} *
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowRelationPicker(!showRelationPicker)}
        >
          <Text style={styles.pickerButtonText}>
            {getLocalizedText(`relation_${personalData.emergencyContact.relation}`, language)}
          </Text>
          <Text style={styles.pickerArrow}>{showRelationPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showRelationPicker && (
          <View style={styles.pickerContainer}>
            {(['father', 'mother', 'spouse', 'sibling', 'friend', 'other'] as const).map((relation) => (
              <TouchableOpacity
                key={relation}
                style={[
                  styles.pickerOption,
                  personalData.emergencyContact.relation === relation && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  handleInputChange('emergencyContact.relation', relation);
                  setShowRelationPicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  personalData.emergencyContact.relation === relation && styles.pickerOptionTextSelected
                ]}>
                  {getLocalizedText(`relation_${relation}`, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('personal_details_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('personal_details_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderPersonalInfoSection()}
        {renderFamilyInfoSection()}
        {renderEmergencyContactSection()}
        
        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>
            {getLocalizedText('skip', language)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!personalData.mobileNumber || !personalData.emailAddress || !personalData.fatherName || !personalData.motherName) && styles.buttonDisabled
          ]}
          onPress={handleContinue}
          disabled={!personalData.mobileNumber || !personalData.emailAddress || !personalData.fatherName || !personalData.motherName}
        >
          <Text style={styles.continueButtonText}>
            {getLocalizedText('continue', language)}
          </Text>
        </TouchableOpacity>
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
  },
  sectionContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
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
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
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
    maxHeight: 200,
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
  radioContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  radioButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  radioButtonText: {
    fontSize: 14,
    color: '#757575',
  },
  radioButtonTextSelected: {
    color: '#fff',
    fontWeight: '500',
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
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#757575',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  continueButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
});
