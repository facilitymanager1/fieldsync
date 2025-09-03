import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';

// Localization imports
import { useTranslation, useFormTranslation, useFormatting } from '../../hooks/useLocalization';
import LocalizedText from '../../components/LocalizedText';
import LocalizedInput from '../../components/LocalizedInput';
import LocalizedForm from '../../components/LocalizedForm';
import LanguageSwitcher from '../../components/LanguageSwitcher';

// Validation imports
import { useFormValidation } from '../../hooks/useFormValidation';
import { FormValidationSchema, ValidationType, BusinessRuleAction } from '../../types/validation';

// Offline sync
import { useOfflineData } from '../../hooks/useOfflineSync';

interface BasicDetailsData {
  tempId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | '';
  fatherName?: string;
  spouseName?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pincode: string;
  aadhaarNumber: string;
  panNumber: string;
  bloodGroup?: string;
  speciallyAbled: 'Yes' | 'No' | '';
  speciallyAbledRemarks?: string;
}

const LocalizedBasicDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { tempId } = route.params as { tempId: string };

  // Localization hooks
  const { t, isRTL } = useTranslation();
  const { tf, tv, te } = useFormTranslation('onboarding');
  const { formatDate } = useFormatting();

  // Offline data hook
  const { store, get, isOnline, hasPendingChanges } = useOfflineData('employee_basic_details');

  // Form state
  const [formData, setFormData] = useState<BasicDetailsData>({
    tempId,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    pincode: '',
    aadhaarNumber: '',
    panNumber: '',
    bloodGroup: '',
    speciallyAbled: '',
    speciallyAbledRemarks: ''
  });

  const [loading, setLoading] = useState(false);

  // Validation schema with localized messages
  const validationSchema: FormValidationSchema = {
    formName: 'basicDetails',
    fields: [
      {
        fieldName: 'firstName',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') },
          { type: ValidationType.MIN_LENGTH, message: tv('minLength', { min: 2 }), params: { min: 2 } },
          { type: ValidationType.MAX_LENGTH, message: tv('maxLength', { max: 50 }), params: { max: 50 } }
        ],
        validateOnChange: true,
        debounceMs: 300
      },
      {
        fieldName: 'lastName',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') },
          { type: ValidationType.MIN_LENGTH, message: tv('minLength', { min: 2 }), params: { min: 2 } },
          { type: ValidationType.MAX_LENGTH, message: tv('maxLength', { max: 50 }), params: { max: 50 } }
        ],
        validateOnChange: true,
        debounceMs: 300
      },
      {
        fieldName: 'email',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') },
          { type: ValidationType.EMAIL, message: tv('email') }
        ],
        validateOnChange: true,
        debounceMs: 500
      },
      {
        fieldName: 'phone',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') },
          { type: ValidationType.PHONE, message: tv('phone') }
        ],
        validateOnChange: true,
        debounceMs: 300
      },
      {
        fieldName: 'dateOfBirth',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') },
          { type: ValidationType.DATE, message: tv('date'), params: { noFuture: true } }
        ],
        validateOnChange: true
      },
      {
        fieldName: 'gender',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') }
        ]
      },
      {
        fieldName: 'maritalStatus',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') }
        ]
      },
      {
        fieldName: 'fatherName',
        rules: [
          {
            type: ValidationType.REQUIRED,
            message: tv('required'),
            condition: (formData) => formData.maritalStatus === 'Single'
          },
          { type: ValidationType.MIN_LENGTH, message: tv('minLength', { min: 2 }), params: { min: 2 } }
        ],
        dependsOn: ['maritalStatus']
      },
      {
        fieldName: 'spouseName',
        rules: [
          {
            type: ValidationType.REQUIRED,
            message: tv('required'),
            condition: (formData) => formData.maritalStatus === 'Married'
          },
          { type: ValidationType.MIN_LENGTH, message: tv('minLength', { min: 2 }), params: { min: 2 } }
        ],
        dependsOn: ['maritalStatus']
      },
      {
        fieldName: 'aadhaarNumber',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') },
          { type: ValidationType.AADHAAR, message: tv('aadhaar') }
        ],
        validateOnChange: true,
        debounceMs: 500
      },
      {
        fieldName: 'panNumber',
        rules: [
          { type: ValidationType.REQUIRED, message: tv('required') },
          { type: ValidationType.PAN, message: tv('pan') }
        ],
        validateOnChange: true,
        debounceMs: 500
      },
      {
        fieldName: 'speciallyAbledRemarks',
        rules: [
          {
            type: ValidationType.REQUIRED,
            message: tv('required'),
            condition: (formData) => formData.speciallyAbled === 'Yes'
          },
          { type: ValidationType.MIN_LENGTH, message: tv('minLength', { min: 10 }), params: { min: 10 } }
        ],
        dependsOn: ['speciallyAbled']
      }
    ],
    businessRules: [
      {
        name: 'showFatherField',
        condition: (formData) => formData.maritalStatus === 'Single',
        action: BusinessRuleAction.SHOW_FIELD,
        targetField: 'fatherName',
        message: tf('fields.fatherName.help')
      },
      {
        name: 'showSpouseField',
        condition: (formData) => formData.maritalStatus === 'Married',
        action: BusinessRuleAction.SHOW_FIELD,
        targetField: 'spouseName',
        message: tf('fields.spouseName.help')
      },
      {
        name: 'showSpeciallyAbledRemarks',
        condition: (formData) => formData.speciallyAbled === 'Yes',
        action: BusinessRuleAction.SHOW_FIELD,
        targetField: 'speciallyAbledRemarks',
        message: tf('fields.speciallyAbledRemarks.help')
      }
    ]
  };

  // Form validation hook
  const {
    formState,
    setValue,
    getValue,
    validateForm,
    getFieldErrors,
    hasFieldError,
    isDirty,
    canSubmit
  } = useFormValidation({
    schema: validationSchema,
    initialData: formData
  });

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      setLoading(true);
      
      // Try to load from offline storage first
      const offlineData = await get(tempId);
      if (offlineData?.data) {
        setFormData(offlineData.data);
        return;
      }

      // Fallback to AsyncStorage
      const savedData = await AsyncStorage.getItem(`basic_details_${tempId}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setFormData(parsedData);
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
      Alert.alert(t('common.error'), te('loadDataError'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BasicDetailsData, value: string) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    setValue(field, value);
  };

  const saveData = async (showSuccessMessage: boolean = true) => {
    try {
      // Save to offline storage
      await store(tempId, formData);
      
      // Also save to AsyncStorage as backup
      await AsyncStorage.setItem(`basic_details_${tempId}`, JSON.stringify(formData));
      
      if (showSuccessMessage) {
        Alert.alert(
          t('common.success'),
          isOnline ? t('common.dataSaved') : t('common.dataSavedOffline')
        );
      }
    } catch (error) {
      console.error('Error saving data:', error);
      Alert.alert(t('common.error'), te('saveDataError'));
    }
  };

  const handleNext = async () => {
    try {
      setLoading(true);
      
      const validationResult = await validateForm();
      if (!validationResult.isValid) {
        Alert.alert(t('common.error'), tv('formInvalid'));
        return;
      }

      await saveData(false);
      
      // Navigate to next screen
      navigation.navigate('DocumentVerification', { tempId });
    } catch (error) {
      console.error('Error proceeding to next step:', error);
      Alert.alert(t('common.error'), te('navigationError'));
    } finally {
      setLoading(false);
    }
  };

  const shouldShowField = (fieldName: string): boolean => {
    const businessRule = validationSchema.businessRules?.find(rule => rule.targetField === fieldName);
    if (!businessRule) return true;
    
    return businessRule.condition ? businessRule.condition(formData) : true;
  };

  return (
    <LocalizedForm
      titleKey="onboarding.steps.basicDetails"
      fallbackTitle="Basic Details"
      showLanguageSwitcher={true}
      languageSwitcherPosition="top"
    >
      <View style={[styles.container, isRTL && styles.rtlContainer]}>
        {/* Offline status indicator */}
        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <LocalizedText
              translationKey="common.offlineMode"
              fallback="Working offline - data will sync when online"
              style={styles.offlineText}
            />
          </View>
        )}

        {/* Pending changes indicator */}
        {hasPendingChanges && (
          <View style={styles.pendingIndicator}>
            <LocalizedText
              translationKey="common.pendingSync"
              fallback="Changes pending sync"
              style={styles.pendingText}
            />
          </View>
        )}

        {/* Personal Information Section */}
        <View style={styles.section}>
          <LocalizedText
            translationKey="onboarding.sections.personalInfo"
            fallback="Personal Information"
            style={styles.sectionTitle}
          />

          <LocalizedInput
            labelKey="onboarding.fields.firstName"
            placeholderKey="onboarding.placeholders.firstName"
            fallbackLabel="First Name"
            fallbackPlaceholder="Enter your first name"
            value={formData.firstName}
            onChangeText={(value) => handleInputChange('firstName', value)}
            errorKey={hasFieldError('firstName') ? getFieldErrors('firstName')[0] : undefined}
            required={true}
            autoCapitalize="words"
          />

          <LocalizedInput
            labelKey="onboarding.fields.lastName"
            placeholderKey="onboarding.placeholders.lastName"
            fallbackLabel="Last Name"
            fallbackPlaceholder="Enter your last name"
            value={formData.lastName}
            onChangeText={(value) => handleInputChange('lastName', value)}
            errorKey={hasFieldError('lastName') ? getFieldErrors('lastName')[0] : undefined}
            required={true}
            autoCapitalize="words"
          />

          <LocalizedInput
            labelKey="onboarding.fields.email"
            placeholderKey="onboarding.placeholders.email"
            fallbackLabel="Email Address"
            fallbackPlaceholder="Enter your email address"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            errorKey={hasFieldError('email') ? getFieldErrors('email')[0] : undefined}
            required={true}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <LocalizedInput
            labelKey="onboarding.fields.phone"
            placeholderKey="onboarding.placeholders.phone"
            fallbackLabel="Phone Number"
            fallbackPlaceholder="Enter your phone number"
            value={formData.phone}
            onChangeText={(value) => handleInputChange('phone', value)}
            errorKey={hasFieldError('phone') ? getFieldErrors('phone')[0] : undefined}
            required={true}
            keyboardType="phone-pad"
          />

          <LocalizedInput
            labelKey="onboarding.fields.dateOfBirth"
            placeholderKey="onboarding.placeholders.dateOfBirth"
            fallbackLabel="Date of Birth"
            fallbackPlaceholder="DD/MM/YYYY"
            value={formData.dateOfBirth}
            onChangeText={(value) => handleInputChange('dateOfBirth', value)}
            errorKey={hasFieldError('dateOfBirth') ? getFieldErrors('dateOfBirth')[0] : undefined}
            required={true}
          />
        </View>

        {/* Family Information Section */}
        <View style={styles.section}>
          <LocalizedText
            translationKey="onboarding.sections.familyInfo"
            fallback="Family Information"
            style={styles.sectionTitle}
          />

          {/* Gender and Marital Status would need custom pickers */}
          
          {shouldShowField('fatherName') && (
            <LocalizedInput
              labelKey="onboarding.fields.fatherName"
              placeholderKey="onboarding.placeholders.fatherName"
              fallbackLabel="Father's Name"
              fallbackPlaceholder="Enter your father's name"
              value={formData.fatherName || ''}
              onChangeText={(value) => handleInputChange('fatherName', value)}
              errorKey={hasFieldError('fatherName') ? getFieldErrors('fatherName')[0] : undefined}
              required={formData.maritalStatus === 'Single'}
              autoCapitalize="words"
            />
          )}

          {shouldShowField('spouseName') && (
            <LocalizedInput
              labelKey="onboarding.fields.spouseName"
              placeholderKey="onboarding.placeholders.spouseName"
              fallbackLabel="Spouse's Name"
              fallbackPlaceholder="Enter your spouse's name"
              value={formData.spouseName || ''}
              onChangeText={(value) => handleInputChange('spouseName', value)}
              errorKey={hasFieldError('spouseName') ? getFieldErrors('spouseName')[0] : undefined}
              required={formData.maritalStatus === 'Married'}
              autoCapitalize="words"
            />
          )}
        </View>

        {/* Document Information Section */}
        <View style={styles.section}>
          <LocalizedText
            translationKey="onboarding.sections.documentInfo"
            fallback="Document Information"
            style={styles.sectionTitle}
          />

          <LocalizedInput
            labelKey="onboarding.fields.aadhaarNumber"
            placeholderKey="onboarding.placeholders.aadhaarNumber"
            fallbackLabel="Aadhaar Number"
            fallbackPlaceholder="Enter your 12-digit Aadhaar number"
            value={formData.aadhaarNumber}
            onChangeText={(value) => handleInputChange('aadhaarNumber', value)}
            errorKey={hasFieldError('aadhaarNumber') ? getFieldErrors('aadhaarNumber')[0] : undefined}
            required={true}
            keyboardType="number-pad"
            maxLength={12}
          />

          <LocalizedInput
            labelKey="onboarding.fields.panNumber"
            placeholderKey="onboarding.placeholders.panNumber"
            fallbackLabel="PAN Number"
            fallbackPlaceholder="Enter your PAN number"
            value={formData.panNumber}
            onChangeText={(value) => handleInputChange('panNumber', value.toUpperCase())}
            errorKey={hasFieldError('panNumber') ? getFieldErrors('panNumber')[0] : undefined}
            required={true}
            autoCapitalize="characters"
            maxLength={10}
          />
        </View>

        {/* Special Requirements Section */}
        {shouldShowField('speciallyAbledRemarks') && (
          <View style={styles.section}>
            <LocalizedText
              translationKey="onboarding.sections.specialRequirements"
              fallback="Special Requirements"
              style={styles.sectionTitle}
            />

            <LocalizedInput
              labelKey="onboarding.fields.speciallyAbledRemarks"
              placeholderKey="onboarding.placeholders.speciallyAbledRemarks"
              fallbackLabel="Special Requirements Details"
              fallbackPlaceholder="Please describe your special requirements"
              value={formData.speciallyAbledRemarks || ''}
              onChangeText={(value) => handleInputChange('speciallyAbledRemarks', value)}
              errorKey={hasFieldError('speciallyAbledRemarks') ? getFieldErrors('speciallyAbledRemarks')[0] : undefined}
              required={formData.speciallyAbled === 'Yes'}
              multiline={true}
              numberOfLines={4}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={[styles.buttonContainer, isRTL && styles.rtlButtonContainer]}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={() => saveData()}
            disabled={loading}
          >
            <LocalizedText
              translationKey="common.save"
              fallback="Save"
              style={styles.buttonText}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.nextButton,
              !canSubmit() && styles.disabledButton
            ]}
            onPress={handleNext}
            disabled={loading || !canSubmit()}
          >
            <LocalizedText
              translationKey="common.next"
              fallback="Next"
              style={[
                styles.buttonText,
                styles.nextButtonText,
                !canSubmit() && styles.disabledButtonText
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>
    </LocalizedForm>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  rtlContainer: {
    flexDirection: 'column',
  },
  offlineIndicator: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    borderRadius: 8,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  pendingIndicator: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    borderRadius: 8,
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  rtlButtonContainer: {
    flexDirection: 'row-reverse',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonText: {
    color: '#FFFFFF',
  },
  disabledButtonText: {
    color: '#666666',
  },
});

export default LocalizedBasicDetailsScreen;