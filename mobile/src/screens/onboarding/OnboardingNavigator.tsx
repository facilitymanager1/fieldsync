/**
 * Onboarding Navigator - Mobile Card-based Flow with Progressive Disclosure
 * 
 * Features:
 * - 17-step guided onboarding process
 *   const [currentStep, setCurrentStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({});
  const [isOffline, setIsOffline] = useState(false);
  const [language, setLanguage] = useState<'english' | 'hindi' | 'kannada'>('english');rd-based UI with stepper navigation
 * - Offline-first with sync queue
 * - Real-time validation and progress tracking
 * - Multi-language support (English, Hindi, Kannada)
 * - Conditional branching based on user inputs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  BackHandler,
  Alert,
  Platform,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all onboarding screens
import LoginScreen from './screens/LoginScreen';
import PersonalDetailsScreen from './screens/PersonalDetailsScreen';
import FaceCaptureScreen from './screens/FaceCaptureScreen';
import EducationDetailsScreen from './screens/EducationDetailsScreen';
import AddressDetailsScreen from './screens/AddressDetailsScreen';
import BankDetailsScreen from './screens/BankDetailsScreen';
import FamilyDetailsScreen from './screens/FamilyDetailsScreen';
import StatutoryDetailsScreen from './screens/StatutoryDetailsScreen';
import UANESICIntegrationScreen from './screens/UANESICIntegrationScreen';
import TrainingRecordsScreen from './screens/TrainingRecordsScreen';
import InsuranceDeclarationScreen from './screens/InsuranceDeclarationScreen';
import WorkExperienceScreen from './screens/WorkExperienceScreen';
import TransportDetailsScreen from './screens/TransportDetailsScreen';
import UniformInventoryScreen from './screens/UniformInventoryScreen';
import CompletionScreen from './screens/CompletionScreen';
import FinalReviewScreen from './screens/FinalReviewScreen';
import OrganizationDetailsScreen from './screens/OrganizationDetailsScreen';

// Alias existing screens to match navigation names
const AddEmployeeScreen = PersonalDetailsScreen;
const EducationScreen = EducationDetailsScreen;
const AddressScreen = AddressDetailsScreen;
const FamilyNomineeScreen = FamilyDetailsScreen;
const ESICDetailsScreen = StatutoryDetailsScreen;
const EPFODetailsScreen = StatutoryDetailsScreen;
const GMCModuleScreen = InsuranceDeclarationScreen;
const InsuranceScreen = InsuranceDeclarationScreen;
const VerificationScreen = FinalReviewScreen;
const TermsSignatureScreen = CompletionScreen;
const InventoryScreen = UniformInventoryScreen;
const SubmissionScreen = CompletionScreen;
const RejectionScreen = CompletionScreen;

// Components
import ProgressHeader from '../../components/ProgressHeader';
import OfflineIndicator from '../../components/OfflineIndicator';
import { OnboardingProvider } from '../../context/OnboardingContext';

const Stack = createStackNavigator();

export type OnboardingStackParamList = {
  Login: undefined;
  OrganizationDetails: undefined;
  AddEmployee: undefined;
  FaceCapture: { employeeId: string };
  PersonalDetails: { employeeId: string };
  Education: { employeeId: string };
  Address: { employeeId: string };
  BankDetails: { employeeId: string };
  FamilyNominee: { employeeId: string };
  ESICDetails: { employeeId: string };
  EPFODetails: { employeeId: string };
  GMCModule: { employeeId: string };
  Insurance: { employeeId: string };
  Verification: { employeeId: string };
  TermsSignature: { employeeId: string };
  Inventory: { employeeId: string };
  Submission: { employeeId: string };
  Rejection: { employeeId: string; reason: string };
};

interface OnboardingStep {
  key: string;
  title: string;
  component: string;
  required: boolean;
  order: number;
  conditional?: (data: any) => boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'login', title: 'Login & Site Selection', component: 'Login', required: true, order: 1 },
  { key: 'organization', title: 'Organization Details', component: 'OrganizationDetails', required: true, order: 2 },
  { key: 'employee', title: 'Add Employee Profile', component: 'AddEmployee', required: true, order: 3 },
  { key: 'face_capture', title: 'Face Capture & Aadhaar Scan', component: 'FaceCapture', required: true, order: 4 },
  { key: 'personal', title: 'Personal Details', component: 'PersonalDetails', required: true, order: 5 },
  { 
    key: 'education', 
    title: 'Education', 
    component: 'Education', 
    required: true, 
    order: 6,
    conditional: (data) => data.personal?.qualification !== 'illiterate'
  },
  { key: 'address', title: 'Address Details', component: 'Address', required: true, order: 7 },
  { key: 'bank', title: 'Bank Details', component: 'BankDetails', required: true, order: 8 },
  { key: 'family', title: 'Family/Nominee Details', component: 'FamilyNominee', required: true, order: 9 },
  { 
    key: 'esic', 
    title: 'ESIC & Dispensary Details', 
    component: 'ESICDetails', 
    required: false, 
    order: 10,
    conditional: (data) => data.employment?.netSalary <= 25000 // ESIC applicable for salary <= 25k
  },
  { 
    key: 'epfo', 
    title: 'EPFO/UAN Details', 
    component: 'EPFODetails', 
    required: false, 
    order: 11,
    conditional: (data) => data.employment?.basicSalary >= 15000 // PF applicable for basic >= 15k
  },
  { 
    key: 'gmc', 
    title: 'GMC Module', 
    component: 'GMCModule', 
    required: false, 
    order: 12,
    conditional: (data) => data.employment?.gmcApplicable === true
  },
  { key: 'insurance', title: 'Insurance Uploads', component: 'Insurance', required: true, order: 13 },
  { key: 'verification', title: 'Verification', component: 'Verification', required: true, order: 14 },
  { key: 'terms', title: 'Terms & Signature', component: 'TermsSignature', required: true, order: 15 },
  { key: 'inventory', title: 'Inventory', component: 'Inventory', required: false, order: 16 },
  { key: 'submission', title: 'Submit / Sync Queue', component: 'Submission', required: true, order: 17 },
];

export default function OnboardingNavigator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState({});
  const [isOffline, setIsOffline] = useState(false);
  const [language, setLanguage] = useState('english');

  useEffect(() => {
    // Load saved progress on mount
    loadSavedProgress();
    
    // Handle hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    
    return () => backHandler.remove();
  }, []);

  const loadSavedProgress = async () => {
    try {
      const savedData = await AsyncStorage.getItem('onboarding_progress');
      const savedStep = await AsyncStorage.getItem('onboarding_current_step');
      
      if (savedData) {
        setOnboardingData(JSON.parse(savedData));
      }
      
      if (savedStep) {
        setCurrentStep(parseInt(savedStep, 10));
      }
    } catch (error) {
      console.error('Failed to load saved progress:', error);
    }
  };

  const saveProgress = async (stepIndex: number, data: any) => {
    try {
      await AsyncStorage.setItem('onboarding_progress', JSON.stringify(data));
      await AsyncStorage.setItem('onboarding_current_step', stepIndex.toString());
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const handleBackPress = (): boolean => {
    if (currentStep > 0) {
      Alert.alert(
        'Go Back',
        'Are you sure you want to go back? Your current progress will be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go Back', onPress: () => goToPreviousStep() },
        ]
      );
      return true; // Prevent default back action
    }
    return false; // Allow default back action (exit app)
  };

  const goToNextStep = (data?: any) => {
    const updatedData = { ...onboardingData, ...data };
    setOnboardingData(updatedData);
    
    // Find next applicable step
    let nextStepIndex = currentStep + 1;
    while (nextStepIndex < ONBOARDING_STEPS.length) {
      const step = ONBOARDING_STEPS[nextStepIndex];
      if (!step.conditional || step.conditional(updatedData)) {
        break;
      }
      nextStepIndex++;
    }
    
    if (nextStepIndex < ONBOARDING_STEPS.length) {
      setCurrentStep(nextStepIndex);
      saveProgress(nextStepIndex, updatedData);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      let prevStepIndex = currentStep - 1;
      while (prevStepIndex >= 0) {
        const step = ONBOARDING_STEPS[prevStepIndex];
        if (!step.conditional || step.conditional(onboardingData)) {
          break;
        }
        prevStepIndex--;
      }
      
      if (prevStepIndex >= 0) {
        setCurrentStep(prevStepIndex);
        saveProgress(prevStepIndex, onboardingData);
      }
    }
  };

  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    saveProgress(stepIndex, onboardingData);
  };

  const getApplicableSteps = () => {
    return ONBOARDING_STEPS.filter(step => 
      !step.conditional || step.conditional(onboardingData)
    );
  };

  const getCurrentStepProgress = () => {
    const applicableSteps = getApplicableSteps();
    const currentStepInApplicable = applicableSteps.findIndex(
      step => step.order === ONBOARDING_STEPS[currentStep]?.order
    );
    return {
      current: currentStepInApplicable + 1,
      total: applicableSteps.length,
      percentage: ((currentStepInApplicable + 1) / applicableSteps.length) * 100
    };
  };

  return (
    <OnboardingProvider
      value={{
        currentStep,
        onboardingData,
        setOnboardingData,
        goToNextStep,
        goToPreviousStep,
        goToStep,
        isOffline,
        language: language as 'english' | 'hindi' | 'kannada',
        setLanguage,
        steps: ONBOARDING_STEPS,
        progress: getCurrentStepProgress(),
      }}
    >
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <SafeAreaView style={styles.container}>
          <ProgressHeader
            currentStep={getCurrentStepProgress().current}
            totalSteps={getCurrentStepProgress().total}
            percentage={getCurrentStepProgress().percentage}
            title={ONBOARDING_STEPS[currentStep]?.title || 'Onboarding'}
            canGoBack={currentStep > 0}
            onBackPress={goToPreviousStep}
          />
          
          {isOffline && <OfflineIndicator />}
          
          <Stack.Navigator
            initialRouteName={ONBOARDING_STEPS[currentStep]?.component || 'Login'}
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: '#f5f5f5' },
              animationEnabled: true,
              gestureEnabled: false, // Disable swipe gestures to control navigation
            }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="OrganizationDetails" component={OrganizationDetailsScreen} />
            <Stack.Screen name="AddEmployee" component={AddEmployeeScreen} />
            <Stack.Screen name="FaceCapture" component={FaceCaptureScreen} />
            <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
            <Stack.Screen name="Education" component={EducationScreen} />
            <Stack.Screen name="Address" component={AddressScreen} />
            <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
            <Stack.Screen name="FamilyNominee" component={FamilyNomineeScreen} />
            <Stack.Screen name="ESICDetails" component={ESICDetailsScreen} />
            <Stack.Screen name="EPFODetails" component={EPFODetailsScreen} />
            <Stack.Screen name="GMCModule" component={GMCModuleScreen} />
            <Stack.Screen name="Insurance" component={InsuranceScreen} />
            <Stack.Screen name="Verification" component={VerificationScreen} />
            <Stack.Screen name="TermsSignature" component={TermsSignatureScreen} />
            <Stack.Screen name="Inventory" component={InventoryScreen} />
            <Stack.Screen name="Submission" component={SubmissionScreen} />
            <Stack.Screen name="Rejection" component={RejectionScreen} />
          </Stack.Navigator>
        </SafeAreaView>
      </SafeAreaProvider>
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

// Export types for use in other components
export type { OnboardingStep };
export { ONBOARDING_STEPS };
