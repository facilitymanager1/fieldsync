// Advanced Form Validation Types and Interfaces

export enum ValidationType {
  REQUIRED = 'REQUIRED',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  IFSC = 'IFSC',
  DATE = 'DATE',
  DATE_RANGE = 'DATE_RANGE',
  MIN_LENGTH = 'MIN_LENGTH',
  MAX_LENGTH = 'MAX_LENGTH',
  REGEX = 'REGEX',
  CUSTOM = 'CUSTOM',
  CONDITIONAL = 'CONDITIONAL',
  CROSS_FIELD = 'CROSS_FIELD',
  ASYNC = 'ASYNC',
  FILE = 'FILE',
  NUMERIC = 'NUMERIC',
  RANGE = 'RANGE'
}

export enum ValidationSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export interface ValidationRule {
  type: ValidationType;
  message: string;
  severity?: ValidationSeverity;
  params?: any;
  condition?: (formData: any) => boolean;
  asyncValidator?: (value: any, formData: any) => Promise<ValidationResult>;
  crossFieldValidator?: (value: any, formData: any, fieldName: string) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  severity?: ValidationSeverity;
  code?: string;
  metadata?: Record<string, any>;
}

export interface FieldValidation {
  fieldName: string;
  rules: ValidationRule[];
  dependsOn?: string[]; // Fields this validation depends on
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

export interface FormValidationSchema {
  formName: string;
  fields: FieldValidation[];
  crossFieldRules?: CrossFieldRule[];
  businessRules?: BusinessRule[];
  onValidationComplete?: (results: FormValidationResults) => void;
}

export interface CrossFieldRule {
  name: string;
  fields: string[];
  validator: (values: Record<string, any>) => ValidationResult;
  message: string;
  severity?: ValidationSeverity;
}

export interface BusinessRule {
  name: string;
  condition: (formData: any) => boolean;
  action: BusinessRuleAction;
  message?: string;
}

export enum BusinessRuleAction {
  SHOW_FIELD = 'SHOW_FIELD',
  HIDE_FIELD = 'HIDE_FIELD',
  MAKE_REQUIRED = 'MAKE_REQUIRED',
  MAKE_OPTIONAL = 'MAKE_OPTIONAL',
  SET_VALUE = 'SET_VALUE',
  CLEAR_VALUE = 'CLEAR_VALUE',
  DISABLE_FIELD = 'DISABLE_FIELD',
  ENABLE_FIELD = 'ENABLE_FIELD',
  SHOW_WARNING = 'SHOW_WARNING',
  TRIGGER_VALIDATION = 'TRIGGER_VALIDATION'
}

export interface FieldValidationResult {
  fieldName: string;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
}

export interface ValidationError {
  message: string;
  code?: string;
  severity: ValidationSeverity;
  type: ValidationType;
  metadata?: Record<string, any>;
}

export interface FormValidationResults {
  isValid: boolean;
  fieldResults: Record<string, FieldValidationResult>;
  crossFieldErrors: ValidationError[];
  businessRuleResults: BusinessRuleResult[];
  summary: ValidationSummary;
}

export interface BusinessRuleResult {
  ruleName: string;
  triggered: boolean;
  action: BusinessRuleAction;
  message?: string;
  targetField?: string;
  metadata?: Record<string, any>;
}

export interface ValidationSummary {
  totalFields: number;
  validFields: number;
  fieldsWithErrors: number;
  fieldsWithWarnings: number;
  totalErrors: number;
  totalWarnings: number;
  completionPercentage: number;
}

export interface ValidationConfig {
  validateOnMount: boolean;
  validateOnChange: boolean;
  validateOnBlur: boolean;
  debounceMs: number;
  showErrorsImmediately: boolean;
  stopOnFirstError: boolean;
  enableAsyncValidation: boolean;
  enableCrossFieldValidation: boolean;
  enableBusinessRules: boolean;
  locale: string;
}

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  validateOnMount: false,
  validateOnChange: true,
  validateOnBlur: true,
  debounceMs: 300,
  showErrorsImmediately: false,
  stopOnFirstError: false,
  enableAsyncValidation: true,
  enableCrossFieldValidation: true,
  enableBusinessRules: true,
  locale: 'en'
};

// Pre-defined validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PHONE_INDIAN: /^[6-9]\d{9}$/,
  AADHAAR: /^\d{4}\s?\d{4}\s?\d{4}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  PINCODE: /^\d{6}$/,
  GST: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/,
  BANK_ACCOUNT: /^\d{9,18}$/,
  DRIVING_LICENSE: /^(([A-Z]{2}[0-9]{2})( )|([A-Z]{2}-[0-9]{2}))((19|20)[0-9][0-9])[0-9]{7}$/,
  PASSPORT: /^[A-Z]{1}[0-9]{7}$/
};

