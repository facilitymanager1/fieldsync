# Advanced Form Validation System

## Overview

The Advanced Form Validation System provides comprehensive, enterprise-grade validation capabilities for React Native forms. It includes real-time validation, custom rules, cross-field validation, business logic integration, and advanced UI components.

## Architecture

### Core Components

1. **Validation Types & Interfaces** (`types/validation.ts`)
   - 15+ validation types (Required, Email, Phone, Aadhaar, PAN, IFSC, Date, Regex, Custom, Async, etc.)
   - Comprehensive type system with validation results, rules, and configurations
   - Business rule integration with conditional logic

2. **Validation Service** (`services/validationService.ts`)
   - Core validation engine with support for all validation types
   - Async validation with caching and debouncing
   - Cross-field validation and business rule application
   - Indian-specific validations (Aadhaar, PAN, IFSC)

3. **Form Validation Hook** (`hooks/useFormValidation.ts`)
   - Complete form state management with validation integration
   - Real-time validation with debouncing
   - Business rule execution and field dependency handling
   - Event-driven architecture with lifecycle hooks

4. **UI Components**
   - **ValidatedInput** (`components/ValidatedInput.tsx`) - Enhanced input with animations and validation
   - **ValidationSummary** (`components/ValidationSummary.tsx`) - Comprehensive validation overview

5. **Validation Schemas** (`schemas/onboardingValidationSchemas.ts`)
   - Pre-built schemas for all onboarding forms
   - Complex business rules and cross-field validations
   - Indian compliance requirements (Aadhaar, PAN, ESI, PF)

## Key Features

### ✅ **Comprehensive Validation Types**

```typescript
enum ValidationType {
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
```

### ✅ **Indian Compliance Validations**

- **Aadhaar Validation**: Verhoeff algorithm checksum validation
- **PAN Validation**: Format and pattern validation
- **IFSC Validation**: Bank code format validation
- **Phone Validation**: Indian mobile number format
- **GST Validation**: GST number format validation

### ✅ **Advanced Validation Features**

1. **Real-time Validation**: Validate as user types with debouncing
2. **Async Validation**: Server-side validation with caching
3. **Cross-field Validation**: Dependencies between form fields
4. **Business Rules**: Dynamic form behavior based on business logic
5. **Conditional Validation**: Rules that apply based on other field values
6. **File Validation**: Size, type, and format validation for uploads
7. **Data Masking**: Automatic masking of sensitive information

### ✅ **Business Rules Engine**

```typescript
enum BusinessRuleAction {
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
```

## Usage Examples

### 1. Basic Form Setup

```typescript
import { useFormValidation } from '../hooks/useFormValidation';
import { basicDetailsSchema } from '../schemas/onboardingValidationSchemas';

const MyForm = () => {
  const {
    formData,
    setValue,
    validateForm,
    submitForm,
    canSubmit
  } = useFormValidation({
    schema: basicDetailsSchema,
    initialData: { firstName: '', email: '' }
  });

  return (
    <ValidatedInput
      label="Email"
      value={formData.email}
      onChangeText={(text) => setValue('email', text)}
      keyboardType="email-address"
    />
  );
};
```

### 2. Custom Validation Rules

```typescript
const customValidation: ValidationRule = {
  type: ValidationType.CUSTOM,
  message: 'Employee must be at least 18 years old',
  params: {
    validator: (context) => {
      const birthDate = new Date(context.value);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      
      return {
        isValid: age >= 18,
        message: age < 18 ? 'Employee must be at least 18 years old' : undefined
      };
    }
  }
};
```

### 3. Async Validation

```typescript
const asyncEmailValidation: ValidationRule = {
  type: ValidationType.ASYNC,
  message: 'Email already exists',
  asyncValidator: async (context) => {
    const response = await fetch(`/api/check-email/${context.value}`);
    const { exists } = await response.json();
    
    return {
      isValid: !exists,
      message: exists ? 'This email is already registered' : undefined
    };
  }
};
```

### 4. Cross-field Validation

```typescript
const crossFieldRule: CrossFieldRule = {
  name: 'passwordConfirmation',
  fields: ['password', 'confirmPassword'],
  message: 'Passwords do not match',
  validator: (values) => ({
    isValid: values.password === values.confirmPassword
  })
};
```

### 5. Business Rules

```typescript
const salaryBasedESIRule: BusinessRule = {
  name: 'esiRequirement',
  condition: (formData) => {
    const grossSalary = calculateGrossSalary(formData);
    return grossSalary < 21000;
  },
  action: BusinessRuleAction.MAKE_REQUIRED,
  message: 'ESI deduction is mandatory for salary < ₹21,000'
};
```

## Validation Schemas

### Basic Details Schema

