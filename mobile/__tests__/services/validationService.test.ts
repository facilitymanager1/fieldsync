import ValidationService from '../../src/services/validationService';
import {
  ValidationType,
  ValidationSeverity,
  FormValidationSchema,
} from '../../src/types/validation';
import { TestUtils, mockUserData, generateTestValidationResult } from '../setup';

describe('ValidationService', () => {
  beforeEach(() => {
    ValidationService.clearCache();
    jest.clearAllMocks();
  });

  describe('Basic Validations', () => {
    describe('Required Validation', () => {
      it('should pass for non-empty values', async () => {
        const result = await ValidationService.validateField(
          'firstName',
          'John',
          {},
          [{ type: ValidationType.REQUIRED, message: 'Required' }]
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail for empty string', async () => {
        const result = await ValidationService.validateField(
          'firstName',
          '',
          {},
          [{ type: ValidationType.REQUIRED, message: 'First name is required' }]
        );

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result).toHaveValidationError('First name is required');
      });

      it('should fail for null and undefined', async () => {
        const nullResult = await ValidationService.validateField(
          'firstName',
          null,
          {},
          [{ type: ValidationType.REQUIRED, message: 'Required' }]
        );

        const undefinedResult = await ValidationService.validateField(
          'firstName',
          undefined,
          {},
          [{ type: ValidationType.REQUIRED, message: 'Required' }]
        );

        expect(nullResult.isValid).toBe(false);
        expect(undefinedResult.isValid).toBe(false);
      });

      it('should fail for whitespace-only strings', async () => {
        const result = await ValidationService.validateField(
          'firstName',
          '   ',
          {},
          [{ type: ValidationType.REQUIRED, message: 'Required' }]
        );

        expect(result.isValid).toBe(false);
      });
    });

    describe('Email Validation', () => {
      const emailRule = { type: ValidationType.EMAIL, message: 'Invalid email' };

      it('should validate correct email formats', async () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.in',
          'user+tag@example.org',
          'user123@test-domain.com',
        ];

        for (const email of validEmails) {
          const result = await ValidationService.validateField('email', email, {}, [emailRule]);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid email formats', async () => {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user@@domain.com',
          'user name@domain.com',
          'user@domain',
        ];

        for (const email of invalidEmails) {
          const result = await ValidationService.validateField('email', email, {}, [emailRule]);
          expect(result.isValid).toBe(false);
        }
      });

      it('should allow empty values for optional email fields', async () => {
        const result = await ValidationService.validateField('email', '', {}, [emailRule]);
        expect(result.isValid).toBe(true);
      });
    });

    describe('Phone Validation', () => {
      const phoneRule = { type: ValidationType.PHONE, message: 'Invalid phone' };

      it('should validate Indian mobile numbers', async () => {
        const validNumbers = [
          '9876543210',
          '8765432109',
          '7654321098',
          '6543210987',
        ];

        for (const phone of validNumbers) {
          const result = await ValidationService.validateField('phone', phone, {}, [phoneRule]);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid phone numbers', async () => {
        const invalidNumbers = [
          '1234567890', // starts with 1
          '567890123', // 9 digits
          '98765432101', // 11 digits
          '5876543210', // starts with 5
          'abcd567890', // contains letters
        ];

        for (const phone of invalidNumbers) {
          const result = await ValidationService.validateField('phone', phone, {}, [phoneRule]);
          expect(result.isValid).toBe(false);
        }
      });
    });
  });

  describe('Indian Specific Validations', () => {
    describe('Aadhaar Validation', () => {
      const aadhaarRule = { type: ValidationType.AADHAAR, message: 'Invalid Aadhaar' };

      it('should validate correct Aadhaar format', async () => {
        // Using a mock Aadhaar number that passes format validation
        const result = await ValidationService.validateField(
          'aadhaar',
          '123456789012',
          {},
          [aadhaarRule]
        );

        expect(result.isValid).toBe(true);
      });

      it('should reject invalid Aadhaar formats', async () => {
        const invalidAadhaar = [
          '12345678901', // 11 digits
          '1234567890123', // 13 digits
          'abcd56789012', // contains letters
          '1234 5678 901', // 11 digits with spaces
        ];

        for (const aadhaar of invalidAadhaar) {
          const result = await ValidationService.validateField('aadhaar', aadhaar, {}, [aadhaarRule]);
          expect(result.isValid).toBe(false);
        }
      });

      it('should handle Aadhaar with spaces', async () => {
        const result = await ValidationService.validateField(
          'aadhaar',
          '1234 5678 9012',
          {},
          [aadhaarRule]
        );

        expect(result.isValid).toBe(true);
      });

      it('should provide masked value in metadata', async () => {
        const result = await ValidationService.validateField(
          'aadhaar',
          '123456789012',
          {},
          [aadhaarRule]
        );

        expect(result.metadata).toBeDefined();
        expect(result.metadata.maskedValue).toMatch(/\d{4}-\*\*\*\*-\d{4}/);
      });
    });

    describe('PAN Validation', () => {
      const panRule = { type: ValidationType.PAN, message: 'Invalid PAN' };

      it('should validate correct PAN format', async () => {
        const validPANs = [
          'ABCDE1234F',
          'XYZTE5678K',
          'PQRST9876L',
        ];

        for (const pan of validPANs) {
          const result = await ValidationService.validateField('pan', pan, {}, [panRule]);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid PAN formats', async () => {
        const invalidPANs = [
          'ABC1234F', // too short
          'ABCDE1234', // missing last letter
          '12345ABCDE', // numbers first
          'abcde1234f', // lowercase
          'ABCDE12345', // 5 numbers
        ];

        for (const pan of invalidPANs) {
          const result = await ValidationService.validateField('pan', pan, {}, [panRule]);
          expect(result.isValid).toBe(false);
        }
      });

      it('should provide masked value in metadata', async () => {
        const result = await ValidationService.validateField('pan', 'ABCDE1234F', {}, [panRule]);

        expect(result.metadata).toBeDefined();
        expect(result.metadata.maskedValue).toBe('ABC***4F');
      });
    });

    describe('IFSC Validation', () => {
      const ifscRule = { type: ValidationType.IFSC, message: 'Invalid IFSC' };

      it('should validate correct IFSC format', async () => {
        const validIFSCs = [
          'SBIN0001234',
          'HDFC0000567',
          'ICIC0001234',
          'AXIS0012345',
        ];

        for (const ifsc of validIFSCs) {
          const result = await ValidationService.validateField('ifsc', ifsc, {}, [ifscRule]);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid IFSC formats', async () => {
        const invalidIFSCs = [
          'SBIN001234', // missing 0
          'HDFC1000567', // 1 instead of 0
          'ICIC', // too short
          'AXIS00123456', // too long
          'sbin0001234', // lowercase
        ];

        for (const ifsc of invalidIFSCs) {
          const result = await ValidationService.validateField('ifsc', ifsc, {}, [ifscRule]);
          expect(result.isValid).toBe(false);
        }
      });
    });
  });

  describe('Advanced Validations', () => {
    describe('Date Validation', () => {
      it('should validate correct dates', async () => {
        const dateRule = { type: ValidationType.DATE, message: 'Invalid date' };
        const validDates = [
          '2023-01-01',
          '1990-12-31',
          '2025-01-15',
        ];

        for (const date of validDates) {
          const result = await ValidationService.validateField('date', date, {}, [dateRule]);
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject future dates when noFuture is true', async () => {
        const dateRule = {
          type: ValidationType.DATE,
          message: 'Future date not allowed',
          params: { noFuture: true }
        };

        const futureDate = '2030-01-01';
        const result = await ValidationService.validateField('date', futureDate, {}, [dateRule]);
        expect(result.isValid).toBe(false);
      });

      it('should reject past dates when noPast is true', async () => {
        const dateRule = {
          type: ValidationType.DATE,
          message: 'Past date not allowed',
          params: { noPast: true }
        };

        const pastDate = '2020-01-01';
        const result = await ValidationService.validateField('date', pastDate, {}, [dateRule]);
        expect(result.isValid).toBe(false);
      });
    });

    describe('Date Range Validation', () => {
      it('should validate dates within range', async () => {
        const dateRangeRule = {
          type: ValidationType.DATE_RANGE,
          message: 'Date out of range',
          params: {
            min: new Date('2025-01-01'),
            max: new Date('2025-12-31'),
          }
        };

        const validDate = '2025-06-15';
        const result = await ValidationService.validateField('date', validDate, {}, [dateRangeRule]);
        expect(result.isValid).toBe(true);
      });

      it('should reject dates outside range', async () => {
        const dateRangeRule = {
          type: ValidationType.DATE_RANGE,
          message: 'Date out of range',
          params: {
            min: new Date('2025-01-01'),
            max: new Date('2025-12-31'),
          }
        };

        const beforeMin = await ValidationService.validateField('date', '2024-12-31', {}, [dateRangeRule]);
        const afterMax = await ValidationService.validateField('date', '2026-01-01', {}, [dateRangeRule]);

        expect(beforeMin.isValid).toBe(false);
        expect(afterMax.isValid).toBe(false);
      });
    });

    describe('Length Validations', () => {
      it('should validate minimum length', async () => {
        const minLengthRule = {
          type: ValidationType.MIN_LENGTH,
          message: 'Too short',
          params: { min: 5 }
        };

        const validValue = await ValidationService.validateField('field', 'hello', {}, [minLengthRule]);
        const invalidValue = await ValidationService.validateField('field', 'hi', {}, [minLengthRule]);

        expect(validValue.isValid).toBe(true);
        expect(invalidValue.isValid).toBe(false);
      });

      it('should validate maximum length', async () => {
        const maxLengthRule = {
          type: ValidationType.MAX_LENGTH,
          message: 'Too long',
          params: { max: 10 }
        };

        const validValue = await ValidationService.validateField('field', 'hello', {}, [maxLengthRule]);
        const invalidValue = await ValidationService.validateField('field', 'this is too long', {}, [maxLengthRule]);

        expect(validValue.isValid).toBe(true);
        expect(invalidValue.isValid).toBe(false);
      });
    });

    describe('Numeric Validations', () => {
      it('should validate numeric values', async () => {
        const numericRule = { type: ValidationType.NUMERIC, message: 'Not a number' };

        const validNumbers = ['123', '45.67', '0', '-10'];
        const invalidNumbers = ['abc', '12abc', '', 'NaN'];

        for (const num of validNumbers) {
          const result = await ValidationService.validateField('field', num, {}, [numericRule]);
          expect(result.isValid).toBe(true);
        }

        for (const num of invalidNumbers) {
          const result = await ValidationService.validateField('field', num, {}, [numericRule]);
          expect(result.isValid).toBe(false);
        }
      });

      it('should validate numeric ranges', async () => {
        const rangeRule = {
          type: ValidationType.RANGE,
          message: 'Out of range',
          params: { min: 10, max: 100 }
        };

        const validValue = await ValidationService.validateField('field', '50', {}, [rangeRule]);
        const belowMin = await ValidationService.validateField('field', '5', {}, [rangeRule]);
        const aboveMax = await ValidationService.validateField('field', '150', {}, [rangeRule]);

        expect(validValue.isValid).toBe(true);
        expect(belowMin.isValid).toBe(false);
        expect(aboveMax.isValid).toBe(false);
      });
    });

    describe('File Validation', () => {
      it('should validate file size', async () => {
        const fileRule = {
          type: ValidationType.FILE,
          message: 'Invalid file',
          params: { maxSize: 5 } // 5MB
        };

        const validFile = { size: 3 * 1024 * 1024, type: 'image/jpeg' }; // 3MB
        const invalidFile = { size: 10 * 1024 * 1024, type: 'image/jpeg' }; // 10MB

        const validResult = await ValidationService.validateField('file', validFile, {}, [fileRule]);
        const invalidResult = await ValidationService.validateField('file', invalidFile, {}, [fileRule]);

        expect(validResult.isValid).toBe(true);
        expect(invalidResult.isValid).toBe(false);
      });

      it('should validate file types', async () => {
        const fileRule = {
          type: ValidationType.FILE,
          message: 'Invalid file type',
          params: { allowedTypes: ['image/jpeg', 'image/png'] }
        };

        const validFile = { size: 1024, type: 'image/jpeg' };
        const invalidFile = { size: 1024, type: 'application/pdf' };

        const validResult = await ValidationService.validateField('file', validFile, {}, [fileRule]);
        const invalidResult = await ValidationService.validateField('file', invalidFile, {}, [fileRule]);

        expect(validResult.isValid).toBe(true);
        expect(invalidResult.isValid).toBe(false);
      });
    });
  });

  describe('Custom Validations', () => {
    it('should execute custom validation functions', async () => {
      const customRule = {
        type: ValidationType.CUSTOM,
        message: 'Custom validation failed',
        params: {
          validator: (context: any) => ({
            isValid: context.value === 'valid',
            message: context.value !== 'valid' ? 'Value must be "valid"' : undefined
          })
        }
      };

      const validResult = await ValidationService.validateField('field', 'valid', {}, [customRule]);
      const invalidResult = await ValidationService.validateField('field', 'invalid', {}, [customRule]);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors[0].message).toBe('Value must be "valid"');
    });

    it('should handle async custom validations', async () => {
      const asyncRule = {
        type: ValidationType.ASYNC,
        message: 'Async validation failed',
        asyncValidator: async (context: any) => {
          await TestUtils.waitForAsync();
          return {
            isValid: context.value === 'async-valid',
            message: context.value !== 'async-valid' ? 'Async validation failed' : undefined
          };
        }
      };

      const validResult = await ValidationService.validateField('field', 'async-valid', {}, [asyncRule]);
      const invalidResult = await ValidationService.validateField('field', 'async-invalid', {}, [asyncRule]);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Conditional Validations', () => {
    it('should apply rules based on conditions', async () => {
      const conditionalRule = {
        type: ValidationType.REQUIRED,
        message: 'Required when married',
        condition: (formData: any) => formData.maritalStatus === 'Married'
      };

      // Should not apply when single
      const singleResult = await ValidationService.validateField(
        'spouseName',
        '',
        { maritalStatus: 'Single' },
        [conditionalRule]
      );

      // Should apply when married
      const marriedResult = await ValidationService.validateField(
        'spouseName',
        '',
        { maritalStatus: 'Married' },
        [conditionalRule]
      );

      expect(singleResult.isValid).toBe(true);
      expect(marriedResult.isValid).toBe(false);
    });
  });

  describe('Cross-field Validations', () => {
    it('should validate cross-field dependencies', async () => {
      const crossFieldRule = {
        type: ValidationType.CROSS_FIELD,
        message: 'Passwords do not match',
        crossFieldValidator: (value: any, formData: any) => ({
          isValid: value === formData.password,
          message: value !== formData.password ? 'Passwords do not match' : undefined
        })
      };

      const matchingResult = await ValidationService.validateField(
        'confirmPassword',
        'password123',
        { password: 'password123' },
        [crossFieldRule]
      );

      const nonMatchingResult = await ValidationService.validateField(
        'confirmPassword',
        'different',
        { password: 'password123' },
        [crossFieldRule]
      );

      expect(matchingResult.isValid).toBe(true);
      expect(nonMatchingResult.isValid).toBe(false);
    });
  });

  describe('Form Validation', () => {
    it('should validate entire form with multiple fields', async () => {
      const schema: FormValidationSchema = {
        formName: 'testForm',
        fields: [
          {
            fieldName: 'firstName',
            rules: [
              { type: ValidationType.REQUIRED, message: 'First name required' },
              { type: ValidationType.MIN_LENGTH, message: 'Too short', params: { min: 2 } }
            ]
          },
          {
            fieldName: 'email',
            rules: [
              { type: ValidationType.REQUIRED, message: 'Email required' },
              { type: ValidationType.EMAIL, message: 'Invalid email' }
            ]
          }
        ]
      };

      const validData = {
        firstName: 'John',
        email: 'john@example.com'
      };

      const invalidData = {
        firstName: 'J',
        email: 'invalid-email'
      };

      const validResult = await ValidationService.validateForm(validData, schema);
      const invalidResult = await ValidationService.validateForm(invalidData, schema);

      expect(validResult.isValid).toBe(true);
      expect(validResult.summary.totalErrors).toBe(0);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.summary.totalErrors).toBe(2);
      expect(invalidResult.fieldResults.firstName.isValid).toBe(false);
      expect(invalidResult.fieldResults.email.isValid).toBe(false);
    });

    it('should calculate validation summary correctly', async () => {
      const schema: FormValidationSchema = {
        formName: 'testForm',
        fields: [
          {
            fieldName: 'field1',
            rules: [{ type: ValidationType.REQUIRED, message: 'Required' }]
          },
          {
            fieldName: 'field2',
            rules: [{ type: ValidationType.REQUIRED, message: 'Required' }]
          },
          {
            fieldName: 'field3',
            rules: [{ type: ValidationType.REQUIRED, message: 'Required' }]
          }
        ]
      };

      const partialData = {
        field1: 'value1',
        field2: '', // invalid
        field3: 'value3'
      };

      const result = await ValidationService.validateForm(partialData, schema);

      expect(result.summary.totalFields).toBe(3);
      expect(result.summary.validFields).toBe(2);
      expect(result.summary.fieldsWithErrors).toBe(1);
      expect(result.summary.completionPercentage).toBeCloseTo(66.67, 1);
    });
  });

  describe('Data Masking', () => {
    it('should mask Aadhaar numbers correctly', async () => {
      const result = await ValidationService.validateField(
        'aadhaar',
        '123456789012',
        {},
        [{ type: ValidationType.AADHAAR, message: 'Invalid' }]
      );

      expect(result.metadata?.maskedValue).toBe('1234-****-9012');
    });

    it('should mask PAN numbers correctly', async () => {
      const result = await ValidationService.validateField(
        'pan',
        'ABCDE1234F',
        {},
        [{ type: ValidationType.PAN, message: 'Invalid' }]
      );

      expect(result.metadata?.maskedValue).toBe('ABC***4F');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache async validation results', async () => {
      const mockValidator = jest.fn().mockResolvedValue({ isValid: true });
      
      const asyncRule = {
        type: ValidationType.ASYNC,
        message: 'Async validation failed',
        asyncValidator: mockValidator
      };

      // First call
      await ValidationService.validateField('field', 'test', {}, [asyncRule]);
      
      // Second call with same value
      await ValidationService.validateField('field', 'test', {}, [asyncRule]);

      // Should only call validator once due to caching
      expect(mockValidator).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when requested', async () => {
      const mockValidator = jest.fn().mockResolvedValue({ isValid: true });
      
      const asyncRule = {
        type: ValidationType.ASYNC,
        message: 'Async validation failed',
        asyncValidator: mockValidator
      };

      // First call
      await ValidationService.validateField('field', 'test', {}, [asyncRule]);
      
      // Clear cache
      ValidationService.clearCache();
      
      // Second call after cache clear
      await ValidationService.validateField('field', 'test', {}, [asyncRule]);

      // Should call validator twice
      expect(mockValidator).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const faultyRule = {
        type: ValidationType.CUSTOM,
        message: 'Custom validation',
        params: {
          validator: () => {
            throw new Error('Validation error');
          }
        }
      };

      // Should not throw but handle error gracefully
      await expect(
        ValidationService.validateField('field', 'test', {}, [faultyRule])
      ).resolves.not.toThrow();
    });

    it('should handle async validation timeouts', async () => {
      const timeoutValidator = async (context: any) => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        return { isValid: true };
      };

      const asyncRule = {
        type: ValidationType.ASYNC,
        message: 'Timeout test',
        asyncValidator: timeoutValidator
      };

      // Should handle timeout gracefully
      const result = await ValidationService.validateField('field', 'test', {}, [asyncRule]);
      expect(result).toBeDefined();
    });
  });
});