import {
  FormValidationSchema,
  ValidationType,
  ValidationSeverity,
  BusinessRuleAction,
  VALIDATION_MESSAGES,
} from '../types/validation';

// Employee Basic Details Validation Schema
export const basicDetailsSchema: FormValidationSchema = {
  formName: 'basicDetails',
  fields: [
    {
      fieldName: 'firstName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'First name is required'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'First name must be at least 2 characters',
          params: { min: 2 }
        },
        {
          type: ValidationType.MAX_LENGTH,
          message: 'First name cannot exceed 50 characters',
          params: { max: 50 }
        },
        {
          type: ValidationType.REGEX,
          message: 'First name should contain only letters and spaces',
          params: { pattern: /^[A-Za-z\s]+$/ }
        }
      ],
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300
    },
    {
      fieldName: 'lastName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Last name is required'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Last name must be at least 2 characters',
          params: { min: 2 }
        },
        {
          type: ValidationType.REGEX,
          message: 'Last name should contain only letters and spaces',
          params: { pattern: /^[A-Za-z\s]+$/ }
        }
      ]
    },
    {
      fieldName: 'fatherName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Father\'s name is required',
          condition: (formData) => formData.maritalStatus === 'Single'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Father\'s name must be at least 2 characters',
          params: { min: 2 }
        }
      ],
      dependsOn: ['maritalStatus']
    },
    {
      fieldName: 'spouseName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Spouse name is required',
          condition: (formData) => formData.maritalStatus === 'Married'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Spouse name must be at least 2 characters',
          params: { min: 2 }
        }
      ],
      dependsOn: ['maritalStatus']
    },
    {
      fieldName: 'dateOfBirth',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Date of birth is required'
        },
        {
          type: ValidationType.DATE,
          message: 'Please enter a valid date',
          params: { noPast: false, noFuture: true }
        },
        {
          type: ValidationType.CUSTOM,
          message: 'Employee must be at least 18 years old',
          params: {
            validator: (context) => {
              const birthDate = new Date(context.value);
              const today = new Date();
              const age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              
              return {
                isValid: age >= 18,
                message: age < 18 ? 'Employee must be at least 18 years old' : undefined
              };
            }
          }
        }
      ]
    },
    {
      fieldName: 'dateOfJoining',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Date of joining is required'
        },
        {
          type: ValidationType.DATE_RANGE,
          message: 'Date of joining must be between today and next 10 days',
          params: {
            min: new Date(),
            max: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
          }
        }
      ]
    },
    {
      fieldName: 'gender',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Gender is required'
        }
      ]
    },
    {
      fieldName: 'maritalStatus',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Marital status is required'
        }
      ]
    },
    {
      fieldName: 'bloodGroup',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Blood group is required'
        }
      ]
    },
    {
      fieldName: 'nationality',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Nationality is required'
        }
      ]
    },
    {
      fieldName: 'phoneNumber',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Phone number is required'
        },
        {
          type: ValidationType.PHONE,
          message: 'Please enter a valid 10-digit mobile number'
        }
      ]
    },
    {
      fieldName: 'email',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Email address is required'
        },
        {
          type: ValidationType.EMAIL,
          message: 'Please enter a valid email address'
        },
        {
          type: ValidationType.ASYNC,
          message: 'Email already exists',
          asyncValidator: async (context) => {
            // Simulate API call to check email uniqueness
            await new Promise(resolve => setTimeout(resolve, 1000));
            const existingEmails = ['test@example.com', 'admin@company.com'];
            const isUnique = !existingEmails.includes(context.value);
            
            return {
              isValid: isUnique,
              message: isUnique ? undefined : 'This email address is already registered'
            };
          }
        }
      ]
    },
    {
      fieldName: 'aadhaarNumber',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Aadhaar number is required'
        },
        {
          type: ValidationType.AADHAAR,
          message: 'Please enter a valid 12-digit Aadhaar number'
        }
      ]
    },
    {
      fieldName: 'panNumber',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'PAN number is required'
        },
        {
          type: ValidationType.PAN,
          message: 'Please enter a valid PAN number (e.g., ABCDE1234F)'
        }
      ]
    },
    {
      fieldName: 'speciallyAbled',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Please specify if specially abled'
        }
      ]
    },
    {
      fieldName: 'speciallyAbledRemarks',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Please provide remarks for special needs',
          condition: (formData) => formData.speciallyAbled === 'Yes'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Please provide detailed remarks (minimum 10 characters)',
          params: { min: 10 },
          condition: (formData) => formData.speciallyAbled === 'Yes'
        }
      ],
      dependsOn: ['speciallyAbled']
    }
  ],
  crossFieldRules: [
    {
      name: 'dobPanConsistency',
      fields: ['dateOfBirth', 'panNumber'],
      message: 'Date of birth and PAN information should be consistent',
      validator: (values) => {
        // This would integrate with external API to verify DOB-PAN consistency
        return { isValid: true };
      }
    },
    {
      name: 'dobAadhaarConsistency',
      fields: ['dateOfBirth', 'aadhaarNumber'],
      message: 'Date of birth and Aadhaar information should be consistent',
      validator: (values) => {
        // This would integrate with Aadhaar verification API
        return { isValid: true };
      }
    }
  ],
  businessRules: [
    {
      name: 'maritalStatusDynamicFields',
      condition: (formData) => formData.maritalStatus === 'Married',
      action: BusinessRuleAction.SHOW_FIELD,
      message: 'Spouse name field is now required'
    },
    {
      name: 'speciallyAbledRemarks',
      condition: (formData) => formData.speciallyAbled === 'Yes',
      action: BusinessRuleAction.MAKE_REQUIRED,
      message: 'Remarks field is now required for specially abled candidates'
    }
  ]
};

