/**
 * Final Review Screen - Comprehensive data review and validation
 * 
 * Features:
 * - Complete data overview across all onboarding sections
 * - Edit capabilities for any section
 * - Data validation and completeness checking
 * - Missing information alerts
 * - Data export and summary generation
 * - Terms and conditions acceptance
 * - Privacy policy acknowledgment
 * - Final submission preparation
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
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Final submission:', data),
  goToPreviousStep: () => console.log('Previous step'),
  goToStep: (step: string) => console.log('Go to step:', step),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+91-9876543210'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    final_review_title: 'Final Review',
    final_review_subtitle: 'Please review all your information before submission',
    
    // Section Headers
    review_personal_info: 'Personal Information',
    review_contact_info: 'Contact Information',
    review_address_info: 'Address Information',
    review_education: 'Education Details',
    review_work_experience: 'Work Experience',
    review_bank_details: 'Bank Details',
    review_documents: 'Documents',
    review_emergency_contacts: 'Emergency Contacts',
    review_family_details: 'Family Details',
    review_statutory_details: 'Statutory Details',
    review_medical_info: 'Medical Information',
    review_transport_details: 'Transport Details',
    review_training_records: 'Training Records',
    
    // Data Summary Labels
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    date_of_birth: 'Date of Birth',
    gender: 'Gender',
    marital_status: 'Marital Status',
    nationality: 'Nationality',
    current_address: 'Current Address',
    permanent_address: 'Permanent Address',
    highest_qualification: 'Highest Qualification',
    total_experience: 'Total Experience',
    current_position: 'Current Position',
    bank_account: 'Bank Account',
    documents_uploaded: 'Documents Uploaded',
    emergency_contact: 'Emergency Contact',
    family_members: 'Family Members',
    pf_applicable: 'PF Applicable',
    esi_applicable: 'ESI Applicable',
    medical_conditions: 'Medical Conditions',
    vehicle_info: 'Vehicle Information',
    certifications: 'Certifications',
    skills: 'Skills',
    
    // Completion Status
    complete: 'Complete',
    incomplete: 'Incomplete',
    not_provided: 'Not Provided',
    optional: 'Optional',
    mandatory: 'Mandatory',
    
    // Data Quality Indicators
    all_mandatory_complete: 'All mandatory information is complete',
    missing_mandatory_info: 'Missing mandatory information',
    optional_info_missing: 'Some optional information is missing',
    data_quality_excellent: 'Excellent - All information provided',
    data_quality_good: 'Good - All mandatory information provided',
    data_quality_fair: 'Fair - Some mandatory information missing',
    data_quality_poor: 'Poor - Multiple mandatory fields missing',
    
    // Completion Percentage
    completion_rate: 'Completion Rate',
    mandatory_completion: 'Mandatory Fields',
    optional_completion: 'Optional Fields',
    overall_completion: 'Overall Completion',
    
    // Edit Actions
    edit_section: 'Edit',
    edit_personal_info: 'Edit Personal Information',
    edit_contact_info: 'Edit Contact Information',
    edit_address: 'Edit Address',
    edit_education: 'Edit Education',
    edit_experience: 'Edit Work Experience',
    edit_bank_details: 'Edit Bank Details',
    edit_documents: 'Edit Documents',
    edit_emergency: 'Edit Emergency Contacts',
    edit_family: 'Edit Family Details',
    edit_statutory: 'Edit Statutory Details',
    edit_medical: 'Edit Medical Information',
    edit_transport: 'Edit Transport Details',
    edit_training: 'Edit Training Records',
    
    // Validation Messages
    validation_passed: 'All validations passed',
    validation_errors: 'Validation errors found',
    required_field_missing: 'Required field missing',
    invalid_format: 'Invalid format',
    document_missing: 'Required document missing',
    phone_invalid: 'Invalid phone number',
    email_invalid: 'Invalid email address',
    date_invalid: 'Invalid date',
    
    // Terms and Conditions
    terms_conditions: 'Terms and Conditions',
    privacy_policy: 'Privacy Policy',
    data_consent: 'Data Processing Consent',
    terms_acceptance: 'I have read and agree to the Terms and Conditions',
    privacy_acceptance: 'I have read and agree to the Privacy Policy',
    data_consent_acceptance: 'I consent to the processing of my personal data',
    marketing_consent: 'I consent to receive marketing communications (optional)',
    
    // Legal Text (abbreviated)
    terms_text: 'By accepting these terms, you agree to provide accurate information and comply with company policies...',
    privacy_text: 'We collect and process your personal data in accordance with applicable privacy laws...',
    data_consent_text: 'Your personal data will be processed for employment purposes including...',
    
    // Data Export
    export_data: 'Export Data',
    download_summary: 'Download Summary',
    print_summary: 'Print Summary',
    save_draft: 'Save as Draft',
    
    // Summary Stats
    sections_completed: 'Sections Completed',
    documents_uploaded_count: 'Documents Uploaded',
    emergency_contacts_added: 'Emergency Contacts',
    family_members_added: 'Family Members',
    certifications_added: 'Certifications',
    skills_assessed: 'Skills Assessed',
    
    // Missing Information
    missing_info_title: 'Missing Information',
    missing_mandatory: 'Missing Mandatory Fields',
    missing_optional: 'Missing Optional Fields',
    missing_documents: 'Missing Documents',
    
    // Mandatory Fields List
    mandatory_name: 'Full Name',
    mandatory_email: 'Email Address',
    mandatory_phone: 'Phone Number',
    mandatory_dob: 'Date of Birth',
    mandatory_address: 'Current Address',
    mandatory_education: 'Education Details',
    mandatory_emergency_contact: 'Emergency Contact',
    mandatory_bank_account: 'Bank Account Details',
    mandatory_aadhaar: 'Aadhaar Number',
    mandatory_pan: 'PAN Number',
    
    // Actions
    submit_application: 'Submit Application',
    save_continue_later: 'Save & Continue Later',
    go_back: 'Go Back',
    review_edit: 'Review & Edit',
    
    // Confirmation Messages
    submit_confirmation: 'Are you sure you want to submit your application? You will not be able to edit this information after submission.',
    save_draft_confirmation: 'Your information has been saved as a draft. You can continue later.',
    data_exported: 'Data exported successfully',
    
    // Success Messages
    validation_success: 'All information validated successfully',
    ready_to_submit: 'Ready to submit',
    submission_prepared: 'Application prepared for submission',
    
    // Error Messages
    validation_failed: 'Please complete all mandatory fields before submission',
    terms_not_accepted: 'Please accept the Terms and Conditions to continue',
    privacy_not_accepted: 'Please accept the Privacy Policy to continue',
    consent_not_given: 'Data processing consent is required to continue',
    submission_error: 'Error submitting application. Please try again.',
    
    // Help Text
    review_help: 'Review all sections and ensure accuracy before final submission',
    edit_help: 'Click "Edit" next to any section to make changes',
    validation_help: 'Red indicators show missing mandatory information',
    terms_help: 'Please read and accept all agreements before submission',
    
    // Status Labels
    status_complete: '✓ Complete',
    status_incomplete: '⚠ Incomplete',
    status_missing: '✗ Missing',
    status_optional: '○ Optional',
    
    // Progress Indicators
    step_15_of_17: 'Step 15 of 17',
    almost_done: 'Almost Done!',
    final_step: 'Final Step',
    
    // Quality Scores
    excellent_score: '90-100%',
    good_score: '75-89%',
    fair_score: '60-74%',
    poor_score: 'Below 60%',
  };
  return texts[key] || key;
};

interface ReviewData {
  personalData?: any;
  educationData?: any;
  addressData?: any;
  bankDetails?: any;
  documentData?: any;
  workExperience?: any;
  emergencyContacts?: any;
  familyDetails?: any;
  statutoryDetails?: any;
  medicalInformation?: any;
  transportDetails?: any;
  trainingData?: any;
}

interface ValidationResult {
  isValid: boolean;
  mandatoryMissing: string[];
  optionalMissing: string[];
  errors: string[];
  completionRate: number;
  mandatoryCompletionRate: number;
}

interface ConsentState {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  dataConsentGiven: boolean;
  marketingConsent: boolean;
}

export default function FinalReviewScreen() {
  const { goToNextStep, goToPreviousStep, goToStep, language, userData } = useOnboarding();
  
  const [reviewData, setReviewData] = useState<ReviewData>({});
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    mandatoryMissing: [],
    optionalMissing: [],
    errors: [],
    completionRate: 0,
    mandatoryCompletionRate: 0,
  });
  
  const [consent, setConsent] = useState<ConsentState>({
    termsAccepted: false,
    privacyAccepted: false,
    dataConsentGiven: false,
    marketingConsent: false,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    validateData();
  }, [reviewData]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const username = userData?.login?.username;
      
      const [
        personalData,
        educationData,
        addressData,
        bankDetails,
        documentData,
        workExperience,
        emergencyContacts,
        familyDetails,
        statutoryDetails,
        medicalInformation,
        transportDetails,
        trainingData,
      ] = await Promise.all([
        AsyncStorage.getItem(`personal_data_${username}`),
        AsyncStorage.getItem(`education_data_${username}`),
        AsyncStorage.getItem(`address_data_${username}`),
        AsyncStorage.getItem(`bank_details_${username}`),
        AsyncStorage.getItem(`document_data_${username}`),
        AsyncStorage.getItem(`work_experience_${username}`),
        AsyncStorage.getItem(`emergency_contacts_${username}`),
        AsyncStorage.getItem(`family_details_${username}`),
        AsyncStorage.getItem(`statutory_details_${username}`),
        AsyncStorage.getItem(`medical_data_${username}`),
        AsyncStorage.getItem(`transport_data_${username}`),
        AsyncStorage.getItem(`training_data_${username}`),
      ]);

      setReviewData({
        personalData: personalData ? JSON.parse(personalData) : null,
        educationData: educationData ? JSON.parse(educationData) : null,
        addressData: addressData ? JSON.parse(addressData) : null,
        bankDetails: bankDetails ? JSON.parse(bankDetails) : null,
        documentData: documentData ? JSON.parse(documentData) : null,
        workExperience: workExperience ? JSON.parse(workExperience) : null,
        emergencyContacts: emergencyContacts ? JSON.parse(emergencyContacts) : null,
        familyDetails: familyDetails ? JSON.parse(familyDetails) : null,
        statutoryDetails: statutoryDetails ? JSON.parse(statutoryDetails) : null,
        medicalInformation: medicalInformation ? JSON.parse(medicalInformation) : null,
        transportDetails: transportDetails ? JSON.parse(transportDetails) : null,
        trainingData: trainingData ? JSON.parse(trainingData) : null,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateData = () => {
    const mandatoryMissing: string[] = [];
    const optionalMissing: string[] = [];
    const errors: string[] = [];

    // Validate mandatory fields
    if (!reviewData.personalData?.firstName || !reviewData.personalData?.lastName) {
      mandatoryMissing.push('mandatory_name');
    }
    
    if (!reviewData.personalData?.email) {
      mandatoryMissing.push('mandatory_email');
    } else if (!isValidEmail(reviewData.personalData.email)) {
      errors.push('email_invalid');
    }
    
    if (!reviewData.personalData?.phoneNumber) {
      mandatoryMissing.push('mandatory_phone');
    } else if (!isValidPhone(reviewData.personalData.phoneNumber)) {
      errors.push('phone_invalid');
    }
    
    if (!reviewData.personalData?.dateOfBirth) {
      mandatoryMissing.push('mandatory_dob');
    }
    
    if (!reviewData.addressData?.currentAddress?.street) {
      mandatoryMissing.push('mandatory_address');
    }
    
    if (!reviewData.educationData?.qualifications?.length) {
      mandatoryMissing.push('mandatory_education');
    }
    
    if (!reviewData.emergencyContacts?.contacts?.length) {
      mandatoryMissing.push('mandatory_emergency_contact');
    }
    
    if (!reviewData.bankDetails?.accountNumber) {
      mandatoryMissing.push('mandatory_bank_account');
    }
    
    if (!reviewData.personalData?.aadhaarNumber) {
      mandatoryMissing.push('mandatory_aadhaar');
    }
    
    if (!reviewData.personalData?.panNumber) {
      mandatoryMissing.push('mandatory_pan');
    }

    // Check optional fields
    if (!reviewData.workExperience?.experiences?.length) {
      optionalMissing.push('work_experience');
    }
    
    if (!reviewData.familyDetails?.familyMembers?.length) {
      optionalMissing.push('family_details');
    }
    
    if (!reviewData.medicalInformation) {
      optionalMissing.push('medical_information');
    }
    
    if (!reviewData.transportDetails) {
      optionalMissing.push('transport_details');
    }
    
    if (!reviewData.trainingData?.certifications?.length) {
      optionalMissing.push('training_records');
    }

    // Calculate completion rates
    const totalMandatoryFields = 10;
    const completedMandatoryFields = totalMandatoryFields - mandatoryMissing.length;
    const mandatoryCompletionRate = (completedMandatoryFields / totalMandatoryFields) * 100;

    const totalOptionalFields = 5;
    const completedOptionalFields = totalOptionalFields - optionalMissing.length;
    const optionalCompletionRate = (completedOptionalFields / totalOptionalFields) * 100;

    const overallCompletionRate = (mandatoryCompletionRate * 0.7) + (optionalCompletionRate * 0.3);

    setValidation({
      isValid: mandatoryMissing.length === 0 && errors.length === 0,
      mandatoryMissing,
      optionalMissing,
      errors,
      completionRate: Math.round(overallCompletionRate),
      mandatoryCompletionRate: Math.round(mandatoryCompletionRate),
    });
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^[\+]?[1-9][\d]{9,14}$/;
    return phoneRegex.test(phone.replace(/[-\s]/g, ''));
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getQualityBadge = () => {
    const rate = validation.completionRate;
    if (rate >= 90) return { text: 'data_quality_excellent', color: '#4CAF50' };
    if (rate >= 75) return { text: 'data_quality_good', color: '#2196F3' };
    if (rate >= 60) return { text: 'data_quality_fair', color: '#FF9800' };
    return { text: 'data_quality_poor', color: '#F44336' };
  };

  const getSectionStatus = (data: any, mandatoryField?: string) => {
    if (mandatoryField && validation.mandatoryMissing.includes(mandatoryField)) {
      return { icon: '✗', text: 'status_missing', color: '#F44336' };
    }
    if (data && Object.keys(data).length > 0) {
      return { icon: '✓', text: 'status_complete', color: '#4CAF50' };
    }
    return { icon: '○', text: 'status_optional', color: '#757575' };
  };

  const handleConsentChange = (type: keyof ConsentState, value: boolean) => {
    setConsent(prev => ({ ...prev, [type]: value }));
  };

  const handleSubmit = async () => {
    if (!validation.isValid) {
      Alert.alert('Validation Error', getLocalizedText('validation_failed', language));
      return;
    }

    if (!consent.termsAccepted) {
      Alert.alert('Terms Required', getLocalizedText('terms_not_accepted', language));
      return;
    }

    if (!consent.privacyAccepted) {
      Alert.alert('Privacy Policy Required', getLocalizedText('privacy_not_accepted', language));
      return;
    }

    if (!consent.dataConsentGiven) {
      Alert.alert('Consent Required', getLocalizedText('consent_not_given', language));
      return;
    }

    Alert.alert(
      'Submit Application',
      getLocalizedText('submit_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Submit', 
          onPress: async () => {
            setIsLoading(true);
            try {
              const finalSubmission = {
                ...reviewData,
                consent,
                validation,
                submissionTimestamp: new Date().toISOString(),
                status: 'submitted',
              };

              await AsyncStorage.setItem(
                `final_submission_${userData?.login?.username}`,
                JSON.stringify(finalSubmission)
              );

              goToNextStep({ finalSubmission });
            } catch (error) {
              console.error('Submission error:', error);
              Alert.alert('Error', getLocalizedText('submission_error', language));
            } finally {
              setIsLoading(false);
            }
          }
        },
      ]
    );
  };

  const handleSaveDraft = async () => {
    try {
      const draftData = {
        ...reviewData,
        consent,
        validation,
        lastSaved: new Date().toISOString(),
        status: 'draft',
      };

      await AsyncStorage.setItem(
        `draft_submission_${userData?.login?.username}`,
        JSON.stringify(draftData)
      );

      Alert.alert('Draft Saved', getLocalizedText('save_draft_confirmation', language));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const renderOverviewCard = () => {
    const qualityBadge = getQualityBadge();
    
    return (
      <Card title="Application Overview" variant="outlined" margin={8}>
        <View style={styles.overviewContent}>
          {/* Completion Rate */}
          <View style={styles.completionSection}>
            <Text style={styles.completionTitle}>
              {getLocalizedText('completion_rate', language)}
            </Text>
            
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${validation.completionRate}%`, backgroundColor: qualityBadge.color }
                ]} 
              />
            </View>
            
            <Text style={styles.completionPercentage}>
              {validation.completionRate}%
            </Text>
          </View>

          {/* Quality Badge */}
          <View style={[styles.qualityBadge, { backgroundColor: qualityBadge.color }]}>
            <Text style={styles.qualityText}>
              {getLocalizedText(qualityBadge.text, language)}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Object.keys(reviewData).filter(key => reviewData[key as keyof ReviewData]).length}
              </Text>
              <Text style={styles.statLabel}>
                {getLocalizedText('sections_completed', language)}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {validation.mandatoryCompletionRate}%
              </Text>
              <Text style={styles.statLabel}>
                {getLocalizedText('mandatory_completion', language)}
              </Text>
            </View>
          </View>

          {/* Missing Information Alert */}
          {validation.mandatoryMissing.length > 0 && (
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>
                {getLocalizedText('missing_mandatory', language)}
              </Text>
              {validation.mandatoryMissing.map((field) => (
                <Text key={field} style={styles.alertItem}>
                  • {getLocalizedText(field, language)}
                </Text>
              ))}
            </View>
          )}
        </View>
      </Card>
    );
  };

  const renderSectionSummary = (
    title: string,
    data: any,
    editAction: string,
    mandatoryField?: string
  ) => {
    const status = getSectionStatus(data, mandatoryField);
    const isExpanded = expandedSections.has(title);
    
    return (
      <Card key={title} variant="outlined" margin={4}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(title)}
        >
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionStatus, { color: status.color }]}>
              {status.icon}
            </Text>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.expandIcon}>
              {isExpanded ? '▲' : '▼'}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => goToStep(editAction)}
          >
            <Text style={styles.editButtonText}>
              {getLocalizedText('edit_section', language)}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {isExpanded && data && (
          <View style={styles.sectionContent}>
            {renderSectionData(data)}
          </View>
        )}
      </Card>
    );
  };

  const renderSectionData = (data: any) => {
    if (!data || typeof data !== 'object') return null;

    return (
      <View style={styles.dataPreview}>
        {Object.entries(data).slice(0, 3).map(([key, value]) => (
          <Text key={key} style={styles.dataItem}>
            {key}: {typeof value === 'object' ? '[Object]' : String(value).substring(0, 50)}
          </Text>
        ))}
        {Object.keys(data).length > 3 && (
          <Text style={styles.moreData}>
            +{Object.keys(data).length - 3} more fields...
          </Text>
        )}
      </View>
    );
  };

  const renderConsentSection = () => (
    <Card title={getLocalizedText('terms_conditions', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('terms_help', language)}
      </Text>

      {/* Terms and Conditions */}
      <View style={styles.consentItem}>
        <Switch
          value={consent.termsAccepted}
          onValueChange={(value) => handleConsentChange('termsAccepted', value)}
        />
        <TouchableOpacity 
          style={styles.consentText}
          onPress={() => setShowModal('terms')}
        >
          <Text style={styles.consentLabel}>
            {getLocalizedText('terms_acceptance', language)}
          </Text>
          <Text style={styles.consentLink}>(Read Terms)</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Policy */}
      <View style={styles.consentItem}>
        <Switch
          value={consent.privacyAccepted}
          onValueChange={(value) => handleConsentChange('privacyAccepted', value)}
        />
        <TouchableOpacity 
          style={styles.consentText}
          onPress={() => setShowModal('privacy')}
        >
          <Text style={styles.consentLabel}>
            {getLocalizedText('privacy_acceptance', language)}
          </Text>
          <Text style={styles.consentLink}>(Read Privacy Policy)</Text>
        </TouchableOpacity>
      </View>

      {/* Data Consent */}
      <View style={styles.consentItem}>
        <Switch
          value={consent.dataConsentGiven}
          onValueChange={(value) => handleConsentChange('dataConsentGiven', value)}
        />
        <TouchableOpacity 
          style={styles.consentText}
          onPress={() => setShowModal('data-consent')}
        >
          <Text style={styles.consentLabel}>
            {getLocalizedText('data_consent_acceptance', language)}
          </Text>
          <Text style={styles.consentLink}>(Read Details)</Text>
        </TouchableOpacity>
      </View>

      {/* Marketing Consent (Optional) */}
      <View style={styles.consentItem}>
        <Switch
          value={consent.marketingConsent}
          onValueChange={(value) => handleConsentChange('marketingConsent', value)}
        />
        <Text style={styles.consentText}>
          <Text style={styles.consentLabel}>
            {getLocalizedText('marketing_consent', language)}
          </Text>
        </Text>
      </View>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading your information...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('final_review_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('final_review_subtitle', language)}
        </Text>
        <Text style={styles.stepIndicator}>
          {getLocalizedText('step_15_of_17', language)} • {getLocalizedText('almost_done', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview */}
        {renderOverviewCard()}

        {/* Section Reviews */}
        {renderSectionSummary(
          getLocalizedText('review_personal_info', language),
          reviewData.personalData,
          'personal-details',
          'mandatory_name'
        )}

        {renderSectionSummary(
          getLocalizedText('review_address_info', language),
          reviewData.addressData,
          'address-details',
          'mandatory_address'
        )}

        {renderSectionSummary(
          getLocalizedText('review_education', language),
          reviewData.educationData,
          'education-details',
          'mandatory_education'
        )}

        {renderSectionSummary(
          getLocalizedText('review_work_experience', language),
          reviewData.workExperience,
          'work-experience'
        )}

        {renderSectionSummary(
          getLocalizedText('review_bank_details', language),
          reviewData.bankDetails,
          'bank-details',
          'mandatory_bank_account'
        )}

        {renderSectionSummary(
          getLocalizedText('review_documents', language),
          reviewData.documentData,
          'document-upload'
        )}

        {renderSectionSummary(
          getLocalizedText('review_emergency_contacts', language),
          reviewData.emergencyContacts,
          'emergency-contacts',
          'mandatory_emergency_contact'
        )}

        {renderSectionSummary(
          getLocalizedText('review_family_details', language),
          reviewData.familyDetails,
          'family-details'
        )}

        {renderSectionSummary(
          getLocalizedText('review_statutory_details', language),
          reviewData.statutoryDetails,
          'statutory-details'
        )}

        {renderSectionSummary(
          getLocalizedText('review_medical_info', language),
          reviewData.medicalInformation,
          'medical-information'
        )}

        {renderSectionSummary(
          getLocalizedText('review_transport_details', language),
          reviewData.transportDetails,
          'transport-details'
        )}

        {renderSectionSummary(
          getLocalizedText('review_training_records', language),
          reviewData.trainingData,
          'training-records'
        )}

        {/* Consent Section */}
        {renderConsentSection()}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={getLocalizedText('save_continue_later', language)}
          onPress={handleSaveDraft}
          variant="text"
          size="medium"
        />
        
        <Button
          title={getLocalizedText('submit_application', language)}
          onPress={handleSubmit}
          variant="primary"
          size="medium"
          disabled={!validation.isValid || !consent.termsAccepted || !consent.privacyAccepted || !consent.dataConsentGiven}
          loading={isLoading}
        />
      </View>

      {/* Modal for Terms/Privacy */}
      <Modal
        visible={showModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {showModal === 'terms' && getLocalizedText('terms_conditions', language)}
              {showModal === 'privacy' && getLocalizedText('privacy_policy', language)}
              {showModal === 'data-consent' && getLocalizedText('data_consent', language)}
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalText}>
                {showModal === 'terms' && getLocalizedText('terms_text', language)}
                {showModal === 'privacy' && getLocalizedText('privacy_text', language)}
                {showModal === 'data-consent' && getLocalizedText('data_consent_text', language)}
              </Text>
            </ScrollView>
            
            <Button
              title="Close"
              onPress={() => setShowModal(null)}
              variant="primary"
              size="medium"
            />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
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
    marginBottom: 8,
  },
  stepIndicator: {
    fontSize: 14,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '600',
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
  overviewContent: {
    padding: 4,
  },
  completionSection: {
    marginBottom: 20,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  completionPercentage: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
  },
  qualityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  qualityText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    marginTop: 4,
  },
  alertBox: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    padding: 12,
    borderRadius: 4,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
    marginBottom: 8,
  },
  alertItem: {
    fontSize: 14,
    color: '#D32F2F',
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionStatus: {
    fontSize: 16,
    marginRight: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  expandIcon: {
    fontSize: 14,
    color: '#757575',
    marginRight: 12,
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  dataPreview: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 6,
  },
  dataItem: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 4,
  },
  moreData: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  consentText: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  consentLabel: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
  },
  consentLink: {
    fontSize: 14,
    color: '#2196F3',
    textDecorationLine: 'underline',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 300,
    marginBottom: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
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
