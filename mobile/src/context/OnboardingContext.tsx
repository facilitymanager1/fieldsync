/**
 * Onboarding Context - Global state management for onboarding flow
 * 
 * Features:
 * - Centralized data management
 * - Step navigation controls
 * - Offline sync capabilities
 * - Multi-language support
 * - Progress tracking
 */

import React, { createContext, useContext, ReactNode } from 'react';

export interface OnboardingStep {
  key: string;
  title: string;
  component: string;
  required: boolean;
  order: number;
  conditional?: (data: any) => boolean;
}

export interface OnboardingProgress {
  current: number;
  total: number;
  percentage: number;
}

export interface OnboardingContextType {
  currentStep: number;
  onboardingData: any;
  setOnboardingData: (data: any) => void;
  goToNextStep: (data?: any) => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  isOffline: boolean;
  language: 'english' | 'hindi' | 'kannada';
  setLanguage: (language: 'english' | 'hindi' | 'kannada') => void;
  steps: OnboardingStep[];
  progress: OnboardingProgress;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: ReactNode;
  value: OnboardingContextType;
}

export function OnboardingProvider({ children, value }: OnboardingProviderProps) {
  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextType {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

// Helper functions for data validation and formatting

export const validateAadhaarNumber = (aadhaar: string): boolean => {
  const aadhaarRegex = /^[0-9]{12}$/;
  return aadhaarRegex.test(aadhaar.replace(/\s/g, ''));
};

export const validatePanNumber = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
};

export const validateMobileNumber = (mobile: string): boolean => {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateIFSC = (ifsc: string): boolean => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
};

export const validateAccountNumber = (accountNumber: string): boolean => {
  const accountRegex = /^[0-9]{9,18}$/;
  return accountRegex.test(accountNumber);
};

export const formatAadhaarNumber = (aadhaar: string): string => {
  const cleaned = aadhaar.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{4})(\d{4})(\d{4})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  return cleaned;
};