// Document Verification Schema
export const documentSchema: FormValidationSchema = {
  formName: 'documents',
  fields: [
    {
      fieldName: 'aadhaarFront',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Aadhaar front image is required'
        },
        {
          type: ValidationType.FILE,
          message: 'File size must be less than 5MB and format should be JPG, PNG, or PDF',
          params: {
            maxSize: 5,
            allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
          }
        }
      ]
    },
    {
      fieldName: 'aadhaarBack',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Aadhaar back image is required'
        },
        {
          type: ValidationType.FILE,
          message: 'File size must be less than 5MB and format should be JPG, PNG, or PDF',
          params: {
            maxSize: 5,
            allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
          }
        }
      ]
    },
    {
      fieldName: 'panCard',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'PAN card image is required'
        },
        {
          type: ValidationType.FILE,
          message: 'File size must be less than 5MB and format should be JPG, PNG, or PDF',
          params: {
            maxSize: 5,
            allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
          }
        }
      ]
    },
    {
      fieldName: 'drivingLicense',
      rules: [
        {
          type: ValidationType.FILE,
          message: 'File size must be less than 5MB and format should be JPG, PNG, or PDF',
          params: {
            maxSize: 5,
            allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
          },
          condition: (formData) => formData.hasDrivingLicense === true
        }
      ],
      dependsOn: ['hasDrivingLicense']
    },
    {
      fieldName: 'passport',
      rules: [
        {
          type: ValidationType.FILE,
          message: 'File size must be less than 5MB and format should be JPG, PNG, or PDF',
          params: {
            maxSize: 5,
            allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
          },
          condition: (formData) => formData.hasPassport === true
        }
      ],
      dependsOn: ['hasPassport']
    }
  ]
};

// Bank Details Schema
export const bankDetailsSchema: FormValidationSchema = {
  formName: 'bankDetails',
  fields: [
    {
      fieldName: 'accountHolderName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Account holder name is required'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Account holder name must be at least 2 characters',
          params: { min: 2 }
        }
      ]
    },
    {
      fieldName: 'accountNumber',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Account number is required'
        },
        {
          type: ValidationType.REGEX,
          message: 'Please enter a valid account number (9-18 digits)',
          params: { pattern: /^\d{9,18}$/ }
        }
      ]
    },
    {
      fieldName: 'confirmAccountNumber',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Please confirm your account number'
        },
        {
          type: ValidationType.CROSS_FIELD,
          message: 'Account numbers do not match',
          crossFieldValidator: (value, formData) => {
            return {
              isValid: value === formData.accountNumber,
              message: value !== formData.accountNumber ? 'Account numbers do not match' : undefined
            };
          }
        }
      ],
      dependsOn: ['accountNumber']
    },
    {
      fieldName: 'ifscCode',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'IFSC code is required'
        },
        {
          type: ValidationType.IFSC,
          message: 'Please enter a valid IFSC code'
        },
        {
          type: ValidationType.ASYNC,
          message: 'Invalid IFSC code or bank not found',
          asyncValidator: async (context) => {
            // Simulate IFSC validation API call
            await new Promise(resolve => setTimeout(resolve, 800));
            const validIFSCs = ['SBIN0001234', 'HDFC0000123', 'ICIC0000456'];
            const isValid = validIFSCs.includes(context.value);
            
            return {
              isValid,
              message: isValid ? undefined : 'IFSC code not found or invalid',
              metadata: isValid ? { bankName: 'State Bank of India', branch: 'Main Branch' } : undefined
            };
          }
        }
      ]
    },
    {
      fieldName: 'bankName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Bank name is required'
        }
      ]
    },
    {
      fieldName: 'branchName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Branch name is required'
        }
      ]
    },
    {
      fieldName: 'accountType',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Account type is required'
        }
      ]
    },
    {
      fieldName: 'passbookImage',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Passbook or cancelled cheque image is required'
        },
        {
          type: ValidationType.FILE,
          message: 'File size must be less than 5MB and format should be JPG, PNG, or PDF',
          params: {
            maxSize: 5,
            allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
          }
        }
      ]
    }
  ]
};

