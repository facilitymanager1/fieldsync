/**
 * Onboarding Workflow Interface - Step-by-step employee onboarding
 * 
 * Features:
 * - Guided workflow with progress tracking
 * - Form validation and error handling
 * - Document upload capabilities
 * - Biometric enrollment integration
 * - Real-time status updates
 * - Mobile-responsive design
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Card,
  CardContent,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  LinearProgress,
  Paper,
  Divider,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Home as HomeIcon,
  ContactPhone as ContactPhoneIcon,
  People as PeopleIcon,
  Work as WorkIcon,
  Upload as UploadIcon,
  Fingerprint as FingerprintIcon,
  Verified as VerifiedIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

// Onboarding steps configuration
const ONBOARDING_STEPS = [
  {
    key: 'personal_info_collection',
    label: 'Personal Information',
    icon: <PersonAddIcon />,
    description: 'Basic personal details and identification'
  },
  {
    key: 'address_details',
    label: 'Address Details',
    icon: <HomeIcon />,
    description: 'Permanent and current address information'
  },
  {
    key: 'emergency_contact',
    label: 'Emergency Contact',
    icon: <ContactPhoneIcon />,
    description: 'Emergency contact person details'
  },
  {
    key: 'nominee_details',
    label: 'Nominee Information',
    icon: <PeopleIcon />,
    description: 'Nominee details for benefits'
  },
  {
    key: 'employment_details',
    label: 'Employment Details',
    icon: <WorkIcon />,
    description: 'Job role and compensation information'
  },
  {
    key: 'document_upload',
    label: 'Document Upload',
    icon: <UploadIcon />,
    description: 'Upload required documents'
  },
  {
    key: 'biometric_enrollment',
    label: 'Biometric Enrollment',
    icon: <FingerprintIcon />,
    description: 'Face recognition and biometric setup'
  },
  {
    key: 'statutory_verification',
    label: 'Statutory Verification',
    icon: <VerifiedIcon />,
    description: 'EPFO and ESIC verification'
  },
  {
    key: 'consent_capture',
    label: 'Consent & Agreements',
    icon: <AssignmentIcon />,
    description: 'Legal consents and agreements'
  },
  {
    key: 'attendance_setup',
    label: 'Attendance Setup',
    icon: <ScheduleIcon />,
    description: 'Setup attendance system access'
  }
];

interface OnboardingWorkflowProps {
  onboardingId?: string;
  mode?: 'new' | 'continue' | 'view';
}

export default function OnboardingWorkflow({ onboardingId, mode = 'new' }: OnboardingWorkflowProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<any>({});
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  
  // Form states for each step
  const [personalInfo, setPersonalInfo] = useState({
    aadhaarNumber: '',
    aadhaarName: '',
    panNumber: '',
    panName: '',
    dateOfBirth: '',
    gender: '',
    mobileNumber: '',
    emailAddress: '',
    fatherName: '',
    motherName: '',
    maritalStatus: 'single',
    spouseName: '',
    bloodGroup: '',
    nationality: 'Indian',
    religion: '',
    caste: '',
    category: 'general'
  });

  const [addressInfo, setAddressInfo] = useState({
    permanent: {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    },
    current: {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      sameAsPermanent: false
    }
  });

  const [emergencyContact, setEmergencyContact] = useState({
    name: '',
    relationship: '',
    mobileNumber: '',
    alternateNumber: '',
    address: ''
  });

  const [nomineeInfo, setNomineeInfo] = useState([{
    name: '',
    relationship: '',
    dateOfBirth: '',
    share: 100,
    address: '',
    mobileNumber: ''
  }]);

  const [employmentDetails, setEmploymentDetails] = useState({
    designationId: '',
    departmentId: '',
    locationId: '',
    reportingManagerId: '',
    dateOfJoining: '',
    employmentType: 'permanent',
    probationPeriod: 6,
    basicSalary: 0,
    grossSalary: 0,
    ctc: 0
  });

  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [biometricEnrollment, setBiometricEnrollment] = useState({
    faceEnrolled: false,
    fingerprintEnrolled: false,
    enrollmentAttempts: 0
  });

  useEffect(() => {
    if (onboardingId && mode !== 'new') {
      loadOnboardingData();
    }
  }, [onboardingId, mode]);

  const loadOnboardingData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/onboarding/${onboardingId}/status`);
      const result = await response.json();

      if (result.success) {
        setOnboardingData(result.data);
        
        // Populate form data
        if (result.data.personalInfo) {
          setPersonalInfo(result.data.personalInfo);
        }
        if (result.data.addressInfo) {
          setAddressInfo(result.data.addressInfo);
        }
        if (result.data.emergencyContact) {
          setEmergencyContact(result.data.emergencyContact);
        }
        if (result.data.nomineeInfo) {
          setNomineeInfo(result.data.nomineeInfo);
        }
        if (result.data.employmentDetails) {
          setEmploymentDetails(result.data.employmentDetails);
        }

        // Set active step based on current progress
        const currentStepIndex = ONBOARDING_STEPS.findIndex(step => 
          step.key === result.data.progress.currentStep
        );
        if (currentStepIndex !== -1) {
          setActiveStep(currentStepIndex);
        }

        // Mark completed steps
        const completed = new Set<number>();
        result.data.workflowSteps.forEach((step: any, index: number) => {
          if (step.stepStatus === 'verified') {
            completed.add(index);
          }
        });
        setCompletedSteps(completed);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to load onboarding data');
      console.error('Error loading onboarding data:', err);
    } finally {
      setLoading(false);
    }
  };

  const initiateOnboarding = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/onboarding/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalInfo,
          employmentDetails
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Onboarding process initiated successfully!');
        setOnboardingData(result.data);
        setActiveStep(1); // Move to next step
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to initiate onboarding process');
      console.error('Error initiating onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStep = async (stepKey: string, stepData: any) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/onboarding/${onboardingData.onboardingId}/step/${stepKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stepData)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Step updated successfully!');
        
        // Mark current step as completed
        const newCompleted = new Set(completedSteps);
        newCompleted.add(activeStep);
        setCompletedSteps(newCompleted);

        // Move to next step if available
        if (result.data.nextStep) {
          const nextStepIndex = ONBOARDING_STEPS.findIndex(step => 
            step.key === result.data.nextStep
          );
          if (nextStepIndex !== -1 && nextStepIndex > activeStep) {
            setActiveStep(nextStepIndex);
          }
        }

        // Clear any validation errors
        setValidationErrors({});
      } else {
        setError(result.message);
        if (result.errors) {
          const errorMap: { [key: string]: string } = {};
          result.errors.forEach((error: string, index: number) => {
            errorMap[`error_${index}`] = error;
          });
          setValidationErrors(errorMap);
        }
      }
    } catch (err) {
      setError('Failed to update step');
      console.error('Error updating step:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const currentStep = ONBOARDING_STEPS[activeStep];
    
    switch (currentStep.key) {
      case 'personal_info_collection':
        if (!onboardingData.onboardingId) {
          initiateOnboarding();
        } else {
          updateStep(currentStep.key, personalInfo);
        }
        break;
      case 'address_details':
        updateStep(currentStep.key, addressInfo);
        break;
      case 'emergency_contact':
        updateStep(currentStep.key, emergencyContact);
        break;
      case 'nominee_details':
        updateStep(currentStep.key, { nominees: nomineeInfo });
        break;
      case 'employment_details':
        updateStep(currentStep.key, employmentDetails);
        break;
      default:
        // For other steps, just move to next
        if (activeStep < ONBOARDING_STEPS.length - 1) {
          setActiveStep(activeStep + 1);
        }
        break;
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const getStepIcon = (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) {
      return <CheckCircleIcon color="success" />;
    }
    if (stepIndex === activeStep) {
      return ONBOARDING_STEPS[stepIndex].icon;
    }
    return ONBOARDING_STEPS[stepIndex].icon;
  };

  const renderStepContent = (stepIndex: number) => {
    const step = ONBOARDING_STEPS[stepIndex];

    switch (step.key) {
      case 'personal_info_collection':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Personal Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
                <TextField
                  fullWidth
                  label="Aadhaar Number"
                  value={personalInfo.aadhaarNumber}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, aadhaarNumber: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Name as per Aadhaar"
                  value={personalInfo.aadhaarName}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, aadhaarName: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="PAN Number"
                  value={personalInfo.panNumber}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, panNumber: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  value={personalInfo.dateOfBirth}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
                <FormControl fullWidth required>
                  <InputLabel>Gender</InputLabel>
                  <Select
                    value={personalInfo.gender}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, gender: e.target.value }))}
                    label="Gender"
                  >
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Mobile Number"
                  value={personalInfo.mobileNumber}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, mobileNumber: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={personalInfo.emailAddress}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, emailAddress: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Father's Name"
                  value={personalInfo.fatherName}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, fatherName: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Mother's Name"
                  value={personalInfo.motherName}
                  onChange={(e) => setPersonalInfo(prev => ({ ...prev, motherName: e.target.value }))}
                  required
                />
              </Box>
            </CardContent>
          </Card>
        );

      case 'address_details':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Address Information
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                Permanent Address
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
                <TextField
                  fullWidth
                  label="Address Line 1"
                  value={addressInfo.permanent.addressLine1}
                  onChange={(e) => setAddressInfo(prev => ({ 
                    ...prev, 
                    permanent: { ...prev.permanent, addressLine1: e.target.value }
                  }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Address Line 2"
                  value={addressInfo.permanent.addressLine2}
                  onChange={(e) => setAddressInfo(prev => ({ 
                    ...prev, 
                    permanent: { ...prev.permanent, addressLine2: e.target.value }
                  }))}
                />
                <TextField
                  fullWidth
                  label="City"
                  value={addressInfo.permanent.city}
                  onChange={(e) => setAddressInfo(prev => ({ 
                    ...prev, 
                    permanent: { ...prev.permanent, city: e.target.value }
                  }))}
                  required
                />
                <TextField
                  fullWidth
                  label="State"
                  value={addressInfo.permanent.state}
                  onChange={(e) => setAddressInfo(prev => ({ 
                    ...prev, 
                    permanent: { ...prev.permanent, state: e.target.value }
                  }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Pincode"
                  value={addressInfo.permanent.pincode}
                  onChange={(e) => setAddressInfo(prev => ({ 
                    ...prev, 
                    permanent: { ...prev.permanent, pincode: e.target.value }
                  }))}
                  required
                />
              </Box>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={addressInfo.current.sameAsPermanent}
                    onChange={(e) => {
                      const sameAsPermanent = e.target.checked;
                      setAddressInfo(prev => ({
                        ...prev,
                        current: {
                          ...prev.current,
                          sameAsPermanent,
                          ...(sameAsPermanent ? prev.permanent : {})
                        }
                      }));
                    }}
                  />
                }
                label="Current address same as permanent address"
              />

              {!addressInfo.current.sameAsPermanent && (
                <>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    Current Address
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Address Line 1"
                      value={addressInfo.current.addressLine1}
                      onChange={(e) => setAddressInfo(prev => ({ 
                        ...prev, 
                        current: { ...prev.current, addressLine1: e.target.value }
                      }))}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Address Line 2"
                      value={addressInfo.current.addressLine2}
                      onChange={(e) => setAddressInfo(prev => ({ 
                        ...prev, 
                        current: { ...prev.current, addressLine2: e.target.value }
                      }))}
                    />
                    <TextField
                      fullWidth
                      label="City"
                      value={addressInfo.current.city}
                      onChange={(e) => setAddressInfo(prev => ({ 
                        ...prev, 
                        current: { ...prev.current, city: e.target.value }
                      }))}
                      required
                    />
                    <TextField
                      fullWidth
                      label="State"
                      value={addressInfo.current.state}
                      onChange={(e) => setAddressInfo(prev => ({ 
                        ...prev, 
                        current: { ...prev.current, state: e.target.value }
                      }))}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Pincode"
                      value={addressInfo.current.pincode}
                      onChange={(e) => setAddressInfo(prev => ({ 
                        ...prev, 
                        current: { ...prev.current, pincode: e.target.value }
                      }))}
                      required
                    />
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        );

      case 'emergency_contact':
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Emergency Contact
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
                <TextField
                  fullWidth
                  label="Name"
                  value={emergencyContact.name}
                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Relationship"
                  value={emergencyContact.relationship}
                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, relationship: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Mobile Number"
                  value={emergencyContact.mobileNumber}
                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, mobileNumber: e.target.value }))}
                  required
                />
                <TextField
                  fullWidth
                  label="Alternate Number"
                  value={emergencyContact.alternateNumber}
                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, alternateNumber: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={3}
                  value={emergencyContact.address}
                  onChange={(e) => setEmergencyContact(prev => ({ ...prev, address: e.target.value }))}
                  required
                  sx={{ gridColumn: '1 / -1' }}
                />
              </Box>
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {step.label}
              </Typography>
              <Typography color="text.secondary" paragraph>
                {step.description}
              </Typography>
              <Alert severity="info">
                This section is under development. The step will be automatically marked as completed.
              </Alert>
            </CardContent>
          </Card>
        );
    }
  };

  if (loading && !onboardingData.onboardingId) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Employee Onboarding
        </Typography>
        
        {onboardingData.onboardingId && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" color="text.secondary">
              Onboarding ID: {onboardingData.onboardingId}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(completedSteps.size / ONBOARDING_STEPS.length) * 100}
              sx={{ mt: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              {completedSteps.size} of {ONBOARDING_STEPS.length} steps completed
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {Object.keys(validationErrors).length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Please fix the following issues:
            </Typography>
            {Object.values(validationErrors).map((error, index) => (
              <Typography key={index} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {ONBOARDING_STEPS.map((step, index) => (
            <Step key={step.key}>
              <StepLabel
                icon={getStepIcon(index)}
                optional={
                  completedSteps.has(index) ? (
                    <Chip label="Completed" size="small" color="success" />
                  ) : undefined
                }
              >
                <Typography variant="h6">{step.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ mt: 2, mb: 2 }}>
                  {renderStepContent(index)}
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    sx={{ mt: 1, mr: 1 }}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : undefined}
                  >
                    {index === ONBOARDING_STEPS.length - 1 ? 'Complete' : 'Continue'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {activeStep === ONBOARDING_STEPS.length && (
          <Paper square elevation={0} sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Onboarding Complete!
            </Typography>
            <Typography paragraph>
              Congratulations! Your onboarding process has been completed successfully.
              You can now access all system features and your attendance has been enabled.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CheckCircleIcon />}
            >
              Go to Dashboard
            </Button>
          </Paper>
        )}
      </Paper>
    </Container>
  );
}
