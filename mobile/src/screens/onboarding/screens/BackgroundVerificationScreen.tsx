/**
 * Background Verification Screen - Comprehensive background verification
 * 
 * Features:
 * - Auto-fetch employee details based on Aadhaar number
 * - Language preferences (speaking/writing)
 * - Thumb impression capture
 * - Criminal verification details
 * - Manual address entry options
 * - Status management
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
    onboarding: { tempId: 'TMP001' },
    personalDetails: { 
      aadhaarNumber: '1234567890', 
      name: 'John Doe',
      fatherName: 'Father Name',
      motherName: 'Mother Name',
      dateOfBirth: '01/01/1990',
      gender: 'male',
      mobileNumber: '9876543210'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    background_verification_title: 'Background Verification',
    background_verification_subtitle: 'Comprehensive background verification process',
    temp_id: 'Temp Employee ID',
    permanent_id: 'Permanent Employee ID',
    aadhaar_number: 'Aadhaar Number',
    basic_details: 'Basic Details',
    personal_info: 'Personal Information',
    language_preferences: 'Language Preferences',
    address_details: 'Address Details',
    criminal_verification: 'Criminal Verification',
    biometric_info: 'Biometric Information',
    name: 'Name',
    father_name: 'Father Name',
    mother_name: 'Mother Name',
    age: 'Age',
    gender: 'Gender',
    mobile_number: 'Mobile Number',
    date_of_birth: 'Date of Birth',
    marital_status: 'Marital Status',
    languages_speak: 'Languages Known to Speak',
    other_languages_speak: 'Other Languages (Speak)',
    languages_write: 'Languages Known to Write',
    other_languages_write: 'Other Languages (Write)',
    criminal_from_date: 'From Date',
    criminal_to_date: 'To Date',
    permanent_address: 'Permanent Address',
    present_address: 'Present Address',
    previous_address: 'Previous Address',
    left_thumb: 'Left Thumb Impression',
    right_thumb: 'Right Thumb Impression',
    upload_impression: 'Upload Thumb Impression',
    status: 'Status',
    status_in_progress: 'In Progress',
    status_completed: 'Completed',
    status_rejected: 'Rejected',
    status_additional_docs: 'Additional Documents to be Submitted',
    required_field: 'This field is required',
    submit: 'Submit',
    cancel: 'Cancel',
    select_languages: 'Select Languages',
    yes: 'Yes',
    no: 'No',
    dd_mm_yyyy: 'DD/MM/YYYY',
    auto_fetched: 'Auto-fetched from Aadhaar',
    manual_entry: 'Manual Entry',
    same_as_permanent: 'Same as Permanent Address',
  };
  return texts[key] || key;
};

const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati', 'Urdu', 'Punjabi', 'Malayalam', 'Oriya'];

interface BackgroundVerificationData {
  tempId: string;
  permanentId?: string;
  aadhaarNumber: string;
  basicDetails: {
    name: string;
    profilePhoto: string;
    maritalStatus: string;
    dateOfBirth: string;
    fatherName: string;
    motherName: string;
    age: number;
    gender: string;
    mobileNumber: string;
  };
  languagePreferences: {
    languagesKnownSpeak: string[];
    otherLanguagesSpeak?: string;
    languagesKnownWrite: string[];
    otherLanguagesWrite?: string;
  };
  addressDetails: {
    permanentAddress: string;
    presentAddress: string;
    previousAddress?: string;
    sameAsPermanent: boolean;
  };
  criminalVerification: {
    fromDate: string;
    toDate: string;
  };
  biometricInfo: {
    leftThumbImpression?: string;
    rightThumbImpression?: string;
  };
  status: 'in_progress' | 'completed' | 'rejected' | 'additional_docs';
  timestamp: string;
}

export default function BackgroundVerificationScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [verificationData, setVerificationData] = useState<BackgroundVerificationData>({
    tempId: userData?.onboarding?.tempId || '',
    aadhaarNumber: userData?.personalDetails?.aadhaarNumber || '',
    basicDetails: {
      name: userData?.personalDetails?.name || '',
      profilePhoto: '',
      maritalStatus: '',
      dateOfBirth: userData?.personalDetails?.dateOfBirth || '',
      fatherName: userData?.personalDetails?.fatherName || '',
      motherName: userData?.personalDetails?.motherName || '',
      age: 0,
      gender: userData?.personalDetails?.gender || '',
      mobileNumber: userData?.personalDetails?.mobileNumber || '',
    },
    languagePreferences: {
      languagesKnownSpeak: [],
      otherLanguagesSpeak: '',
      languagesKnownWrite: [],
      otherLanguagesWrite: '',
    },
    addressDetails: {
      permanentAddress: '',
      presentAddress: '',
      previousAddress: '',
      sameAsPermanent: false,
    },
    criminalVerification: {
      fromDate: '',
      toDate: '',
    },
    biometricInfo: {
      leftThumbImpression: undefined,
      rightThumbImpression: undefined,
    },
    status: 'in_progress',
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showLanguagesSpeakPicker, setShowLanguagesSpeakPicker] = useState(false);
  const [showLanguagesWritePicker, setShowLanguagesWritePicker] = useState(false);
  const [showOtherLanguagesSpeak, setShowOtherLanguagesSpeak] = useState(false);
  const [showOtherLanguagesWrite, setShowOtherLanguagesWrite] = useState(false);

  useEffect(() => {
    loadSavedData();
    prefillFromOnboarding();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`background_verification_${verificationData.tempId}`);
      if (saved) {
        const data = JSON.parse(saved);
        setVerificationData(data);
      }
    } catch (error) {
      console.error('Failed to load saved background verification data:', error);
    }
  };

  const prefillFromOnboarding = () => {
    if (userData?.personalDetails?.dateOfBirth) {
      const dob = new Date(userData.personalDetails.dateOfBirth.split('/').reverse().join('-'));
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      
      setVerificationData(prev => ({
        ...prev,
        basicDetails: {
          ...prev.basicDetails,
          age,
        }
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Basic validation
    if (!verificationData.basicDetails.name.trim()) {
      newErrors.name = getLocalizedText('required_field', language);
    }

    if (!verificationData.addressDetails.permanentAddress.trim()) {
      newErrors.permanentAddress = getLocalizedText('required_field', language);
    }

    if (!verificationData.addressDetails.presentAddress.trim() && !verificationData.addressDetails.sameAsPermanent) {
      newErrors.presentAddress = getLocalizedText('required_field', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    if (section === 'sameAsPermanent' && value === true) {
      // Auto-fill present address with permanent address
      setVerificationData(prev => ({
        ...prev,
        addressDetails: {
          ...prev.addressDetails,
          sameAsPermanent: value,
          presentAddress: prev.addressDetails.permanentAddress,
        }
      }));
    } else {
      setVerificationData(prev => ({
        ...prev,
        [section]: {
          ...prev[section as keyof BackgroundVerificationData],
          [field]: value
        }
      }));
    }
    
    // Clear error when user starts typing
    const errorKey = field;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const handleLanguageSelection = (language: string, type: 'speak' | 'write') => {
    const field = type === 'speak' ? 'languagesKnownSpeak' : 'languagesKnownWrite';
    const currentLanguages = verificationData.languagePreferences[field];
    
    let updatedLanguages;
    if (currentLanguages.includes(language)) {
      updatedLanguages = currentLanguages.filter(lang => lang !== language);
    } else {
      updatedLanguages = [...currentLanguages, language];
    }

    setVerificationData(prev => ({
      ...prev,
      languagePreferences: {
        ...prev.languagePreferences,
        [field]: updatedLanguages
      }
    }));

    // Check if 'Others' is selected to show text input
    const hasOthers = updatedLanguages.includes('Others');
    if (type === 'speak') {
      setShowOtherLanguagesSpeak(hasOthers);
    } else {
      setShowOtherLanguagesWrite(hasOthers);
    }
  };

  const handleBiometricUpload = (type: 'left' | 'right') => {
    // Mock implementation - in real app, would open camera/gallery
    Alert.alert(
      'Upload Thumb Impression',
      `Upload ${type} thumb impression photo`,
      [
        { text: 'Camera', onPress: () => console.log('Open camera') },
        { text: 'Gallery', onPress: () => console.log('Open gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalData: BackgroundVerificationData = {
      ...verificationData,
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to local storage
      await AsyncStorage.setItem(
        `background_verification_${verificationData.tempId}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ backgroundVerification: finalData });
    } catch (error) {
      console.error('Failed to save background verification data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const renderBasicDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('basic_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('temp_id', language)} *
        </Text>
        <TextInput
          style={styles.textInputDisabled}
          value={verificationData.tempId}
          editable={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('aadhaar_number', language)} *
        </Text>
        <TextInput
          style={styles.textInputDisabled}
          value={verificationData.aadhaarNumber}
          editable={false}
        />
        <Text style={styles.helperText}>
          {getLocalizedText('auto_fetched', language)}
        </Text>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name:</Text>
          <Text style={styles.infoValue}>{verificationData.basicDetails.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Father Name:</Text>
          <Text style={styles.infoValue}>{verificationData.basicDetails.fatherName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mother Name:</Text>
          <Text style={styles.infoValue}>{verificationData.basicDetails.motherName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Age:</Text>
          <Text style={styles.infoValue}>{verificationData.basicDetails.age} years</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Gender:</Text>
          <Text style={styles.infoValue}>{verificationData.basicDetails.gender}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mobile:</Text>
          <Text style={styles.infoValue}>{verificationData.basicDetails.mobileNumber}</Text>
        </View>
      </View>
    </View>
  );

  const renderLanguagePreferencesSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('language_preferences', language)}
      </Text>

      {/* Languages Known to Speak */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('languages_speak', language)} *
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowLanguagesSpeakPicker(!showLanguagesSpeakPicker)}
        >
          <Text style={[styles.pickerButtonText, verificationData.languagePreferences.languagesKnownSpeak.length === 0 && styles.placeholderText]}>
            {verificationData.languagePreferences.languagesKnownSpeak.length > 0 
              ? verificationData.languagePreferences.languagesKnownSpeak.join(', ') 
              : getLocalizedText('select_languages', language)
            }
          </Text>
          <Text style={styles.pickerArrow}>{showLanguagesSpeakPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showLanguagesSpeakPicker && (
          <View style={styles.pickerContainer}>
            {[...LANGUAGES, 'Others'].map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.pickerOption,
                  verificationData.languagePreferences.languagesKnownSpeak.includes(lang) && styles.pickerOptionSelected
                ]}
                onPress={() => handleLanguageSelection(lang, 'speak')}
              >
                <Text style={[
                  styles.pickerOptionText,
                  verificationData.languagePreferences.languagesKnownSpeak.includes(lang) && styles.pickerOptionTextSelected
                ]}>
                  {lang} {verificationData.languagePreferences.languagesKnownSpeak.includes(lang) ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Other Languages Speak (conditional) */}
      {showOtherLanguagesSpeak && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('other_languages_speak', language)}
          </Text>
          <TextInput
            style={styles.textInput}
            value={verificationData.languagePreferences.otherLanguagesSpeak || ''}
            onChangeText={(text) => handleInputChange('languagePreferences', 'otherLanguagesSpeak', text)}
            placeholder="Mention other languages known to speak"
            autoCapitalize="words"
          />
        </View>
      )}

      {/* Languages Known to Write */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('languages_write', language)} *
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowLanguagesWritePicker(!showLanguagesWritePicker)}
        >
          <Text style={[styles.pickerButtonText, verificationData.languagePreferences.languagesKnownWrite.length === 0 && styles.placeholderText]}>
            {verificationData.languagePreferences.languagesKnownWrite.length > 0 
              ? verificationData.languagePreferences.languagesKnownWrite.join(', ') 
              : getLocalizedText('select_languages', language)
            }
          </Text>
          <Text style={styles.pickerArrow}>{showLanguagesWritePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showLanguagesWritePicker && (
          <View style={styles.pickerContainer}>
            {[...LANGUAGES, 'Others'].map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.pickerOption,
                  verificationData.languagePreferences.languagesKnownWrite.includes(lang) && styles.pickerOptionSelected
                ]}
                onPress={() => handleLanguageSelection(lang, 'write')}
              >
                <Text style={[
                  styles.pickerOptionText,
                  verificationData.languagePreferences.languagesKnownWrite.includes(lang) && styles.pickerOptionTextSelected
                ]}>
                  {lang} {verificationData.languagePreferences.languagesKnownWrite.includes(lang) ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Other Languages Write (conditional) */}
      {showOtherLanguagesWrite && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('other_languages_write', language)}
          </Text>
          <TextInput
            style={styles.textInput}
            value={verificationData.languagePreferences.otherLanguagesWrite || ''}
            onChangeText={(text) => handleInputChange('languagePreferences', 'otherLanguagesWrite', text)}
            placeholder="Mention other languages known to write"
            autoCapitalize="words"
          />
        </View>
      )}
    </View>
  );

  const renderAddressDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('address_details', language)}
      </Text>

      {/* Permanent Address */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('permanent_address', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.permanentAddress ? styles.inputError : null]}
          value={verificationData.addressDetails.permanentAddress}
          onChangeText={(text) => {
            handleInputChange('addressDetails', 'permanentAddress', text);
            if (verificationData.addressDetails.sameAsPermanent) {
              handleInputChange('addressDetails', 'presentAddress', text);
            }
          }}
          placeholder="Enter permanent address"
          multiline
          numberOfLines={3}
        />
        {errors.permanentAddress && (
          <Text style={styles.errorText}>{errors.permanentAddress}</Text>
        )}
      </View>

      {/* Same as Permanent Address */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => handleInputChange('sameAsPermanent', 'sameAsPermanent', !verificationData.addressDetails.sameAsPermanent)}
        >
          <Text style={styles.checkbox}>
            {verificationData.addressDetails.sameAsPermanent ? '✅' : '☑️'}
          </Text>
          <Text style={styles.checkboxText}>
            {getLocalizedText('same_as_permanent', language)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Present Address */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('present_address', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.presentAddress ? styles.inputError : null]}
          value={verificationData.addressDetails.presentAddress}
          onChangeText={(text) => handleInputChange('addressDetails', 'presentAddress', text)}
          placeholder="Enter present address"
          multiline
          numberOfLines={3}
          editable={!verificationData.addressDetails.sameAsPermanent}
        />
        {errors.presentAddress && (
          <Text style={styles.errorText}>{errors.presentAddress}</Text>
        )}
      </View>

      {/* Previous Address */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('previous_address', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.addressDetails.previousAddress || ''}
          onChangeText={(text) => handleInputChange('addressDetails', 'previousAddress', text)}
          placeholder="Enter previous address (if any)"
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );

  const renderCriminalVerificationSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('criminal_verification', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('criminal_from_date', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.criminalVerification.fromDate}
          onChangeText={(text) => handleInputChange('criminalVerification', 'fromDate', text)}
          placeholder={getLocalizedText('dd_mm_yyyy', language)}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('criminal_to_date', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.criminalVerification.toDate}
          onChangeText={(text) => handleInputChange('criminalVerification', 'toDate', text)}
          placeholder={getLocalizedText('dd_mm_yyyy', language)}
          keyboardType="numeric"
        />
      </View>
    </View>
  );

  const renderBiometricInfoSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('biometric_info', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('left_thumb', language)}
        </Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleBiometricUpload('left')}
        >
          <Text style={styles.uploadButtonText}>
            {getLocalizedText('upload_impression', language)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('right_thumb', language)}
        </Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleBiometricUpload('right')}
        >
          <Text style={styles.uploadButtonText}>
            {getLocalizedText('upload_impression', language)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStatusSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('status', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          Verification Status *
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowStatusPicker(!showStatusPicker)}
        >
          <Text style={styles.pickerButtonText}>
            {getLocalizedText(`status_${verificationData.status}`, language)}
          </Text>
          <Text style={styles.pickerArrow}>{showStatusPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showStatusPicker && (
          <View style={styles.pickerContainer}>
            {(['in_progress', 'completed', 'rejected', 'additional_docs'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.pickerOption,
                  verificationData.status === status && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  setVerificationData(prev => ({ ...prev, status }));
                  setShowStatusPicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  verificationData.status === status && styles.pickerOptionTextSelected
                ]}>
                  {getLocalizedText(`status_${status}`, language)}
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
          {getLocalizedText('background_verification_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('background_verification_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderBasicDetailsSection()}
        {renderLanguagePreferencesSection()}
        {renderAddressDetailsSection()}
        {renderCriminalVerificationSection()}
        {renderBiometricInfoSection()}
        {renderStatusSection()}
        
        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={goToPreviousStep}>
          <Text style={styles.cancelButtonText}>
            {getLocalizedText('cancel', language)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>
            {getLocalizedText('submit', language)}
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
  textInputDisabled: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
    color: '#757575',
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
    fontStyle: 'italic',
  },
  infoGrid: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
    textAlign: 'right',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    fontSize: 20,
    marginRight: 8,
  },
  checkboxText: {
    fontSize: 16,
    color: '#424242',
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
    flex: 1,
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
  uploadButton: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#2196F3',
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
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});