// Salary Details Schema
export const salaryDetailsSchema: FormValidationSchema = {
  formName: 'salaryDetails',
  fields: [
    {
      fieldName: 'designation',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Designation is required'
        }
      ]
    },
    {
      fieldName: 'department',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Department is required'
        }
      ]
    },
    {
      fieldName: 'basicSalary',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Basic salary is required'
        },
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid salary amount'
        },
        {
          type: ValidationType.RANGE,
          message: 'Basic salary must be between ₹10,000 and ₹5,00,000',
          params: { min: 10000, max: 500000 }
        }
      ]
    },
    {
      fieldName: 'hra',
      rules: [
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid HRA amount'
        },
        {
          type: ValidationType.CUSTOM,
          message: 'HRA cannot exceed 50% of basic salary',
          params: {
            validator: (context) => {
              const basicSalary = Number(context.formData.basicSalary);
              const hra = Number(context.value);
              const maxHRA = basicSalary * 0.5;
              
              return {
                isValid: hra <= maxHRA,
                message: hra > maxHRA ? `HRA cannot exceed ₹${maxHRA.toLocaleString()} (50% of basic salary)` : undefined
              };
            }
          }
        }
      ],
      dependsOn: ['basicSalary']
    },
    {
      fieldName: 'conveyanceAllowance',
      rules: [
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid conveyance allowance'
        },
        {
          type: ValidationType.RANGE,
          message: 'Conveyance allowance cannot exceed ₹25,000',
          params: { min: 0, max: 25000 }
        }
      ]
    },
    {
      fieldName: 'medicalAllowance',
      rules: [
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid medical allowance'
        }
      ]
    },
    {
      fieldName: 'otherAllowances',
      rules: [
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid amount for other allowances'
        }
      ]
    },
    {
      fieldName: 'pfDeduction',
      rules: [
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid PF deduction amount'
        },
        {
          type: ValidationType.CUSTOM,
          message: 'PF deduction should be 12% of basic salary',
          params: {
            validator: (context) => {
              const basicSalary = Number(context.formData.basicSalary);
              const pfDeduction = Number(context.value);
              const expectedPF = basicSalary * 0.12;
              const tolerance = expectedPF * 0.1; // 10% tolerance
              
              return {
                isValid: Math.abs(pfDeduction - expectedPF) <= tolerance,
                message: Math.abs(pfDeduction - expectedPF) > tolerance ? 
                  `PF deduction should be approximately ₹${expectedPF.toLocaleString()} (12% of basic salary)` : 
                  undefined,
                severity: ValidationSeverity.WARNING
              };
            }
          }
        }
      ],
      dependsOn: ['basicSalary']
    },
    {
      fieldName: 'esiDeduction',
      rules: [
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid ESI deduction amount'
        }
      ]
    },
    {
      fieldName: 'tds',
      rules: [
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid TDS amount'
        }
      ]
    }
  ],
  businessRules: [
    {
      name: 'autoCalculateGrossSalary',
      condition: (formData) => formData.basicSalary && formData.hra && formData.conveyanceAllowance,
      action: BusinessRuleAction.SET_VALUE,
      message: 'Gross salary automatically calculated'
    },
    {
      name: 'hideESIForHighSalary',
      condition: (formData) => {
        const grossSalary = (Number(formData.basicSalary) || 0) + 
                           (Number(formData.hra) || 0) + 
                           (Number(formData.conveyanceAllowance) || 0) + 
                           (Number(formData.medicalAllowance) || 0) + 
                           (Number(formData.otherAllowances) || 0);
        return grossSalary >= 21000;
      },
      action: BusinessRuleAction.HIDE_FIELD,
      message: 'ESI not applicable for salary ≥ ₹21,000'
    },
    {
      name: 'mandatoryESIForLowSalary',
      condition: (formData) => {
        const grossSalary = (Number(formData.basicSalary) || 0) + 
                           (Number(formData.hra) || 0) + 
                           (Number(formData.conveyanceAllowance) || 0) + 
                           (Number(formData.medicalAllowance) || 0) + 
                           (Number(formData.otherAllowances) || 0);
        return grossSalary < 21000 && grossSalary > 0;
      },
      action: BusinessRuleAction.MAKE_REQUIRED,
      message: 'ESI deduction is mandatory for salary < ₹21,000'
    }
  ]
};

