/**
 * Completion Screen - Onboarding completion and next steps
 * 
 * Features:
 * - Success confirmation message
 * - Application submission summary
 * - Next steps guidance
 * - Contact information for support
 * - Timeline expectations
 * - Document receipt confirmation
 * - Access credentials information
 * - Welcome message and company culture introduction
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import UI components
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';

// Temporary mock implementations
const useOnboarding = () => ({
  completeOnboarding: () => console.log('Onboarding completed'),
  goToLogin: () => console.log('Go to login'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    },
    finalSubmission: {
      submissionTimestamp: new Date().toISOString(),
      validation: { completionRate: 95 }
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    completion_title: 'Welcome to FieldSync!',
    completion_subtitle: 'Your application has been successfully submitted',
    
    // Success Messages
    success_message: 'Congratulations! Your onboarding is complete.',
    application_submitted: 'Application Successfully Submitted',
    submission_confirmed: 'Your application has been received and is being processed.',
    welcome_message: 'Welcome to the FieldSync family!',
    
    // Submission Details
    submission_details: 'Submission Details',
    submission_id: 'Submission ID',
    submission_time: 'Submitted At',
    completion_rate: 'Completion Rate',
    application_status: 'Application Status',
    
    // Status Values
    status_submitted: 'Submitted',
    status_under_review: 'Under Review',
    status_processing: 'Processing',
    status_approved: 'Approved',
    status_pending: 'Pending',
    
    // Next Steps
    next_steps_title: 'What Happens Next?',
    next_step_1: 'Application Review',
    next_step_1_desc: 'HR will review your application within 2-3 business days',
    next_step_2: 'Background Verification',
    next_step_2_desc: 'We will verify your documents and background information',
    next_step_3: 'Account Setup',
    next_step_3_desc: 'Your system accounts and access credentials will be created',
    next_step_4: 'Welcome Kit',
    next_step_4_desc: 'You will receive your welcome kit and orientation materials',
    next_step_5: 'First Day',
    next_step_5_desc: 'Report to your assigned location for orientation and training',
    
    // Timeline
    timeline_title: 'Expected Timeline',
    review_timeline: '2-3 Business Days',
    verification_timeline: '3-5 Business Days',
    setup_timeline: '1-2 Business Days',
    total_timeline: '1-2 Weeks Total',
    
    // Important Information
    important_info_title: 'Important Information',
    keep_phone_active: 'Keep your phone number active for important updates',
    check_email_regularly: 'Check your email regularly for status updates',
    document_originals: 'Keep original documents ready for verification',
    contact_hr_changes: 'Contact HR immediately if any information changes',
    
    // Contact Information
    contact_info_title: 'Contact Information',
    hr_contact: 'HR Department',
    hr_phone: 'Phone: +91-80-1234-5678',
    hr_email: 'Email: hr@fieldsync.com',
    support_contact: 'Technical Support',
    support_phone: 'Phone: +91-80-1234-5679',
    support_email: 'Email: support@fieldsync.com',
    
    // Document Receipt
    document_receipt_title: 'Document Receipt',
    documents_received: 'Documents Received',
    documents_pending: 'Documents Pending',
    additional_documents: 'Additional Documents Required',
    document_status_complete: 'All required documents received',
    document_status_pending: 'Some documents are pending verification',
    
    // Access Credentials
    credentials_title: 'System Access',
    credentials_info: 'Your system access credentials will be sent to your registered email within 24-48 hours after approval.',
    temp_access: 'Temporary access credentials may be provided if immediate access is required.',
    security_notice: 'Keep your credentials secure and do not share with others.',
    
    // Company Information
    company_culture_title: 'Welcome to Our Culture',
    culture_value_1: 'Excellence',
    culture_value_1_desc: 'We strive for excellence in everything we do',
    culture_value_2: 'Integrity',
    culture_value_2_desc: 'We maintain the highest standards of integrity',
    culture_value_3: 'Innovation',
    culture_value_3_desc: 'We embrace innovation and continuous improvement',
    culture_value_4: 'Teamwork',
    culture_value_4_desc: 'We believe in the power of teamwork and collaboration',
    
    // Benefits Overview
    benefits_title: 'Your Benefits Overview',
    health_insurance: 'Comprehensive Health Insurance',
    life_insurance: 'Life Insurance Coverage',
    provident_fund: 'Provident Fund Contribution',
    paid_leave: 'Paid Time Off',
    training_budget: 'Annual Training Budget',
    performance_bonus: 'Performance-based Bonuses',
    
    // Resources
    resources_title: 'Helpful Resources',
    employee_handbook: 'Employee Handbook',
    policy_manual: 'Policy Manual',
    training_portal: 'Training Portal',
    hr_portal: 'HR Self-Service Portal',
    mobile_app: 'FieldSync Mobile App',
    
    // Actions
    download_summary: 'Download Summary',
    email_summary: 'Email Summary',
    save_reference: 'Save Reference Number',
    contact_hr: 'Contact HR',
    go_to_login: 'Go to Login',
    complete_onboarding: 'Complete',
    
    // Reference Numbers
    reference_number: 'Reference Number',
    application_ref: 'Application Reference',
    submission_ref: 'Submission Reference',
    
    // Notifications
    email_notification: 'Email notifications have been enabled',
    sms_notification: 'SMS notifications have been enabled',
    push_notification: 'Push notifications have been enabled',
    
    // Support
    need_help: 'Need Help?',
    help_description: 'If you have any questions or need assistance, please don\'t hesitate to contact our HR team.',
    emergency_contact: 'Emergency Contact',
    business_hours: 'Business Hours: Monday to Friday, 9:00 AM to 6:00 PM',
    
    // Feedback
    feedback_title: 'Share Your Feedback',
    feedback_description: 'Help us improve our onboarding process by sharing your experience.',
    feedback_survey: 'Take Survey',
    feedback_rating: 'Rate Your Experience',
    
    // Legal
    data_processing: 'Data Processing Notice',
    data_processing_desc: 'Your personal data will be processed in accordance with our Privacy Policy.',
    retention_policy: 'Data Retention Policy',
    retention_desc: 'We will retain your data as per company policy and legal requirements.',
    
    // Final Messages
    thank_you: 'Thank You!',
    excitement_message: 'We are excited to have you join our team and look forward to working with you.',
    journey_begins: 'Your journey with FieldSync begins now!',
    
    // Error Messages
    submission_id_error: 'Error generating submission ID',
    download_error: 'Error downloading summary',
    email_error: 'Error sending email',
    
    // Loading Messages
    generating_summary: 'Generating summary...',
    preparing_documents: 'Preparing documents...',
    sending_notifications: 'Sending notifications...',
    
    // Completion Stats
    onboarding_complete: 'Onboarding 100% Complete',
    total_sections: 'Total Sections Completed',
    documents_uploaded: 'Documents Uploaded',
    information_verified: 'Information Verified',
    
    // Success Indicators
    checkmark: '✓',
    success_icon: '🎉',
    welcome_icon: '👋',
    document_icon: '📄',
    calendar_icon: '📅',
    contact_icon: '📞',
    email_icon: '📧',
    
    // Motivational Messages
    congratulations: 'Congratulations!',
    well_done: 'Well Done!',
    outstanding: 'Outstanding!',
    excellent_work: 'Excellent Work!',
    
    // Step Progress
    step_17_of_17: 'Step 17 of 17',
    onboarding_completed: 'Onboarding Completed!',
    journey_complete: 'Journey Complete',
  };
  return texts[key] || key;
};

const { width, height } = Dimensions.get('window');

export default function CompletionScreen() {
  const { completeOnboarding, goToLogin, language, userData } = useOnboarding();
  
  const [submissionId] = useState(`FS-${Date.now().toString().slice(-8)}`);
  const [isLoading, setIsLoading] = useState(false);
  const [animationValues] = useState({
    fadeIn: new Animated.Value(0),
    slideUp: new Animated.Value(50),
    scale: new Animated.Value(0.8),
  });

  useEffect(() => {
    startAnimations();
    generateSubmissionRecord();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(animationValues.fadeIn, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(animationValues.slideUp, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(animationValues.scale, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const generateSubmissionRecord = async () => {
    try {
      const completionData = {
        submissionId,
        userId: userData?.login?.username,
        completionTimestamp: new Date().toISOString(),
        status: 'completed',
        completionRate: userData?.finalSubmission?.validation?.completionRate || 100,
        submissionTimestamp: userData?.finalSubmission?.submissionTimestamp,
      };

      await AsyncStorage.setItem(
        `completion_record_${userData?.login?.username}`,
        JSON.stringify(completionData)
      );
    } catch (error) {
      console.error('Failed to generate submission record:', error);
    }
  };

  const handleDownloadSummary = async () => {
    setIsLoading(true);
    try {
      // Simulate download process
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('Success', 'Summary downloaded successfully');
    } catch (error) {
      Alert.alert('Error', getLocalizedText('download_error', language));
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactHR = () => {
    Alert.alert(
      getLocalizedText('contact_hr', language),
      `${getLocalizedText('hr_phone', language)}\n${getLocalizedText('hr_email', language)}`,
      [
        { text: 'Call', onPress: () => console.log('Call HR') },
        { text: 'Email', onPress: () => console.log('Email HR') },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const renderSuccessHeader = () => (
    <Animated.View 
      style={[
        styles.successHeader,
        {
          opacity: animationValues.fadeIn,
          transform: [
            { translateY: animationValues.slideUp },
            { scale: animationValues.scale }
          ]
        }
      ]}
    >
      <Text style={styles.successIcon}>🎉</Text>
      <Text style={styles.successTitle}>
        {getLocalizedText('completion_title', language)}
      </Text>
      <Text style={styles.successSubtitle}>
        {getLocalizedText('completion_subtitle', language)}
      </Text>
      <Text style={styles.stepIndicator}>
        {getLocalizedText('step_17_of_17', language)} • {getLocalizedText('onboarding_completed', language)}
      </Text>
    </Animated.View>
  );

  const renderSubmissionDetails = () => (
    <Card title={getLocalizedText('submission_details', language)} variant="outlined" margin={8}>
      <View style={styles.detailsContent}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>
            {getLocalizedText('submission_id', language)}:
          </Text>
          <Text style={styles.detailValue}>{submissionId}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>
            {getLocalizedText('submission_time', language)}:
          </Text>
          <Text style={styles.detailValue}>
            {new Date().toLocaleString()}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>
            {getLocalizedText('completion_rate', language)}:
          </Text>
          <Text style={[styles.detailValue, styles.completionValue]}>
            {userData?.finalSubmission?.validation?.completionRate || 100}%
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>
            {getLocalizedText('application_status', language)}:
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {getLocalizedText('status_submitted', language)}
            </Text>
          </View>
        </View>

        <View style={styles.completionBadge}>
          <Text style={styles.completionBadgeText}>
            ✓ {getLocalizedText('onboarding_complete', language)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderNextSteps = () => (
    <Card title={getLocalizedText('next_steps_title', language)} variant="outlined" margin={8}>
      <View style={styles.stepsContainer}>
        {[
          { step: 'next_step_1', desc: 'next_step_1_desc', icon: '📋' },
          { step: 'next_step_2', desc: 'next_step_2_desc', icon: '🔍' },
          { step: 'next_step_3', desc: 'next_step_3_desc', icon: '⚙️' },
          { step: 'next_step_4', desc: 'next_step_4_desc', icon: '📦' },
          { step: 'next_step_5', desc: 'next_step_5_desc', icon: '🚀' },
        ].map((item, index) => (
          <View key={index} style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepIconText}>{item.icon}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>
                {getLocalizedText(item.step, language)}
              </Text>
              <Text style={styles.stepDescription}>
                {getLocalizedText(item.desc, language)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );

  const renderTimeline = () => (
    <Card title={getLocalizedText('timeline_title', language)} variant="outlined" margin={8}>
      <View style={styles.timelineContent}>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineLabel}>
            {getLocalizedText('next_step_1', language)}:
          </Text>
          <Text style={styles.timelineValue}>
            {getLocalizedText('review_timeline', language)}
          </Text>
        </View>
        
        <View style={styles.timelineItem}>
          <Text style={styles.timelineLabel}>
            {getLocalizedText('next_step_2', language)}:
          </Text>
          <Text style={styles.timelineValue}>
            {getLocalizedText('verification_timeline', language)}
          </Text>
        </View>
        
        <View style={styles.timelineItem}>
          <Text style={styles.timelineLabel}>
            {getLocalizedText('next_step_3', language)}:
          </Text>
          <Text style={styles.timelineValue}>
            {getLocalizedText('setup_timeline', language)}
          </Text>
        </View>
        
        <View style={styles.totalTimelineItem}>
          <Text style={styles.totalTimelineLabel}>
            {getLocalizedText('total_timeline', language)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderContactInfo = () => (
    <Card title={getLocalizedText('contact_info_title', language)} variant="outlined" margin={8}>
      <View style={styles.contactContent}>
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>
            📞 {getLocalizedText('hr_contact', language)}
          </Text>
          <Text style={styles.contactDetail}>
            {getLocalizedText('hr_phone', language)}
          </Text>
          <Text style={styles.contactDetail}>
            {getLocalizedText('hr_email', language)}
          </Text>
        </View>
        
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>
            🛠️ {getLocalizedText('support_contact', language)}
          </Text>
          <Text style={styles.contactDetail}>
            {getLocalizedText('support_phone', language)}
          </Text>
          <Text style={styles.contactDetail}>
            {getLocalizedText('support_email', language)}
          </Text>
        </View>
        
        <View style={styles.businessHours}>
          <Text style={styles.businessHoursText}>
            {getLocalizedText('business_hours', language)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderImportantInfo = () => (
    <Card title={getLocalizedText('important_info_title', language)} variant="outlined" margin={8}>
      <View style={styles.importantContent}>
        {[
          'keep_phone_active',
          'check_email_regularly',
          'document_originals',
          'contact_hr_changes',
        ].map((item, index) => (
          <View key={index} style={styles.importantItem}>
            <Text style={styles.importantIcon}>⚠️</Text>
            <Text style={styles.importantText}>
              {getLocalizedText(item, language)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );

  const renderCompanyCulture = () => (
    <Card title={getLocalizedText('company_culture_title', language)} variant="outlined" margin={8}>
      <View style={styles.cultureContent}>
        {[
          { value: 'culture_value_1', desc: 'culture_value_1_desc', icon: '⭐' },
          { value: 'culture_value_2', desc: 'culture_value_2_desc', icon: '🤝' },
          { value: 'culture_value_3', desc: 'culture_value_3_desc', icon: '💡' },
          { value: 'culture_value_4', desc: 'culture_value_4_desc', icon: '👥' },
        ].map((item, index) => (
          <View key={index} style={styles.cultureItem}>
            <Text style={styles.cultureIcon}>{item.icon}</Text>
            <View style={styles.cultureTextContainer}>
              <Text style={styles.cultureValue}>
                {getLocalizedText(item.value, language)}
              </Text>
              <Text style={styles.cultureDescription}>
                {getLocalizedText(item.desc, language)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      {renderSuccessHeader()}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Submission Details */}
        {renderSubmissionDetails()}

        {/* Next Steps */}
        {renderNextSteps()}

        {/* Timeline */}
        {renderTimeline()}

        {/* Important Information */}
        {renderImportantInfo()}

        {/* Contact Information */}
        {renderContactInfo()}

        {/* Company Culture */}
        {renderCompanyCulture()}

        {/* Final Message */}
        <Card variant="outlined" margin={8}>
          <View style={styles.finalMessage}>
            <Text style={styles.thankYouIcon}>🙏</Text>
            <Text style={styles.thankYouTitle}>
              {getLocalizedText('thank_you', language)}
            </Text>
            <Text style={styles.excitementMessage}>
              {getLocalizedText('excitement_message', language)}
            </Text>
            <Text style={styles.journeyMessage}>
              {getLocalizedText('journey_begins', language)}
            </Text>
          </View>
        </Card>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title={getLocalizedText('download_summary', language)}
          onPress={handleDownloadSummary}
          variant="outline"
          size="medium"
          loading={isLoading}
          icon={<Text style={styles.buttonIcon}>📄</Text>}
        />
        
        <Button
          title={getLocalizedText('contact_hr', language)}
          onPress={handleContactHR}
          variant="text"
          size="medium"
          icon={<Text style={styles.buttonIcon}>📞</Text>}
        />
        
        <Button
          title={getLocalizedText('complete_onboarding', language)}
          onPress={() => {
            completeOnboarding();
            goToLogin();
          }}
          variant="primary"
          size="medium"
          icon={<Text style={styles.buttonIcon}>✓</Text>}
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
  successHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 12,
  },
  stepIndicator: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
  },
  detailsContent: {
    padding: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#757575',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  completionValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  completionBadge: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  completionBadgeText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '700',
  },
  stepsContainer: {
    padding: 4,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepIconText: {
    fontSize: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
  },
  timelineContent: {
    padding: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timelineLabel: {
    fontSize: 14,
    color: '#424242',
    flex: 1,
  },
  timelineValue: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  totalTimelineItem: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  totalTimelineLabel: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '700',
  },
  contactContent: {
    padding: 4,
  },
  contactSection: {
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  contactDetail: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 4,
  },
  businessHours: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  businessHoursText: {
    fontSize: 14,
    color: '#E65100',
    textAlign: 'center',
    fontWeight: '500',
  },
  importantContent: {
    padding: 4,
  },
  importantItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  importantIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
  },
  importantText: {
    fontSize: 14,
    color: '#424242',
    flex: 1,
    lineHeight: 20,
  },
  cultureContent: {
    padding: 4,
  },
  cultureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cultureIcon: {
    fontSize: 24,
    marginRight: 16,
    marginTop: 4,
  },
  cultureTextContainer: {
    flex: 1,
  },
  cultureValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  cultureDescription: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
  },
  finalMessage: {
    alignItems: 'center',
    padding: 20,
  },
  thankYouIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  excitementMessage: {
    fontSize: 16,
    color: '#424242',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  journeyMessage: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: '600',
    textAlign: 'center',
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
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  buttonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
});
