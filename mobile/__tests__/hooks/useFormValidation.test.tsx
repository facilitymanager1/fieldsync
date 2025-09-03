import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { useFormValidation } from '../../src/hooks/useFormValidation';
import {
  FormValidationSchema,
  ValidationType,
  BusinessRuleAction,
  ValidationEvent,
} from '../../src/types/validation';
import { TestUtils, waitForAsync } from '../setup';

// Mock ValidationService
jest.mock('../../src/services/validationService', () => ({
  __esModule: true,
  default: {
    setConfig: jest.fn(),
    validateField: jest.fn(),
    validateForm: jest.fn(),
    clearCache: jest.fn(),
  },
}));

import ValidationService from '../../src/services/validationService';

const mockValidationService = ValidationService as jest.Mocked<typeof ValidationService>;

describe('useFormValidation', () => {
  let mockSchema: FormValidationSchema;
  let mockOnValidationEvent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockOnValidationEvent = jest.fn();

    mockSchema = {
      formName: 'testForm',
      fields: [
        {
          fieldName: 'firstName',
          rules: [
            { type: ValidationType.REQUIRED, message: 'First name is required' },
            { type: ValidationType.MIN_LENGTH, message: 'Minimum 2 characters', params: { min: 2 } }
          ],
          validateOnChange: true,
          debounceMs: 300
        },
        {
          fieldName: 'email',
          rules: [
            { type: ValidationType.REQUIRED, message: 'Email is required' },
            { type: ValidationType.EMAIL, message: 'Invalid email format' }
          ],
          validateOnChange: true,
          validateOnBlur: true
        },
        {
          fieldName: 'spouseName',
          rules: [
            { 
              type: ValidationType.REQUIRED, 
              message: 'Spouse name required when married',
              condition: (formData) => formData.maritalStatus === 'Married'
            }
          ],
          dependsOn: ['maritalStatus']
        }
      ],
      businessRules: [
        {
          name: 'showSpouseField',
          condition: (formData) => formData.maritalStatus === 'Married',
          action: BusinessRuleAction.SHOW_FIELD,
          message: 'Spouse field is now required'
        }
      ]
    };

    // Setup default mock responses
    mockValidationService.validateField.mockResolvedValue({
      fieldName: 'testField',
      isValid: true,
      errors: [],
      warnings: [],
      infos: []
    });

    mockValidationService.validateForm.mockResolvedValue({
      isValid: true,
      fieldResults: {},
      crossFieldErrors: [],
      businessRuleResults: [],
      summary: {
        totalFields: 0,
        validFields: 0,
        fieldsWithErrors: 0,
        fieldsWithWarnings: 0,
        totalErrors: 0,
        totalWarnings: 0,
        completionPercentage: 100
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with provided initial data', () => {
      const initialData = { firstName: 'John', email: 'john@example.com' };
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          initialData,
          onValidationEvent: mockOnValidationEvent
        })
      );

      expect(result.current.formData).toEqual(initialData);
      expect(result.current.formState.data).toEqual(initialData);
    });

    it('should initialize with empty data when no initial data provided', () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      expect(result.current.formData).toEqual({});
      expect(result.current.formState.data).toEqual({});
    });

    it('should configure validation service', () => {
      const config = { validateOnChange: false, debounceMs: 500 };
      
      renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          config,
          onValidationEvent: mockOnValidationEvent
        })
      );

      expect(mockValidationService.setConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('Field Value Management', () => {
    it('should update field value using setValue', async () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        result.current.setValue('firstName', 'John');
      });

      expect(result.current.formData.firstName).toBe('John');
      expect(result.current.formState.dirty.firstName).toBe(true);
      expect(result.current.formState.touched.firstName).toBe(true);
    });

    it('should update multiple values using setValues', () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      act(() => {
        result.current.setValues({
          firstName: 'John',
          email: 'john@example.com'
        });
      });

      expect(result.current.formData.firstName).toBe('John');
      expect(result.current.formData.email).toBe('john@example.com');
      expect(result.current.formState.dirty.firstName).toBe(true);
      expect(result.current.formState.dirty.email).toBe(true);
    });

    it('should get field value using getValue', () => {
      const initialData = { firstName: 'John' };
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          initialData,
          onValidationEvent: mockOnValidationEvent
        })
      );

      expect(result.current.getValue('firstName')).toBe('John');
      expect(result.current.getValue('nonexistent')).toBeUndefined();
    });

    it('should track dirty state correctly', async () => {
      const initialData = { firstName: 'John' };
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          initialData,
          onValidationEvent: mockOnValidationEvent
        })
      );

      // Initially not dirty
      expect(result.current.isDirty('firstName')).toBe(false);
      expect(result.current.isDirty()).toBe(false);

      // Change value
      await act(async () => {
        result.current.setValue('firstName', 'Jane');
      });

      expect(result.current.isDirty('firstName')).toBe(true);
      expect(result.current.isDirty()).toBe(true);

      // Change back to original value
      await act(async () => {
        result.current.setValue('firstName', 'John');
      });

      expect(result.current.isDirty('firstName')).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate field on change when configured', async () => {
      mockValidationService.validateField.mockResolvedValue({
        fieldName: 'firstName',
        isValid: false,
        errors: [{ message: 'First name is required', severity: 'ERROR', type: ValidationType.REQUIRED }],
        warnings: [],
        infos: []
      });

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        result.current.setValue('firstName', '');
        jest.advanceTimersByTime(300); // Trigger debounced validation
        await waitForAsync();
      });

      expect(mockValidationService.validateField).toHaveBeenCalledWith(
        'firstName',
        '',
        expect.any(Object),
        expect.any(Array),
        mockSchema
      );
    });

    it('should debounce validation calls', async () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        result.current.setValue('firstName', 'J');
        result.current.setValue('firstName', 'Jo');
        result.current.setValue('firstName', 'Joh');
        result.current.setValue('firstName', 'John');
        
        jest.advanceTimersByTime(299); // Just before debounce time
      });

      // Should not have called validation yet
      expect(mockValidationService.validateField).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(1); // Trigger debounced validation
        await waitForAsync();
      });

      // Should only validate once with the final value
      expect(mockValidationService.validateField).toHaveBeenCalledTimes(1);
      expect(mockValidationService.validateField).toHaveBeenCalledWith(
        'firstName',
        'John',
        expect.any(Object),
        expect.any(Array),
        mockSchema
      );
    });

    it('should validate entire form', async () => {
      const mockFormResult = {
        isValid: false,
        fieldResults: {
          firstName: {
            fieldName: 'firstName',
            isValid: false,
            errors: [{ message: 'First name is required', severity: 'ERROR', type: ValidationType.REQUIRED }],
            warnings: [],
            infos: []
          }
        },
        crossFieldErrors: [],
        businessRuleResults: [],
        summary: {
          totalFields: 2,
          validFields: 1,
          fieldsWithErrors: 1,
          fieldsWithWarnings: 0,
          totalErrors: 1,
          totalWarnings: 0,
          completionPercentage: 50
        }
      };

      mockValidationService.validateForm.mockResolvedValue(mockFormResult);

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      let validationResult;
      await act(async () => {
        validationResult = await result.current.validateForm();
      });

      expect(mockValidationService.validateForm).toHaveBeenCalledWith(
        result.current.formData,
        mockSchema
      );
      expect(validationResult).toEqual(mockFormResult);
      expect(result.current.formState.valid).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      const validationError = new Error('Validation failed');
      mockValidationService.validateField.mockRejectedValue(validationError);

      const mockOnValidationError = jest.fn();
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          hooks: { onValidationError: mockOnValidationError },
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        try {
          await result.current.validateField('firstName');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(mockOnValidationError).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.any(Object),
          fieldName: 'firstName',
          error: validationError
        })
      );
    });
  });

  describe('Business Rules', () => {
    it('should execute business rules on field changes', async () => {
      const mockBusinessRuleResult = {
        ruleName: 'showSpouseField',
        triggered: true,
        action: BusinessRuleAction.SHOW_FIELD,
        message: 'Spouse field is now required'
      };

      mockValidationService.validateForm.mockResolvedValue({
        isValid: true,
        fieldResults: {},
        crossFieldErrors: [],
        businessRuleResults: [mockBusinessRuleResult],
        summary: {
          totalFields: 1,
          validFields: 1,
          fieldsWithErrors: 0,
          fieldsWithWarnings: 0,
          totalErrors: 0,
          totalWarnings: 0,
          completionPercentage: 100
        }
      });

      const mockOnBusinessRuleTriggered = jest.fn();

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          hooks: { onBusinessRuleTriggered: mockOnBusinessRuleTriggered },
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        result.current.setValue('maritalStatus', 'Married');
        await waitForAsync();
      });

      expect(mockOnBusinessRuleTriggered).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.any(Object),
          rule: mockBusinessRuleResult
        })
      );
    });

    it('should handle SET_VALUE business rule action', async () => {
      const mockBusinessRuleResult = {
        ruleName: 'autoSetValue',
        triggered: true,
        action: BusinessRuleAction.SET_VALUE,
        targetField: 'calculatedField',
        metadata: { value: 'auto-calculated' }
      };

      mockValidationService.validateForm.mockResolvedValue({
        isValid: true,
        fieldResults: {},
        crossFieldErrors: [],
        businessRuleResults: [mockBusinessRuleResult],
        summary: {
          totalFields: 1,
          validFields: 1,
          fieldsWithErrors: 0,
          fieldsWithWarnings: 0,
          totalErrors: 0,
          totalWarnings: 0,
          completionPercentage: 100
        }
      });

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        result.current.setValue('triggerField', 'trigger-value');
        await waitForAsync();
      });

      expect(result.current.getValue('calculatedField')).toBe('auto-calculated');
    });
  });

  describe('Form State Management', () => {
    it('should track form submission state', async () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      expect(result.current.formState.submitting).toBe(false);
      expect(result.current.formState.submitted).toBe(false);

      await act(async () => {
        const submitPromise = result.current.submitForm();
        expect(result.current.formState.submitting).toBe(true);
        await submitPromise;
      });

      expect(result.current.formState.submitting).toBe(false);
      expect(result.current.formState.submitted).toBe(true);
    });

    it('should reset form state', () => {
      const initialData = { firstName: 'John' };
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          initialData,
          onValidationEvent: mockOnValidationEvent
        })
      );

      act(() => {
        result.current.setValue('firstName', 'Jane');
        result.current.resetForm();
      });

      expect(result.current.formData).toEqual(initialData);
      expect(result.current.formState.dirty).toEqual({});
      expect(result.current.formState.touched).toEqual({});
      expect(result.current.formState.errors).toEqual({});
    });

    it('should reset form with new data', () => {
      const initialData = { firstName: 'John' };
      const newData = { firstName: 'Jane', email: 'jane@example.com' };
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          initialData,
          onValidationEvent: mockOnValidationEvent
        })
      );

      act(() => {
        result.current.resetForm(newData);
      });

      expect(result.current.formData).toEqual(newData);
      expect(result.current.formState.data).toEqual(newData);
    });

    it('should check if form can be submitted', () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      // Initially cannot submit (not validated)
      expect(result.current.canSubmit()).toBe(false);

      // Set form as valid
      act(() => {
        result.current.formState.valid = true;
      });

      expect(result.current.canSubmit()).toBe(true);

      // Set as submitting
      act(() => {
        result.current.formState.submitting = true;
      });

      expect(result.current.canSubmit()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should get field errors', async () => {
      mockValidationService.validateField.mockResolvedValue({
        fieldName: 'firstName',
        isValid: false,
        errors: [
          { message: 'First name is required', severity: 'ERROR', type: ValidationType.REQUIRED },
          { message: 'Too short', severity: 'ERROR', type: ValidationType.MIN_LENGTH }
        ],
        warnings: [],
        infos: []
      });

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        await result.current.validateField('firstName');
      });

      const errors = result.current.getFieldErrors('firstName');
      expect(errors).toEqual(['First name is required', 'Too short']);
    });

    it('should get field warnings', async () => {
      mockValidationService.validateField.mockResolvedValue({
        fieldName: 'firstName',
        isValid: true,
        errors: [],
        warnings: [
          { message: 'Consider using full name', severity: 'WARNING', type: ValidationType.CUSTOM }
        ],
        infos: []
      });

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        await result.current.validateField('firstName');
      });

      const warnings = result.current.getFieldWarnings('firstName');
      expect(warnings).toEqual(['Consider using full name']);
    });

    it('should check if field has errors', async () => {
      mockValidationService.validateField.mockResolvedValue({
        fieldName: 'firstName',
        isValid: false,
        errors: [{ message: 'Error', severity: 'ERROR', type: ValidationType.REQUIRED }],
        warnings: [],
        infos: []
      });

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      expect(result.current.hasFieldError('firstName')).toBe(false);

      await act(async () => {
        await result.current.validateField('firstName');
      });

      expect(result.current.hasFieldError('firstName')).toBe(true);
    });

    it('should clear validation errors', () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      // Set some errors
      act(() => {
        result.current.formState.errors.firstName = [
          { message: 'Error', severity: 'ERROR', type: ValidationType.REQUIRED }
        ];
      });

      expect(result.current.hasFieldError('firstName')).toBe(true);

      act(() => {
        result.current.clearValidation('firstName');
      });

      expect(result.current.hasFieldError('firstName')).toBe(false);
    });
  });

  describe('Validation Events', () => {
    it('should dispatch validation events', async () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        result.current.setValue('firstName', 'John');
      });

      expect(mockOnValidationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: ValidationEvent.FIELD_CHANGED,
          fieldName: 'firstName',
          formData: expect.objectContaining({ firstName: 'John' }),
          timestamp: expect.any(Date)
        })
      );
    });

    it('should dispatch form submission events', async () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        await result.current.submitForm();
      });

      expect(mockOnValidationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: ValidationEvent.FORM_SUBMITTED,
          formData: expect.any(Object),
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('Validation Hooks', () => {
    it('should call before and after validation hooks', async () => {
      const mockBeforeValidation = jest.fn();
      const mockAfterValidation = jest.fn();

      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          hooks: {
            beforeValidation: mockBeforeValidation,
            afterValidation: mockAfterValidation
          },
          onValidationEvent: mockOnValidationEvent
        })
      );

      await act(async () => {
        await result.current.validateField('firstName');
      });

      expect(mockBeforeValidation).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.any(Object),
          fieldName: 'firstName'
        })
      );

      expect(mockAfterValidation).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.any(Object),
          fieldName: 'firstName',
          validationResults: expect.any(Object)
        })
      );
    });
  });

  describe('Performance', () => {
    it('should handle rapid field changes efficiently', async () => {
      const { result } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      const start = Date.now();

      await act(async () => {
        for (let i = 0; i < 100; i++) {
          result.current.setValue('firstName', `Name ${i}`);
        }
        jest.advanceTimersByTime(300);
        await waitForAsync();
      });

      const duration = Date.now() - start;

      // Should complete efficiently
      expect(duration).toBeLessThan(1000);
      expect(result.current.getValue('firstName')).toBe('Name 99');
    });

    it('should cleanup timers on unmount', () => {
      const { unmount } = renderHook(() => 
        useFormValidation({
          schema: mockSchema,
          onValidationEvent: mockOnValidationEvent
        })
      );

      unmount();

      // Should not throw errors after unmount
      expect(() => jest.runAllTimers()).not.toThrow();
    });
  });
});