// Education Details Schema
export const educationSchema: FormValidationSchema = {
  formName: 'education',
  fields: [
    {
      fieldName: 'highestQualification',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Highest qualification is required'
        }
      ]
    },
    {
      fieldName: 'institution',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Institution name is required',
          condition: (formData) => formData.highestQualification !== 'Illiterate'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Institution name must be at least 3 characters',
          params: { min: 3 },
          condition: (formData) => formData.highestQualification !== 'Illiterate'
        }
      ],
      dependsOn: ['highestQualification']
    },
    {
      fieldName: 'affiliatedUniversity',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Affiliated university is required',
          condition: (formData) => !['Illiterate', '10th', '12th'].includes(formData.highestQualification)
        }
      ],
      dependsOn: ['highestQualification']
    },
    {
      fieldName: 'yearOfGraduation',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Year of graduation is required',
          condition: (formData) => formData.highestQualification !== 'Illiterate'
        },
        {
          type: ValidationType.NUMERIC,
          message: 'Please enter a valid year'
        },
        {
          type: ValidationType.RANGE,
          message: 'Year should be between 1970 and current year',
          params: { 
            min: 1970, 
            max: new Date().getFullYear() 
          }
        }
      ],
      dependsOn: ['highestQualification']
    },
    {
      fieldName: 'registrationNumber',
      rules: [
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Registration number must be at least 5 characters',
          params: { min: 5 },
          condition: (formData) => formData.registrationNumber && formData.registrationNumber.trim()
        }
      ]
    },
    {
      fieldName: 'studyMode',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Study mode is required',
          condition: (formData) => !['Illiterate', '10th', '12th'].includes(formData.highestQualification)
        }
      ],
      dependsOn: ['highestQualification']
    }
  ],
  businessRules: [
    {
      name: 'skipFieldsForIlliterate',
      condition: (formData) => formData.highestQualification === 'Illiterate',
      action: BusinessRuleAction.HIDE_FIELD,
      message: 'Education fields hidden for illiterate candidates'
    },
    {
      name: 'hideUniversityForSchool',
      condition: (formData) => ['10th', '12th'].includes(formData.highestQualification),
      action: BusinessRuleAction.HIDE_FIELD,
      message: 'University field not applicable for school education'
    }
  ]
};

// Emergency Contacts Schema
export const emergencyContactsSchema: FormValidationSchema = {
  formName: 'emergencyContacts',
  fields: [
    {
      fieldName: 'primaryContactName',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Primary contact name is required'
        },
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Contact name must be at least 2 characters',
          params: { min: 2 }
        }
      ]
    },
    {
      fieldName: 'primaryContactPhone',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Primary contact phone is required'
        },
        {
          type: ValidationType.PHONE,
          message: 'Please enter a valid 10-digit mobile number'
        }
      ]
    },
    {
      fieldName: 'primaryContactRelation',
      rules: [
        {
          type: ValidationType.REQUIRED,
          message: 'Primary contact relationship is required'
        }
      ]
    },
    {
      fieldName: 'secondaryContactName',
      rules: [
        {
          type: ValidationType.MIN_LENGTH,
          message: 'Contact name must be at least 2 characters',
          params: { min: 2 },
          condition: (formData) => formData.secondaryContactName && formData.secondaryContactName.trim()
        }
      ]
    },
    {
      fieldName: 'secondaryContactPhone',
      rules: [
        {
          type: ValidationType.PHONE,
          message: 'Please enter a valid 10-digit mobile number',
          condition: (formData) => formData.secondaryContactPhone && formData.secondaryContactPhone.trim()
        },
        {
          type: ValidationType.CROSS_FIELD,
          message: 'Secondary contact phone should be different from primary contact',
          crossFieldValidator: (value, formData) => {
            if (!value || !formData.primaryContactPhone) return { isValid: true };
            return {
              isValid: value !== formData.primaryContactPhone,
              message: value === formData.primaryContactPhone ? 
                'Secondary contact phone should be different from primary contact' : undefined,
              severity: ValidationSeverity.WARNING
            };
          }
        }
      ],
      dependsOn: ['primaryContactPhone']
    }
  ]
};

export default {
  basicDetailsSchema,
  documentSchema,
  bankDetailsSchema,
  salaryDetailsSchema,
  educationSchema,
  emergencyContactsSchema
};