export const formatPanNumber = (pan: string): string => {
  return pan.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export const isESICApplicable = (netSalary: number): boolean => {
  return netSalary <= 25000;
};

export const isPFApplicable = (basicSalary: number): boolean => {
  return basicSalary >= 15000;
};

export const isGMCApplicable = (grossSalary: number, adminConfig: any): boolean => {
  return grossSalary >= (adminConfig?.gmcMinSalary || 20000) && adminConfig?.gmcEnabled === true;
};

// Multi-language text helpers
export const getLocalizedText = (
  key: string,
  language: 'english' | 'hindi' | 'kannada'
): string => {
  const texts: { [key: string]: { [lang: string]: string } } = {
    // Common texts
    next: {
      english: 'Next',
      hindi: 'अगला',
      kannada: 'ಮುಂದೆ'
    },
    back: {
      english: 'Back',
      hindi: 'पीछे',
      kannada: 'ಹಿಂದೆ'
    },
    save: {
      english: 'Save',
      hindi: 'सेव करें',
      kannada: 'ಉಳಿಸಿ'
    },
    required: {
      english: 'Required',
      hindi: 'आवश्यक',
      kannada: 'ಅಗತ್ಯವಿದೆ'
    },
    optional: {
      english: 'Optional',
      hindi: 'वैकल्पिक',
      kannada: 'ಐಚ್ಛಿಕ'
    },
    
    // Form fields
    name: {
      english: 'Full Name',
      hindi: 'पूरा नाम',
      kannada: 'ಪೂರ್ಣ ಹೆಸರು'
    },
    mobile: {
      english: 'Mobile Number',
      hindi: 'मोबाइल नंबर',
      kannada: 'ಮೊಬೈಲ್ ನಂಬರ್'
    },
    aadhaar: {
      english: 'Aadhaar Number',
      hindi: 'आधार नंबर',
      kannada: 'ಆಧಾರ್ ಸಂಖ್ಯೆ'
    },
    pan: {
      english: 'PAN Number',
      hindi: 'पैन नंबर',
      kannada: 'ಪ್ಯಾನ್ ಸಂಖ್ಯೆ'
    },
    
    // Validation messages
    invalid_aadhaar: {
      english: 'Please enter a valid 12-digit Aadhaar number',
      hindi: 'कृपया एक वैध 12 अंकों का आधार नंबर दर्ज करें',
      kannada: 'ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ 12 ಅಂಕಿಯ ಆಧಾರ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ'
    },
    invalid_mobile: {
      english: 'Please enter a valid 10-digit mobile number',
      hindi: 'कृपया एक वैध 10 अंकों का मोबाइल नंबर दर्ज करें',
      kannada: 'ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ'
    },
    
    // Step titles
    step_login: {
      english: 'Login & Site Selection',
      hindi: 'लॉगिन और साइट चयन',
      kannada: 'ಲಾಗಿನ್ ಮತ್ತು ಸೈಟ್ ಆಯ್ಕೆ'
    },
    step_organization: {
      english: 'Organization Details',
      hindi: 'संगठन विवरण',
      kannada: 'ಸಂಸ್ಥೆಯ ವಿವರಗಳು'
    },
    step_employee: {
      english: 'Add Employee Profile',
      hindi: 'कर्मचारी प्रोफ़ाइल जोड़ें',
      kannada: 'ಉದ್ಯೋಗಿ ಪ್ರೊಫೈಲ್ ಸೇರಿಸಿ'
    },
    step_face_capture: {
      english: 'Face Capture & Aadhaar Scan',
      hindi: 'चेहरा कैप्चर और आधार स्कैन',
      kannada: 'ಮುಖ ಸೆರೆಹಿಡಿಯುವುದು ಮತ್ತು ಆಧಾರ್ ಸ್ಕ್ಯಾನ್'
    },
    step_personal: {
      english: 'Personal Details',
      hindi: 'व्यक्तिगत विवरण',
      kannada: 'ವೈಯಕ್ತಿಕ ವಿವರಗಳು'
    },
    step_education: {
      english: 'Education',
      hindi: 'शिक्षा',
      kannada: 'ಶಿಕ್ಷಣ'
    },
    step_address: {
      english: 'Address Details',
      hindi: 'पता विवरण',
      kannada: 'ವಿಳಾಸ ವಿವರಗಳು'
    },
    step_bank: {
      english: 'Bank Details',
      hindi: 'बैंक विवरण',
      kannada: 'ಬ್ಯಾಂಕ್ ವಿವರಗಳು'
    },
    step_family: {
      english: 'Family/Nominee Details',
      hindi: 'परिवार/नामांकित व्यक्ति विवरण',
      kannada: 'ಕುಟುಂಬ/ನಾಮಿನಿ ವಿವರಗಳು'
    },
    step_esic: {
      english: 'ESIC & Dispensary Details',
      hindi: 'ईएसआईसी और औषधालय विवरण',
      kannada: 'ESIC ಮತ್ತು ಔಷಧಾಲಯ ವಿವರಗಳು'
    },
    step_epfo: {
      english: 'EPFO/UAN Details',
      hindi: 'ईपीएफओ/यूएएन विवरण',
      kannada: 'EPFO/UAN ವಿವರಗಳು'
    },
    step_gmc: {
      english: 'GMC Module',
      hindi: 'जीएमसी मॉड्यूल',
      kannada: 'GMC ಮಾಡ್ಯೂಲ್'
    },
    step_insurance: {
      english: 'Insurance Uploads',
      hindi: 'बीमा अपलोड',
      kannada: 'ಇನ್ಶುರೆನ್ಸ್ ಅಪ್‌ಲೋಡ್‌ಗಳು'
    },
    step_verification: {
      english: 'Verification',
      hindi: 'सत्यापन',
      kannada: 'ಪರಿಶೀಲನೆ'
    },
    step_terms: {
      english: 'Terms & Signature',
      hindi: 'नियम और हस्ताक्षर',
      kannada: 'ನಿಯಮಗಳು ಮತ್ತು ಸಹಿ'
    },
    step_inventory: {
      english: 'Inventory',
      hindi: 'इन्वेंटरी',
      kannada: 'ದಾಸ್ತಾನು'
    },
    step_submission: {
      english: 'Submit / Sync Queue',
      hindi: 'सबमिट / सिंक क्यू',
      kannada: 'ಸಲ್ಲಿಸಿ / ಸಿಂಕ್ ಕ್ಯೂ'
    },
  };

  return texts[key]?.[language] || texts[key]?.english || key;
};