```typescript
export const basicDetailsSchema: FormValidationSchema = {
  formName: 'basicDetails',
  fields: [
    {
      fieldName: 'firstName',
      rules: [
        { type: ValidationType.REQUIRED, message: 'First name is required' },
        { type: ValidationType.MIN_LENGTH, params: { min: 2 }, message: 'Minimum 2 characters' },
        { type: ValidationType.REGEX, params: { pattern: /^[A-Za-z\s]+$/ }, message: 'Only letters allowed' }
      ],
      validateOnChange: true,
      debounceMs: 300
    },
    {
      fieldName: 'aadhaarNumber',
      rules: [
        { type: ValidationType.REQUIRED, message: 'Aadhaar is required' },
        { type: ValidationType.AADHAAR, message: 'Invalid Aadhaar number' }
      ]
    }
  ],
  businessRules: [
    {
      name: 'maritalStatusFields',
      condition: (data) => data.maritalStatus === 'Married',
      action: BusinessRuleAction.SHOW_FIELD,
      message: 'Spouse name field is now visible'
    }
  ]
};
```

### Salary Details Schema with Business Logic

```typescript
export const salaryDetailsSchema: FormValidationSchema = {
  formName: 'salaryDetails',
  fields: [
    {
      fieldName: 'basicSalary',
      rules: [
        { type: ValidationType.REQUIRED, message: 'Basic salary is required' },
        { type: ValidationType.NUMERIC, message: 'Enter valid amount' },
        { type: ValidationType.RANGE, params: { min: 10000, max: 500000 }, message: 'Salary must be between ₹10K-₹5L' }
      ]
    },
    {
      fieldName: 'hra',
      rules: [
        { type: ValidationType.CUSTOM, message: 'HRA cannot exceed 50% of basic salary', params: {
          validator: (context) => {
            const basic = Number(context.formData.basicSalary);
            const hra = Number(context.value);
            return { isValid: hra <= basic * 0.5 };
          }
        }}
      ]
    }
  ],
  businessRules: [
    {
      name: 'hideESIForHighSalary',
      condition: (data) => calculateGrossSalary(data) >= 21000,
      action: BusinessRuleAction.HIDE_FIELD,
      message: 'ESI not applicable for salary ≥ ₹21,000'
    }
  ]
};
```

## UI Components

### ValidatedInput Component

Enhanced input component with:
- **Real-time validation** with visual feedback
- **Animated labels** and error states
- **Validation icons** (loading, success, error, warning)
- **Character counting** with limits
- **Password visibility toggle**
- **Help text** and accessibility support
- **Data masking** for sensitive fields

```typescript
<ValidatedInput
  label="Aadhaar Number"
  value={aadhaarNumber}
  onChangeText={setAadhaarNumber}
  keyboardType="numeric"
  maxLength={12}
  validationRules={[
    { type: ValidationType.REQUIRED, message: 'Aadhaar is required' },
    { type: ValidationType.AADHAAR, message: 'Invalid Aadhaar number' }
  ]}
  showValidationIcon={true}
  showCharacterCount={true}
  helpText="Your Aadhaar will be verified securely"
  animateErrors={true}
/>
```

### ValidationSummary Component

Comprehensive validation overview with:
- **Progress tracking** with visual progress bar
- **Error and warning counts** with categorization
- **Field-level details** with expandable sections
- **Business rule results** showing triggered actions
- **Cross-field validation** results
- **Interactive field navigation**

```typescript
<ValidationSummary
  validationResults={validationResults}
  showDetails={true}
  onFieldPress={(fieldName) => navigateToField(fieldName)}
  showProgressBar={true}
  collapsible={true}
/>
```

## Advanced Features

### 1. Validation Events & Hooks

```typescript
const { formData, setValue } = useFormValidation({
  schema: mySchema,
  hooks: {
    beforeValidation: async (context) => {
      console.log('Starting validation for:', context.fieldName);
    },
    afterValidation: async (context) => {
      console.log('Validation completed:', context.validationResults);
    },
    onValidationError: (context) => {
      console.error('Validation failed:', context.error);
    },
    onBusinessRuleTriggered: (context) => {
      console.log('Business rule triggered:', context.rule);
    }
  },
  onValidationEvent: (event) => {
    console.log('Validation event:', event.event, event.fieldName);
  }
});
```

### 2. Conditional Field Visibility

```typescript
// Dynamic field rendering based on business rules
{getValue('maritalStatus') === 'Married' && (
  <ValidatedInput
    label="Spouse Name"
    value={getValue('spouseName')}
    onChangeText={(text) => setValue('spouseName', text)}
    validationRules={[
      { type: ValidationType.REQUIRED, message: 'Spouse name required' }
    ]}
  />
)}

// ESI field shown only for eligible salaries
{(() => {
  const gross = calculateGrossSalary(formData);
  return gross < 21000 && gross > 0;
})() && (
  <ValidatedInput
    label="ESI Deduction"
    // ... ESI field configuration
  />
)}
```

### 3. Data Masking & Security

```typescript
// Automatic masking in validation service
const validateAadhaar = (value: string): ValidationResult => {
  const isValid = VALIDATION_PATTERNS.AADHAAR.test(value);
  return {
    isValid,
    message: isValid ? undefined : 'Invalid Aadhaar',
    metadata: { 
      maskedValue: maskAadhaar(value) // 1234-****-5678
    }
  };
};
```

## Performance Optimizations

### 1. Debounced Validation

