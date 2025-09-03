/**
 * Common TypeScript types used throughout the mobile application
 */

// Text input handler type
export type TextInputHandler = (text: string) => void;

// Generic form data handler
export type FormDataHandler<T = any> = (field: string, value: any) => void;

// Navigation types
export type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  replace: (screen: string, params?: any) => void;
};

// Route types
export type RouteProp<T = any> = {
  params?: T;
  name: string;
  key: string;
};

// Common component props
export interface BaseComponentProps {
  testID?: string;
  style?: any;
}

// Form field types
export interface FormField {
  value: string;
  error?: string;
  touched?: boolean;
}

// Address types
export interface Address {
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
}

// Contact types
export interface Contact {
  name: string;
  phoneNumber: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  relationship?: string;
}

// Education types
export interface Education {
  institutionName: string;
  yearOfCompletion: string;
  gradeValue: string;
  gradeType: 'percentage' | 'cgpa' | 'grade';
}

// Picker option type
export interface PickerOption {
  label: string;
  value: string;
}
