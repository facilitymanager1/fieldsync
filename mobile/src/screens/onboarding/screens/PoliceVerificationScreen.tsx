/**
 * Police Verification Screen - Comprehensive police verification form
 * 
 * Features:
 * - Auto-fetch employee details based on Aadhaar number
 * - Manual entry for police station details
 * - Owner details and people staying at current address
 * - Address verification (permanent, present, previous)
 * - Thumb impression and signature capture
 * - PDF output generation
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
    police_verification_title: 'Police Verification',
    police_verification_subtitle: 'Police background verification form',
    temp_id: 'Temp Employee ID',
    permanent_id: 'Permanent Employee ID',
    aadhaar_number: 'Aadhaar Number',
    basic_details: 'Basic Details',
    language_preferences: 'Language Preferences',
    owner_details: 'Owner Details',
    people_staying_details: 'Details of People Staying at Present Address',
    address_verification: 'Address Verification',
    police_station_details: 'Police Station Details',
    signature_details: 'Signature & Place',
    name: 'Name',
    father_name: 'Father Name',
    mother_name: 'Mother Name',
    gender: 'Gender',
    mobile_number: 'Mobile Number',
    date_of_birth: 'Date of Birth',
    languages_speak: 'Languages Known to Speak',
    other_languages_speak: 'Other Languages (Speak)',
    languages_write: 'Languages Known to Write',
    other_languages_write: 'Other Languages (Write)',
    owner_name: 'Owner Name',
    owner_mobile: 'Owner Mobile Number',
    owner_company_name: 'Name of Company/Society',
    owner_address: 'Owner Address',
    person_name: 'Person Name',
    relationship: 'Relationship',
    person_mobile: 'Mobile Number',
    add_person: 'Add Person',
    remove_person: 'Remove',
    permanent_address: 'Permanent Address',
    present_address: 'Present Address',
    previous_address: 'Previous Address',
    same_as_permanent: 'Same as Permanent Address',
    police_station: 'Police Station',
    period_of_stay: 'Period of Stay',
    important_remarks: 'Any Important Remarks',
    executive_name: 'Executive Name',
    left_thumb: 'Left Thumb Impression',
    right_thumb: 'Right Thumb Impression',
    upload_impression: 'Upload Thumb Impression',
    place: 'Place',
    applicant_signature: 'Signature of the Applicant',
    upload_signature: 'Upload Signature',
    status: 'Status',
    status_in_progress: 'In Progress',
    status_completed: 'Completed',
    status_rejected: 'Rejected',
    status_additional_docs: 'Additional Documents to be Submitted',
    generate_pdf: 'Generate PDF',
    required_field: 'This field is required',
    invalid_mobile: 'Please enter a valid 10-digit mobile number',
    submit: 'Submit',
    cancel: 'Cancel',
    select_languages: 'Select Languages',
    yes: 'Yes',
    no: 'No',
    auto_fetched: 'Auto-fetched from Aadhaar',
    manual_entry: 'Manual Entry',
  };
  return texts[key] || key;
};

const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati', 'Urdu', 'Punjabi', 'Malayalam', 'Oriya'];

interface PersonStaying {
  name: string;
  relationship: string;
  mobileNumber: string;
}

interface PoliceVerificationData {
  tempId: string;
  permanentId?: string;
  aadhaarNumber: string;
  basicDetails: {
    name: string;
    fatherName: string;
    motherName: string;
    gender: string;
    mobileNumber: string;
    dateOfBirth: string;
  };
  languagePreferences: {
    languagesKnownSpeak: string[];
    otherLanguagesSpeak?: string;
    languagesKnownWrite: string[];
    otherLanguagesWrite?: string;
  };
  ownerDetails: {
    name: string;
    mobileNumber: string;
    companyName: string;
    address: string;
  };
  peopleStaying: PersonStaying[];
  addressVerification: {
    permanentAddress: string;
    presentAddress: string;
    previousAddress?: string;
    sameAsPermanent: boolean;
  };
  policeStationDetails: {
    policeStation: string;
    periodOfStay: string;
    importantRemarks: string;
    executiveName: string;
  };
  biometricInfo: {
    leftThumbImpression?: string;
    rightThumbImpression?: string;
  };
  signatureDetails: {
    place: string;
    applicantSignature?: string;
  };
  status: 'in_progress' | 'completed' | 'rejected' | 'additional_docs';
  timestamp: string;
}

export default function PoliceVerificationScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [verificationData, setVerificationData] = useState<PoliceVerificationData>({
    tempId: userData?.onboarding?.tempId || '',
    aadhaarNumber: userData?.personalDetails?.aadhaarNumber || '',
    basicDetails: {
      name: userData?.personalDetails?.name || '',
      fatherName: userData?.personalDetails?.fatherName || '',
      motherName: userData?.personalDetails?.motherName || '',
      gender: userData?.personalDetails?.gender || '',
      mobileNumber: userData?.personalDetails?.mobileNumber || '',
      dateOfBirth: userData?.personalDetails?.dateOfBirth || '',
    },
    languagePreferences: {
      languagesKnownSpeak: [],
      otherLanguagesSpeak: '',
      languagesKnownWrite: [],
      otherLanguagesWrite: '',
    },
    ownerDetails: {
      name: '',
      mobileNumber: '',
      companyName: '',
      address: '',
    },
    peopleStaying: [{
      name: '',
      relationship: '',
      mobileNumber: '',
    }],
    addressVerification: {
      permanentAddress: '',
      presentAddress: '',
      previousAddress: '',
      sameAsPermanent: false,
    },
    policeStationDetails: {
      policeStation: '',
      periodOfStay: '',
      importantRemarks: '',
      executiveName: '',
    },
    biometricInfo: {
      leftThumbImpression: undefined,
      rightThumbImpression: undefined,
    },
    signatureDetails: {
      place: '',
      applicantSignature: undefined,
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
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`police_verification_${verificationData.tempId}`);
      if (saved) {
        const data = JSON.parse(saved);
        setVerificationData(data);
      }
    } catch (error) {
      console.error('Failed to load saved police verification data:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Owner details validation
    if (!verificationData.ownerDetails.name.trim()) {
      newErrors.ownerName = getLocalizedText('required_field', language);
    }

    if (!verificationData.ownerDetails.mobileNumber.trim()) {
      newErrors.ownerMobileNumber = getLocalizedText('required_field', language);
    } else if (!/^[6-9]\d{9}$/.test(verificationData.ownerDetails.mobileNumber)) {
      newErrors.ownerMobileNumber = getLocalizedText('invalid_mobile', language);
    }

    // Address validation
    if (!verificationData.addressVerification.permanentAddress.trim()) {
      newErrors.permanentAddress = getLocalizedText('required_field', language);
    }

    if (!verificationData.addressVerification.presentAddress.trim() && !verificationData.addressVerification.sameAsPermanent) {
      newErrors.presentAddress = getLocalizedText('required_field', language);
    }

    // Police station details validation
    if (!verificationData.policeStationDetails.policeStation.trim()) {
      newErrors.policeStation = getLocalizedText('required_field', language);
    }

    if (!verificationData.policeStationDetails.executiveName.trim()) {
      newErrors.executiveName = getLocalizedText('required_field', language);
    }

    // Signature details validation
    if (!verificationData.signatureDetails.place.trim()) {
      newErrors.place = getLocalizedText('required_field', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (section: string, field: string, value: any, index?: number) => {
    if (section === 'peopleStaying' && index !== undefined) {
      setVerificationData(prev => ({
        ...prev,
        peopleStaying: prev.peopleStaying.map((person, i) => 
          i === index ? { ...person, [field]: value } : person
        )
      }));
    } else if (section === 'sameAsPermanent' && value === true) {
      // Auto-fill present address with permanent address
      setVerificationData(prev => ({
        ...prev,
        addressVerification: {
          ...prev.addressVerification,
          sameAsPermanent: value,
          presentAddress: prev.addressVerification.permanentAddress,
        }
      }));
    } else {
      setVerificationData(prev => ({
        ...prev,
        [section]: {
          ...prev[section as keyof PoliceVerificationData],
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

  const addPersonStaying = () => {
    setVerificationData(prev => ({
      ...prev,
      peopleStaying: [
        ...prev.peopleStaying,
        { name: '', relationship: '', mobileNumber: '' }
      ]
    }));
  };

  const removePersonStaying = (index: number) => {
    if (verificationData.peopleStaying.length > 1) {
      setVerificationData(prev => ({
        ...prev,
        peopleStaying: prev.peopleStaying.filter((_, i) => i !== index)
      }));
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

  const handleSignatureUpload = () => {
    // Mock implementation - in real app, would open camera/gallery or signature pad
    Alert.alert(
      'Upload Signature',
      'Upload applicant signature',
      [
        { text: 'Camera', onPress: () => console.log('Open camera') },
        { text: 'Signature Pad', onPress: () => console.log('Open signature pad') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleGeneratePDF = () => {
    Alert.alert(
      'Generate PDF',
      'Police verification form will be generated as PDF',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: () => console.log('Generate PDF') },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalData: PoliceVerificationData = {
      ...verificationData,
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to local storage
      await AsyncStorage.setItem(
        `police_verification_${verificationData.tempId}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ policeVerification: finalData });
    } catch (error) {
      console.error('Failed to save police verification data:', error);
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

  const renderOwnerDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('owner_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('owner_name', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.ownerName ? styles.inputError : null]}
          value={verificationData.ownerDetails.name}
          onChangeText={(text) => handleInputChange('ownerDetails', 'name', text)}
          placeholder="Enter owner name"
          autoCapitalize="words"
        />
        {errors.ownerName && (
          <Text style={styles.errorText}>{errors.ownerName}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('owner_mobile', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.ownerMobileNumber ? styles.inputError : null]}
          value={verificationData.ownerDetails.mobileNumber}
          onChangeText={(text) => handleInputChange('ownerDetails', 'mobileNumber', text)}
          placeholder="Enter owner mobile number"
          keyboardType="phone-pad"
          maxLength={10}
        />
        {errors.ownerMobileNumber && (
          <Text style={styles.errorText}>{errors.ownerMobileNumber}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('owner_company_name', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.ownerDetails.companyName}
          onChangeText={(text) => handleInputChange('ownerDetails', 'companyName', text)}
          placeholder="Enter company/society name"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('owner_address', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.ownerDetails.address}
          onChangeText={(text) => handleInputChange('ownerDetails', 'address', text)}
          placeholder="Enter owner address"
          multiline
          numberOfLines={2}
        />
      </View>
    </View>
  );

  const renderPeopleStayingSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {getLocalizedText('people_staying_details', language)}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={addPersonStaying}>
          <Text style={styles.addButtonText}>
            {getLocalizedText('add_person', language)}
          </Text>
        </TouchableOpacity>
      </View>

      {verificationData.peopleStaying.map((person, index) => (
        <View key={index} style={styles.personCard}>
          <View style={styles.personHeader}>
            <Text style={styles.personTitle}>Person {index + 1}</Text>
            {verificationData.peopleStaying.length > 1 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePersonStaying(index)}
              >
                <Text style={styles.removeButtonText}>
                  {getLocalizedText('remove_person', language)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('person_name', language)} *
            </Text>
            <TextInput
              style={styles.textInput}
              value={person.name}
              onChangeText={(text) => handleInputChange('peopleStaying', 'name', text, index)}
              placeholder="Enter person name"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('relationship', language)} *
            </Text>
            <TextInput
              style={styles.textInput}
              value={person.relationship}
              onChangeText={(text) => handleInputChange('peopleStaying', 'relationship', text, index)}
              placeholder="Enter relationship"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('person_mobile', language)} *
            </Text>
            <TextInput
              style={styles.textInput}
              value={person.mobileNumber}
              onChangeText={(text) => handleInputChange('peopleStaying', 'mobileNumber', text, index)}
              placeholder="Enter mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>
      ))}
    </View>
  );

  const renderAddressVerificationSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('address_verification', language)}
      </Text>

      {/* Permanent Address */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('permanent_address', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.permanentAddress ? styles.inputError : null]}
          value={verificationData.addressVerification.permanentAddress}
          onChangeText={(text) => {
            handleInputChange('addressVerification', 'permanentAddress', text);
            if (verificationData.addressVerification.sameAsPermanent) {
              handleInputChange('addressVerification', 'presentAddress', text);
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
          onPress={() => handleInputChange('sameAsPermanent', 'sameAsPermanent', !verificationData.addressVerification.sameAsPermanent)}
        >
          <Text style={styles.checkbox}>
            {verificationData.addressVerification.sameAsPermanent ? '✅' : '☑️'}
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
          value={verificationData.addressVerification.presentAddress}
          onChangeText={(text) => handleInputChange('addressVerification', 'presentAddress', text)}
          placeholder="Enter present address"
          multiline
          numberOfLines={3}
          editable={!verificationData.addressVerification.sameAsPermanent}
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
          value={verificationData.addressVerification.previousAddress || ''}
          onChangeText={(text) => handleInputChange('addressVerification', 'previousAddress', text)}
          placeholder="Enter previous address (if any)"
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );

  const renderPoliceStationDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('police_station_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('police_station', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.policeStation ? styles.inputError : null]}
          value={verificationData.policeStationDetails.policeStation}
          onChangeText={(text) => handleInputChange('policeStationDetails', 'policeStation', text)}
          placeholder="Enter police station name"
          autoCapitalize="words"
        />
        {errors.policeStation && (
          <Text style={styles.errorText}>{errors.policeStation}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('period_of_stay', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.policeStationDetails.periodOfStay}
          onChangeText={(text) => handleInputChange('policeStationDetails', 'periodOfStay', text)}
          placeholder="Enter period of stay"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('important_remarks', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.policeStationDetails.importantRemarks}
          onChangeText={(text) => handleInputChange('policeStationDetails', 'importantRemarks', text)}
          placeholder="Enter any important remarks"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('executive_name', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.executiveName ? styles.inputError : null]}
          value={verificationData.policeStationDetails.executiveName}
          onChangeText={(text) => handleInputChange('policeStationDetails', 'executiveName', text)}
          placeholder="Enter executive name"
          autoCapitalize="words"
        />
        {errors.executiveName && (
          <Text style={styles.errorText}>{errors.executiveName}</Text>
        )}
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

  const renderSignatureDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('signature_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('place', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.place ? styles.inputError : null]}
          value={verificationData.signatureDetails.place}
          onChangeText={(text) => handleInputChange('signatureDetails', 'place', text)}
          placeholder="Enter place"
          autoCapitalize="words"
        />
        {errors.place && (
          <Text style={styles.errorText}>{errors.place}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('applicant_signature', language)}
        </Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleSignatureUpload}
        >
          <Text style={styles.uploadButtonText}>
            {getLocalizedText('upload_signature', language)}
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

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.pdfButton} onPress={handleGeneratePDF}>
          <Text style={styles.pdfButtonText}>
            {getLocalizedText('generate_pdf', language)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('police_verification_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('police_verification_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderBasicDetailsSection()}
        {renderLanguagePreferencesSection()}
        {renderOwnerDetailsSection()}
        {renderPeopleStayingSection()}
        {renderAddressVerificationSection()}
        {renderPoliceStationDetailsSection()}
        {renderBiometricInfoSection()}
        {renderSignatureDetailsSection()}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
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
  personCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  personHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  personTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  removeButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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
  pdfButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pdfButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
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