```typescript
// Configurable debouncing prevents excessive validation calls
const fieldConfig = {
  fieldName: 'email',
  validateOnChange: true,
  debounceMs: 500, // Wait 500ms after user stops typing
  rules: [emailValidationRule]
};
```

### 2. Async Validation Caching

```typescript
// Built-in caching for async validations
private asyncValidationCache = new Map<string, ValidationResult>();

async validateAsync(context: AsyncValidationContext) {
  const cacheKey = `${context.fieldName}_${context.value}`;
  
  if (this.asyncValidationCache.has(cacheKey)) {
    return this.asyncValidationCache.get(cacheKey)!;
  }
  
  const result = await performAsyncValidation(context);
  this.asyncValidationCache.set(cacheKey, result);
  
  return result;
}
```

### 3. Selective Validation

```typescript
// Only validate dependent fields when necessary
const fieldConfig = {
  fieldName: 'spouseName',
  dependsOn: ['maritalStatus'], // Only validate when maritalStatus changes
  rules: [requiredRule]
};
```

## Indian Compliance Features

### 1. Aadhaar Validation with Verhoeff Algorithm

```typescript
private verifyAadhaarChecksum(aadhaar: string): boolean {
  // Verhoeff algorithm implementation for Aadhaar validation
  const d = [[0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5], /* ... */];
  const p = [[0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4], /* ... */];
  
  let c = 0;
  const digits = aadhaar.split('').reverse();
  
  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[((i + 1) % 8)][parseInt(digits[i])]];
  }
  
  return c === 0;
}
```

### 2. PAN Number Validation

```typescript
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const validatePAN = (pan: string): ValidationResult => {
  const isValid = PAN_PATTERN.test(pan.toUpperCase());
  return {
    isValid,
    metadata: { 
      maskedValue: maskPAN(pan) // ABC***9Z
    }
  };
};
```

### 3. IFSC Code Validation

```typescript
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const validateIFSC = async (ifsc: string): Promise<ValidationResult> => {
  if (!IFSC_PATTERN.test(ifsc)) {
    return { isValid: false, message: 'Invalid IFSC format' };
  }
  
  // Optional: Validate against bank database
  const bankInfo = await getBankInfoByIFSC(ifsc);
  return {
    isValid: !!bankInfo,
    metadata: bankInfo
  };
};
```

## Testing

### Unit Tests

```typescript
describe('ValidationService', () => {
  test('should validate Aadhaar with checksum', () => {
    const result = ValidationService.validateAadhaar('123456789012');
    expect(result.isValid).toBe(true);
  });
  
  test('should handle async validation with caching', async () => {
    const context = { fieldName: 'email', value: 'test@example.com' };
    const result1 = await ValidationService.validateAsync(context, emailValidator);
    const result2 = await ValidationService.validateAsync(context, emailValidator);
    
    expect(result1).toEqual(result2); // Should return cached result
  });
  
  test('should apply business rules correctly', () => {
    const formData = { maritalStatus: 'Married' };
    const rule = { condition: (data) => data.maritalStatus === 'Married' };
    const result = ValidationService.applyBusinessRule(formData, rule);
    
    expect(result.triggered).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Form Validation Integration', () => {
  test('should validate complete onboarding form', async () => {
    const formData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F'
    };
    
    const results = await ValidationService.validateForm(formData, basicDetailsSchema);
    
    expect(results.isValid).toBe(true);
    expect(results.summary.completionPercentage).toBe(100);
  });
});
```

## Best Practices

### 1. Schema Design
- Group related validations logically
- Use descriptive error messages
- Implement proper field dependencies
- Consider user experience in rule ordering

### 2. Performance
- Use debouncing for real-time validation
- Implement caching for expensive validations
- Minimize unnecessary re-validations
- Use conditional validation wisely

### 3. User Experience
- Provide helpful error messages
- Show validation progress
- Use appropriate input types
- Implement accessibility features

### 4. Security
- Mask sensitive data in UI
- Validate on both client and server
- Implement proper input sanitization
- Use secure patterns for async validation

## Migration Guide

### From Basic Validation
```typescript
// Before: Basic validation
const [errors, setErrors] = useState({});

const validateEmail = (email) => {
  if (!email) return 'Email required';
  if (!email.includes('@')) return 'Invalid email';
  return null;
};

// After: Advanced validation
const { setValue, getFieldErrors } = useFormValidation({
  schema: {
    fields: [{
      fieldName: 'email',
      rules: [
        { type: ValidationType.REQUIRED, message: 'Email required' },
        { type: ValidationType.EMAIL, message: 'Invalid email format' }
      ]
    }]
  }
});
```

### Adding Business Rules
```typescript
// Add business rules to existing schema
const enhancedSchema = {
  ...existingSchema,
  businessRules: [
    {
      name: 'salaryBasedESI',
      condition: (data) => calculateSalary(data) < 21000,
      action: BusinessRuleAction.MAKE_REQUIRED,
      message: 'ESI required for salary < ₹21,000'
    }
  ]
};
```

This advanced validation system provides enterprise-grade form validation with Indian compliance features, making it perfect for onboarding applications in the Indian market.