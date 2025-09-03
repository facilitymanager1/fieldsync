import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ValidatedInput from '../../../components/ValidatedInput';
import ValidationSummary from '../../../components/ValidationSummary';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { basicDetailsSchema, salaryDetailsSchema } from '../../../schemas/onboardingValidationSchemas';
import {
  ValidationType,
  ValidationSeverity,
  ValidationEvent,
  FormValidationResults,
} from '../../../types/validation';

const AdvancedValidationDemoScreen: React.FC = () => {
  const [selectedSchema, setSelectedSchema] = useState<'basic' | 'salary'>('basic');
  const [showValidationSummary, setShowValidationSummary] = useState(true);
  const [showDetailsInSummary, setShowDetailsInSummary] = useState(false);
  const [validationEvents, setValidationEvents] = useState<string[]>([]);

  // Get the appropriate schema
  const currentSchema = selectedSchema === 'basic' ? basicDetailsSchema : salaryDetailsSchema;

  // Initialize form validation
  const {
    formData,
    formState,
    setValue,
    setValues,
    getValue,
    validateField,
    validateForm,
    submitForm,
    resetForm,
    getFieldErrors,
    getFieldWarnings,
    hasFieldError,
    isDirty,
    isTouched,
    isValidating,
    getCompletionPercentage,
    canSubmit,
  } = useFormValidation({
    schema: currentSchema,
    initialData: selectedSchema === 'basic' ? {
      firstName: '',
      lastName: '',
      gender: '',
      maritalStatus: 'Single',
      dateOfBirth: '',
      dateOfJoining: '',
      phoneNumber: '',
      email: '',
      aadhaarNumber: '',
      panNumber: '',
      speciallyAbled: 'No',
    } : {
      designation: '',
      department: '',
      basicSalary: '',
      hra: '',
      conveyanceAllowance: '',
      medicalAllowance: '',
      otherAllowances: '',
      pfDeduction: '',
      esiDeduction: '',
      tds: '',
    },
    config: {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 500,
      showErrorsImmediately: false,
    },
    onValidationEvent: (payload) => {
      const eventText = `${payload.event}: ${payload.fieldName || 'form'} at ${payload.timestamp.toLocaleTimeString()}`;
      setValidationEvents(prev => [eventText, ...prev.slice(0, 9)]); // Keep last 10 events
    }
  });

  const [lastValidationResults, setLastValidationResults] = useState<FormValidationResults | null>(null);

  const handleSchemaChange = (schema: 'basic' | 'salary') => {
    setSelectedSchema(schema);
    resetForm();
    setLastValidationResults(null);
    setValidationEvents([]);
  };

  const handleValidateForm = async () => {
    try {
      const results = await validateForm();
      setLastValidationResults(results);
      
      if (results.isValid) {
        Alert.alert('Success', 'All validations passed!');
      } else {
        Alert.alert(
          'Validation Failed',
          `Found ${results.summary.totalErrors} error(s) and ${results.summary.totalWarnings} warning(s)`
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Validation failed with an error');
    }
  };

  const handleSubmitForm = async () => {
    try {
      const results = await submitForm();
      if (results.isValid) {
        Alert.alert('Success', 'Form submitted successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Submission failed');
    }
  };

  const renderBasicDetailsForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Basic Details Form</Text>
      
      <ValidatedInput
        label="First Name"
        value={getValue('firstName')}
        onChangeText={(text) => setValue('firstName', text)}
        validationRules={[
          { type: ValidationType.REQUIRED, message: 'First name is required' },
          { type: ValidationType.MIN_LENGTH, message: 'Minimum 2 characters', params: { min: 2 } }
        ]}
        showValidationIcon={true}
        accessibilityLabel="firstName"
      />

      <ValidatedInput
        label="Last Name"
        value={getValue('lastName')}
        onChangeText={(text) => setValue('lastName', text)}
        validationRules={[
          { type: ValidationType.REQUIRED, message: 'Last name is required' }
        ]}
        showValidationIcon={true}
        accessibilityLabel="lastName"
      />

      <ValidatedInput
        label="Email Address"
        value={getValue('email')}
        onChangeText={(text) => setValue('email', text)}
        keyboardType="email-address"
        autoCapitalize="none"
        validationRules={[
          { type: ValidationType.REQUIRED, message: 'Email is required' },
          { type: ValidationType.EMAIL, message: 'Please enter a valid email' }
        ]}
        showValidationIcon={true}
        isValidating={isValidating('email')}
        accessibilityLabel="email"
        helpText="We'll use this for account verification and communication"
      />

      <ValidatedInput
        label="Phone Number"
        value={getValue('phoneNumber')}
        onChangeText={(text) => setValue('phoneNumber', text)}
        keyboardType="phone-pad"
        maxLength={10}
        validationRules={[
          { type: ValidationType.REQUIRED, message: 'Phone number is required' },
          { type: ValidationType.PHONE, message: 'Enter a valid 10-digit mobile number' }
        ]}
        showValidationIcon={true}
        showCharacterCount={true}
        accessibilityLabel="phoneNumber"
      />

      <ValidatedInput
        label="Aadhaar Number"
        value={getValue('aadhaarNumber')}
        onChangeText={(text) => setValue('aadhaarNumber', text)}
        keyboardType="numeric"
        maxLength={12}
        validationRules={[
          { type: ValidationType.REQUIRED, message: 'Aadhaar number is required' },
          { type: ValidationType.AADHAAR, message: 'Enter a valid 12-digit Aadhaar number' }
        ]}
        showValidationIcon={true}
        showCharacterCount={true}
        accessibilityLabel="aadhaarNumber"
        helpText="Your Aadhaar information will be verified securely"
      />

      <ValidatedInput
        label="PAN Number"
        value={getValue('panNumber')}
        onChangeText={(text) => setValue('panNumber', text.toUpperCase())}
        autoCapitalize="characters"
        maxLength={10}
        validationRules={[
          { type: ValidationType.REQUIRED, message: 'PAN number is required' },
          { type: ValidationType.PAN, message: 'Enter a valid PAN number (e.g., ABCDE1234F)' }
        ]}
        showValidationIcon={true}
        showCharacterCount={true}
        accessibilityLabel="panNumber"
      />

      {getValue('maritalStatus') === 'Single' && (
        <ValidatedInput
          label="Father's Name"
          value={getValue('fatherName')}
          onChangeText={(text) => setValue('fatherName', text)}
          validationRules={[
            { type: ValidationType.REQUIRED, message: 'Father\'s name is required' }
          ]}
          showValidationIcon={true}
          accessibilityLabel="fatherName"
        />
      )}

      {getValue('maritalStatus') === 'Married' && (
        <ValidatedInput
          label="Spouse Name"
          value={getValue('spouseName')}
          onChangeText={(text) => setValue('spouseName', text)}
          validationRules={[
            { type: ValidationType.REQUIRED, message: 'Spouse name is required' }
          ]}
          showValidationIcon={true}
          accessibilityLabel="spouseName"
        />
      )}

      {getValue('speciallyAbled') === 'Yes' && (
        <ValidatedInput
          label="Special Needs Remarks"
          value={getValue('speciallyAbledRemarks')}
          onChangeText={(text) => setValue('speciallyAbledRemarks', text)}
          multiline={true}
          numberOfLines={3}
          maxLength={500}
          validationRules={[
            { type: ValidationType.REQUIRED, message: 'Please provide remarks' },
            { type: ValidationType.MIN_LENGTH, message: 'Please provide detailed remarks (min 10 chars)', params: { min: 10 } }
          ]}
          showValidationIcon={true}
          showCharacterCount={true}
          accessibilityLabel="speciallyAbledRemarks"
        />
      )}
    </View>
  );

  const renderSalaryDetailsForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Salary Details Form</Text>
      
      <ValidatedInput
        label="Basic Salary (₹)"
        value={getValue('basicSalary')}
        onChangeText={(text) => setValue('basicSalary', text)}
        keyboardType="numeric"
        validationRules={[
          { type: ValidationType.REQUIRED, message: 'Basic salary is required' },
          { type: ValidationType.NUMERIC, message: 'Enter a valid amount' },
          { type: ValidationType.RANGE, message: 'Salary must be between ₹10,000 and ₹5,00,000', params: { min: 10000, max: 500000 } }
        ]}
        showValidationIcon={true}
        accessibilityLabel="basicSalary"
        helpText="Enter the basic salary component"
      />

      <ValidatedInput
        label="HRA (₹)"
        value={getValue('hra')}
        onChangeText={(text) => setValue('hra', text)}
        keyboardType="numeric"
        validationRules={[
          { type: ValidationType.NUMERIC, message: 'Enter a valid amount' }
        ]}
        showValidationIcon={true}
        accessibilityLabel="hra"
        helpText="House Rent Allowance (usually 40-50% of basic salary)"
      />

      <ValidatedInput
        label="Conveyance Allowance (₹)"
        value={getValue('conveyanceAllowance')}
        onChangeText={(text) => setValue('conveyanceAllowance', text)}
        keyboardType="numeric"
        validationRules={[
          { type: ValidationType.NUMERIC, message: 'Enter a valid amount' },
          { type: ValidationType.RANGE, message: 'Cannot exceed ₹25,000', params: { min: 0, max: 25000 } }
        ]}
        showValidationIcon={true}
        accessibilityLabel="conveyanceAllowance"
      />

      <ValidatedInput
        label="PF Deduction (₹)"
        value={getValue('pfDeduction')}
        onChangeText={(text) => setValue('pfDeduction', text)}
        keyboardType="numeric"
        validationRules={[
          { type: ValidationType.NUMERIC, message: 'Enter a valid amount' }
        ]}
        showValidationIcon={true}
        accessibilityLabel="pfDeduction"
        helpText="Provident Fund (typically 12% of basic salary)"
      />

      {/* Show ESI field only for lower salaries */}
      {(() => {
        const grossSalary = (Number(getValue('basicSalary')) || 0) + 
                           (Number(getValue('hra')) || 0) + 
                           (Number(getValue('conveyanceAllowance')) || 0);
        return grossSalary < 21000 && grossSalary > 0;
      })() && (
        <ValidatedInput
          label="ESI Deduction (₹)"
          value={getValue('esiDeduction')}
          onChangeText={(text) => setValue('esiDeduction', text)}
          keyboardType="numeric"
          validationRules={[
            { type: ValidationType.REQUIRED, message: 'ESI deduction is mandatory for salary < ₹21,000' },
            { type: ValidationType.NUMERIC, message: 'Enter a valid amount' }
          ]}
          showValidationIcon={true}
          accessibilityLabel="esiDeduction"
          helpText="Employee State Insurance (1.75% of gross salary)"
        />
      )}
    </View>
  );

  const renderFormControls = () => (
    <View style={styles.controlsSection}>
      <Text style={styles.sectionTitle}>Form Controls</Text>
      
      <View style={styles.schemaToggle}>
        <TouchableOpacity
          style={[
            styles.schemaButton,
            selectedSchema === 'basic' && styles.schemaButtonActive
          ]}
          onPress={() => handleSchemaChange('basic')}
        >
          <Text style={[
            styles.schemaButtonText,
            selectedSchema === 'basic' && styles.schemaButtonTextActive
          ]}>
            Basic Details
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.schemaButton,
            selectedSchema === 'salary' && styles.schemaButtonActive
          ]}
          onPress={() => handleSchemaChange('salary')}
        >
          <Text style={[
            styles.schemaButtonText,
            selectedSchema === 'salary' && styles.schemaButtonTextActive
          ]}>
            Salary Details
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleValidateForm}
        >
          <Icon name="check-circle" size={20} color="white" />
          <Text style={styles.actionButtonText}>Validate Form</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.submitButton,
            !canSubmit() && styles.actionButtonDisabled
          ]}
          onPress={handleSubmitForm}
          disabled={!canSubmit()}
        >
          <Icon name="send" size={20} color="white" />
          <Text style={styles.actionButtonText}>Submit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.resetButton]}
          onPress={() => {
            resetForm();
            setLastValidationResults(null);
            setValidationEvents([]);
          }}
        >
          <Icon name="refresh" size={20} color="white" />
          <Text style={styles.actionButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormStats = () => (
    <View style={styles.statsSection}>
      <Text style={styles.sectionTitle}>Form Statistics</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(getCompletionPercentage())}%</Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Object.keys(formState.errors).length}</Text>
          <Text style={styles.statLabel}>Fields with Errors</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Object.keys(formState.touched).filter(key => formState.touched[key]).length}</Text>
          <Text style={styles.statLabel}>Touched Fields</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Object.keys(formState.dirty).filter(key => formState.dirty[key]).length}</Text>
          <Text style={styles.statLabel}>Modified Fields</Text>
        </View>
      </View>

      <View style={styles.toggles}>
        <View style={styles.toggleItem}>
          <Text style={styles.toggleLabel}>Show Validation Summary</Text>
          <Switch
            value={showValidationSummary}
            onValueChange={setShowValidationSummary}
          />
        </View>
        <View style={styles.toggleItem}>
          <Text style={styles.toggleLabel}>Show Summary Details</Text>
          <Switch
            value={showDetailsInSummary}
            onValueChange={setShowDetailsInSummary}
          />
        </View>
      </View>
    </View>
  );

  const renderValidationEvents = () => (
    <View style={styles.eventsSection}>
      <Text style={styles.sectionTitle}>Validation Events Log</Text>
      <ScrollView style={styles.eventsList} nestedScrollEnabled>
        {validationEvents.length === 0 ? (
          <Text style={styles.noEvents}>No validation events yet</Text>
        ) : (
          validationEvents.map((event, index) => (
            <Text key={index} style={styles.eventItem}>
              {event}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Icon name="rule" size={32} color="#007bff" />
        <Text style={styles.headerTitle}>Advanced Form Validation</Text>
        <Text style={styles.headerSubtitle}>
          Comprehensive validation with custom rules, cross-field validation, and business logic
        </Text>
      </View>

      {renderFormControls()}
      {renderFormStats()}

      {selectedSchema === 'basic' ? renderBasicDetailsForm() : renderSalaryDetailsForm()}

      {showValidationSummary && lastValidationResults && (
        <ValidationSummary
          validationResults={lastValidationResults}
          showDetails={showDetailsInSummary}
          onToggleDetails={() => setShowDetailsInSummary(!showDetailsInSummary)}
          style={styles.validationSummary}
        />
      )}

      {renderValidationEvents()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  controlsSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  schemaToggle: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  schemaButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  schemaButtonActive: {
    backgroundColor: '#007bff',
  },
  schemaButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  schemaButtonTextActive: {
    color: 'white',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#007bff',
    borderRadius: 8,
    gap: 8,
  },
  submitButton: {
    backgroundColor: '#28a745',
  },
  resetButton: {
    backgroundColor: '#6c757d',
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  statsSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  toggles: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 16,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333',
  },
  formSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
  },
  validationSummary: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  eventsSection: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
  },
  eventsList: {
    maxHeight: 150,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  noEvents: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  eventItem: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});

export default AdvancedValidationDemoScreen;