// Common validation messages
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  EMAIL: 'Please enter a valid email address',
  PHONE: 'Please enter a valid 10-digit mobile number',
  AADHAAR: 'Please enter a valid 12-digit Aadhaar number',
  PAN: 'Please enter a valid PAN number (e.g., ABCDE1234F)',
  IFSC: 'Please enter a valid IFSC code',
  PINCODE: 'Please enter a valid 6-digit pincode',
  MIN_LENGTH: 'Minimum {min} characters required',
  MAX_LENGTH: 'Maximum {max} characters allowed',
  DATE_FUTURE: 'Date cannot be in the future',
  DATE_PAST: 'Date cannot be in the past',
  DATE_RANGE: 'Date must be between {min} and {max}',
  NUMERIC: 'Please enter a valid number',
  RANGE: 'Value must be between {min} and {max}',
  FILE_SIZE: 'File size must be less than {maxSize}MB',
  FILE_TYPE: 'Please select a valid file type: {allowedTypes}'
};

// Field dependency types
export interface FieldDependency {
  fieldName: string;
  dependsOn: string;
  condition: (dependentValue: any, formData: any) => boolean;
  action: DependencyAction;
}

export enum DependencyAction {
  SHOW = 'SHOW',
  HIDE = 'HIDE',
  ENABLE = 'ENABLE',
  DISABLE = 'DISABLE',
  REQUIRE = 'REQUIRE',
  OPTIONAL = 'OPTIONAL',
  VALIDATE = 'VALIDATE',
  CLEAR = 'CLEAR'
}

// Async validation types
export interface AsyncValidationContext {
  fieldName: string;
  value: any;
  formData: any;
  signal: AbortSignal;
}

export type AsyncValidator = (context: AsyncValidationContext) => Promise<ValidationResult>;

// Custom validation context
export interface CustomValidationContext {
  fieldName: string;
  value: any;
  formData: any;
  previousValue?: any;
  schema: FormValidationSchema;
}

export type CustomValidator = (context: CustomValidationContext) => ValidationResult | Promise<ValidationResult>;

// Validation event types
export enum ValidationEvent {
  FIELD_CHANGED = 'FIELD_CHANGED',
  FIELD_BLURRED = 'FIELD_BLURRED',
  FIELD_FOCUSED = 'FIELD_FOCUSED',
  FORM_SUBMITTED = 'FORM_SUBMITTED',
  VALIDATION_STARTED = 'VALIDATION_STARTED',
  VALIDATION_COMPLETED = 'VALIDATION_COMPLETED',
  BUSINESS_RULE_TRIGGERED = 'BUSINESS_RULE_TRIGGERED',
  ASYNC_VALIDATION_STARTED = 'ASYNC_VALIDATION_STARTED',
  ASYNC_VALIDATION_COMPLETED = 'ASYNC_VALIDATION_COMPLETED'
}

export interface ValidationEventPayload {
  event: ValidationEvent;
  fieldName?: string;
  formData: any;
  validationResults?: FormValidationResults;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Validation hooks
export interface ValidationHookContext {
  formData: any;
  fieldName?: string;
  value?: any;
  validationResults?: FormValidationResults;
}

export interface ValidationHooks {
  beforeValidation?: (context: ValidationHookContext) => void | Promise<void>;
  afterValidation?: (context: ValidationHookContext) => void | Promise<void>;
  onValidationError?: (context: ValidationHookContext & { error: Error }) => void;
  onBusinessRuleTriggered?: (context: ValidationHookContext & { rule: BusinessRuleResult }) => void;
}

// Form state management
export interface FormState {
  data: Record<string, any>;
  errors: Record<string, ValidationError[]>;
  warnings: Record<string, ValidationError[]>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  validating: Record<string, boolean>;
  valid: boolean;
  submitting: boolean;
  submitted: boolean;
}

export interface FormAction {
  type: string;
  payload?: any;
}

// Validation utilities
export interface ValidationUtils {
  formatMessage: (template: string, params: Record<string, any>) => string;
  parseDate: (value: string, format?: string) => Date | null;
  formatDate: (date: Date, format?: string) => string;
  sanitizeValue: (value: any, type: string) => any;
  generateValidationId: () => string;
}

// Export commonly used types
export type FormValidator = (formData: any) => FormValidationResults | Promise<FormValidationResults>;
export type FieldValidator = (value: any, formData: any) => ValidationResult | Promise<ValidationResult>;
export type ValidationMiddleware = (context: ValidationHookContext, next: () => void) => void;