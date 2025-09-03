/**
 * Employment Verification Screen - Verification workflow for employee background
 * 
 * Features:
 * - Employee details verification
 * - Contact details validation  
 * - Education details review
 * - Experience details collection
 * - Company details verification
 * - Status management (In Progress, Completed, Rejected, Additional Documents)
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
    personalDetails: { aadhaarNumber: '1234567890', name: 'John Doe' }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    employment_verification_title: 'Employment Verification',
    employment_verification_subtitle: 'Verify employee details and background',
    temp_id: 'Temp Employee ID',
    applicant_details: 'Applicant Details',
    contact_details: 'Contact Details',
    education_details: 'Education Details',
    experience_details: 'Experience Details', 
    company_details: 'Company Details',
    status: 'Status',
    permanent_address: 'Permanent Address',
    previous_address: 'Previous Address',
    email: 'Email',
    mobile_number: 'Mobile Number',
    land_number: 'Land Line Number',
    qualification_details: 'Qualification Details',
    institution_name: 'Institution Name',
    affiliated_university: 'Affiliated University',
    years_of_passing: 'Years of Passing',
    registration_number: 'Registration Number',
    part_full_time: 'Part Time / Full Time',
    company_name: 'Company Name',
    company_address: 'Company Address',
    designation: 'Designation',
    from_date: 'From Date',
    employee_id: 'Employee ID',
    ctc_per_annum: 'CTC Per Annum',
    hr_official_email: 'HR Official Email Address',
    reporting_manager: 'Reporting Manager Details',
    reporting_manager_contact: 'Reporting Manager Contact Number',
    reporting_manager_email: 'Reporting Manager Official Email',
    years_of_association: 'Year of Association',
    status_in_progress: 'In Progress',
    status_completed: 'Completed',
    status_rejected: 'Rejected',
    status_additional_docs: 'Additional Documents to be Submitted',
    required_field: 'This field is required',
    invalid_email: 'Please enter a valid email address',
    invalid_mobile: 'Please enter a valid 10-digit mobile number',
    submit: 'Submit',
    cancel: 'Cancel',
    dd_mm_yyyy: 'DD/MM/YYYY',
    rupees_placeholder: '₹ 0.00',
  };
  return texts[key] || key;
};

interface EmploymentVerificationData {
  tempId: string;
  applicantDetails: {
    name: string;
    profilePhoto: string;
    maritalStatus: string;
    dateOfBirth: string;
    fatherName: string;
  };
  contactDetails: {
    permanentAddress: string;
    previousAddress: string;
    email: string;
    mobileNumber: string;
    landNumber?: string;
  };
  educationDetails: {
    qualificationDetails: string;
    institutionName: string;
    affiliatedUniversity: string;
    yearsOfPassing: string;
    registrationNumber: string;
    partFullTime: 'part-time' | 'full-time';
    documents: string[];
  };
  experienceDetails: {
    companyName: string;
    companyAddress: string;
    designation: string;
    fromDate: string;
    employeeId: string;
    ctcPerAnnum: string;
    hrOfficialEmail: string;
    reportingManagerDetails: string;
    reportingManagerContact: string;
    reportingManagerEmail: string;
    yearsOfAssociation: string;
  }[];
  status: 'in_progress' | 'completed' | 'rejected' | 'additional_docs';
  timestamp: string;
}

export default function EmploymentVerificationScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [verificationData, setVerificationData] = useState<EmploymentVerificationData>({
    tempId: userData?.onboarding?.tempId || '',
    applicantDetails: {
      name: userData?.personalDetails?.name || '',
      profilePhoto: '',
      maritalStatus: '',
      dateOfBirth: '',
      fatherName: '',
    },
    contactDetails: {
      permanentAddress: '',
      previousAddress: '',
      email: '',
      mobileNumber: '',
      landNumber: '',
    },
    educationDetails: {
      qualificationDetails: '',
      institutionName: '',
      affiliatedUniversity: '',
      yearsOfPassing: '',
      registrationNumber: '',
      partFullTime: 'full-time',
      documents: [],
    },
    experienceDetails: [{
      companyName: '',
      companyAddress: '',
      designation: '',
      fromDate: '',
      employeeId: '',
      ctcPerAnnum: '',
      hrOfficialEmail: '',
      reportingManagerDetails: '',
      reportingManagerContact: '',
      reportingManagerEmail: '',
      yearsOfAssociation: '',
    }],
    status: 'in_progress',
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => {
    loadSavedData();
    prefillFromOnboarding();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`employment_verification_${verificationData.tempId}`);
      if (saved) {
        const data = JSON.parse(saved);
        setVerificationData(data);
      }
    } catch (error) {
      console.error('Failed to load saved employment verification data:', error);
    }
  };

  const prefillFromOnboarding = () => {
    if (userData?.personalDetails) {
      setVerificationData(prev => ({
        ...prev,
        applicantDetails: {
          ...prev.applicantDetails,
          name: userData.personalDetails.name || prev.applicantDetails.name,
          // Auto-fetch other details based on Aadhaar number
        }
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Contact details validation
    if (!verificationData.contactDetails.email.trim()) {
      newErrors.email = getLocalizedText('required_field', language);
    } else if (!/\S+@\S+\.\S+/.test(verificationData.contactDetails.email)) {
      newErrors.email = getLocalizedText('invalid_email', language);
    }

    if (!verificationData.contactDetails.mobileNumber.trim()) {
      newErrors.mobileNumber = getLocalizedText('required_field', language);
    } else if (!/^[6-9]\d{9}$/.test(verificationData.contactDetails.mobileNumber)) {
      newErrors.mobileNumber = getLocalizedText('invalid_mobile', language);
    }

    // Education details validation
    if (!verificationData.educationDetails.qualificationDetails.trim()) {
      newErrors.qualificationDetails = getLocalizedText('required_field', language);
    }

    if (!verificationData.educationDetails.institutionName.trim()) {
      newErrors.institutionName = getLocalizedText('required_field', language);
    }

    // Experience details validation (at least one complete entry)
    const firstExperience = verificationData.experienceDetails[0];
    if (!firstExperience.companyName.trim()) {
      newErrors.companyName = getLocalizedText('required_field', language);
    }

    if (!firstExperience.designation.trim()) {
      newErrors.designation = getLocalizedText('required_field', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (section: string, field: string, value: string, index?: number) => {
    if (section === 'experienceDetails' && index !== undefined) {
      setVerificationData(prev => ({
        ...prev,
        experienceDetails: prev.experienceDetails.map((exp, i) => 
          i === index ? { ...exp, [field]: value } : exp
        )
      }));
    } else {
      setVerificationData(prev => ({
        ...prev,
        [section]: {
          ...prev[section as keyof EmploymentVerificationData],
          [field]: value
        }
      }));
    }
    
    // Clear error when user starts typing
    const errorKey = `${section}_${field}${index !== undefined ? `_${index}` : ''}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addExperienceEntry = () => {
    setVerificationData(prev => ({
      ...prev,
      experienceDetails: [
        ...prev.experienceDetails,
        {
          companyName: '',
          companyAddress: '',
          designation: '',
          fromDate: '',
          employeeId: '',
          ctcPerAnnum: '',
          hrOfficialEmail: '',
          reportingManagerDetails: '',
          reportingManagerContact: '',
          reportingManagerEmail: '',
          yearsOfAssociation: '',
        }
      ]
    }));
  };

  const removeExperienceEntry = (index: number) => {
    if (verificationData.experienceDetails.length > 1) {
      setVerificationData(prev => ({
        ...prev,
        experienceDetails: prev.experienceDetails.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalData: EmploymentVerificationData = {
      ...verificationData,
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to local storage
      await AsyncStorage.setItem(
        `employment_verification_${verificationData.tempId}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ employmentVerification: finalData });
    } catch (error) {
      console.error('Failed to save employment verification data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const renderApplicantDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('applicant_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('temp_id', language)} *
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.tempId}
          editable={false}
          placeholder="Auto-generated Temp ID"
        />
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Name:</Text>
        <Text style={styles.infoValue}>{verificationData.applicantDetails.name}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Profile Photo:</Text>
        <Text style={styles.infoValue}>Auto-fetched from onboarding</Text>
      </View>
    </View>
  );

  const renderContactDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('contact_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('permanent_address', language)} *
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.contactDetails.permanentAddress}
          onChangeText={(text) => handleInputChange('contactDetails', 'permanentAddress', text)}
          placeholder="Enter permanent address"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('previous_address', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.contactDetails.previousAddress}
          onChangeText={(text) => handleInputChange('contactDetails', 'previousAddress', text)}
          placeholder="Enter previous address"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('email', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.email ? styles.inputError : null]}
          value={verificationData.contactDetails.email}
          onChangeText={(text) => handleInputChange('contactDetails', 'email', text)}
          placeholder="Enter email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errors.email && (
          <Text style={styles.errorText}>{errors.email}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('mobile_number', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.mobileNumber ? styles.inputError : null]}
          value={verificationData.contactDetails.mobileNumber}
          onChangeText={(text) => handleInputChange('contactDetails', 'mobileNumber', text)}
          placeholder="Enter mobile number"
          keyboardType="phone-pad"
          maxLength={10}
        />
        {errors.mobileNumber && (
          <Text style={styles.errorText}>{errors.mobileNumber}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('land_number', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.contactDetails.landNumber || ''}
          onChangeText={(text) => handleInputChange('contactDetails', 'landNumber', text)}
          placeholder="Enter land line number"
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderEducationDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('education_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('qualification_details', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.qualificationDetails ? styles.inputError : null]}
          value={verificationData.educationDetails.qualificationDetails}
          onChangeText={(text) => handleInputChange('educationDetails', 'qualificationDetails', text)}
          placeholder="Enter qualification details"
          autoCapitalize="words"
        />
        {errors.qualificationDetails && (
          <Text style={styles.errorText}>{errors.qualificationDetails}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('institution_name', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.institutionName ? styles.inputError : null]}
          value={verificationData.educationDetails.institutionName}
          onChangeText={(text) => handleInputChange('educationDetails', 'institutionName', text)}
          placeholder="Enter institution name"
          autoCapitalize="words"
        />
        {errors.institutionName && (
          <Text style={styles.errorText}>{errors.institutionName}</Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('affiliated_university', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.educationDetails.affiliatedUniversity}
          onChangeText={(text) => handleInputChange('educationDetails', 'affiliatedUniversity', text)}
          placeholder="Enter affiliated university"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('years_of_passing', language)}
        </Text>
        <TextInput
          style={styles.textInput}
          value={verificationData.educationDetails.yearsOfPassing}
          onChangeText={(text) => handleInputChange('educationDetails', 'yearsOfPassing', text)}
          placeholder="Enter year of passing"
          keyboardType="numeric"
        />
      </View>
    </View>
  );

  const renderExperienceDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {getLocalizedText('experience_details', language)}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={addExperienceEntry}>
          <Text style={styles.addButtonText}>+ Add Company</Text>
        </TouchableOpacity>
      </View>

      {verificationData.experienceDetails.map((experience, index) => (
        <View key={index} style={styles.experienceCard}>
          <View style={styles.experienceHeader}>
            <Text style={styles.experienceTitle}>Company {index + 1}</Text>
            {verificationData.experienceDetails.length > 1 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeExperienceEntry(index)}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('company_name', language)} *
            </Text>
            <TextInput
              style={[styles.textInput, errors.companyName && index === 0 ? styles.inputError : null]}
              value={experience.companyName}
              onChangeText={(text) => handleInputChange('experienceDetails', 'companyName', text, index)}
              placeholder="Enter company name"
              autoCapitalize="words"
            />
            {errors.companyName && index === 0 && (
              <Text style={styles.errorText}>{errors.companyName}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('designation', language)} *
            </Text>
            <TextInput
              style={[styles.textInput, errors.designation && index === 0 ? styles.inputError : null]}
              value={experience.designation}
              onChangeText={(text) => handleInputChange('experienceDetails', 'designation', text, index)}
              placeholder="Enter designation"
              autoCapitalize="words"
            />
            {errors.designation && index === 0 && (
              <Text style={styles.errorText}>{errors.designation}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('ctc_per_annum', language)}
            </Text>
            <TextInput
              style={styles.textInput}
              value={experience.ctcPerAnnum}
              onChangeText={(text) => handleInputChange('experienceDetails', 'ctcPerAnnum', text, index)}
              placeholder={getLocalizedText('rupees_placeholder', language)}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('hr_official_email', language)}
            </Text>
            <TextInput
              style={styles.textInput}
              value={experience.hrOfficialEmail}
              onChangeText={(text) => handleInputChange('experienceDetails', 'hrOfficialEmail', text, index)}
              placeholder="Enter HR official email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
      ))}
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
          {getLocalizedText('employment_verification_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('employment_verification_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderApplicantDetailsSection()}
        {renderContactDetailsSection()}
        {renderEducationDetailsSection()}
        {renderExperienceDetailsSection()}
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
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
  },
  infoValue: {
    fontSize: 16,
    color: '#212121',
  },
  experienceCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  experienceTitle: {
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