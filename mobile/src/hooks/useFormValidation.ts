import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FormValidationSchema,
  FormValidationResults,
  FieldValidationResult,
  ValidationConfig,
  FormState,
  ValidationEvent,
  ValidationEventPayload,
  ValidationHooks,
  BusinessRuleResult,
  BusinessRuleAction
} from '../types/validation';
import ValidationService from '../services/validationService';

interface UseFormValidationOptions {
  schema: FormValidationSchema;
  initialData?: Record<string, any>;
  config?: Partial<ValidationConfig>;
  hooks?: ValidationHooks;
  onValidationEvent?: (payload: ValidationEventPayload) => void;
}

interface UseFormValidationReturn {
  // Form state
  formData: Record<string, any>;
  formState: FormState;
  
  // Field operations
  setValue: (fieldName: string, value: any) => void;
  setValues: (values: Record<string, any>) => void;
  getValue: (fieldName: string) => any;
  
  // Validation operations
  validateField: (fieldName: string) => Promise<FieldValidationResult>;
  validateForm: () => Promise<FormValidationResults>;
  clearValidation: (fieldName?: string) => void;
  
  // Form operations
  resetForm: (newData?: Record<string, any>) => void;
  submitForm: () => Promise<FormValidationResults>;
  isDirty: (fieldName?: string) => boolean;
  isTouched: (fieldName?: string) => boolean;
  isValidating: (fieldName?: string) => boolean;
  
  // Error handling
  getFieldErrors: (fieldName: string) => string[];
  getFieldWarnings: (fieldName: string) => string[];
  hasFieldError: (fieldName: string) => boolean;
  
  // Utility functions
  getCompletionPercentage: () => number;
  getValidationSummary: () => any;
  canSubmit: () => boolean;
}

export const useFormValidation = (options: UseFormValidationOptions): UseFormValidationReturn => {
  const {
    schema,
    initialData = {},
    config = {},
    hooks = {},
    onValidationEvent
  } = options;

  // Configure validation service
  useEffect(() => {
    ValidationService.setConfig(config);
  }, [config]);

  // State management
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [formState, setFormState] = useState<FormState>({
    data: initialData,
    errors: {},
    warnings: {},
    touched: {},
    dirty: {},
    validating: {},
    valid: false,
    submitting: false,
    submitted: false
  });

  const lastValidationResults = useRef<FormValidationResults | null>(null);
  const validationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Event dispatcher
  const dispatchValidationEvent = useCallback((event: ValidationEvent, payload: Partial<ValidationEventPayload> = {}) => {
    const eventPayload: ValidationEventPayload = {
      event,
      formData,
      timestamp: new Date(),
      ...payload
    };

    if (onValidationEvent) {
      onValidationEvent(eventPayload);
    }
  }, [formData, onValidationEvent]);

  // Set single field value
  const setValue = useCallback(async (fieldName: string, value: any) => {
    const previousValue = formData[fieldName];
    const newFormData = { ...formData, [fieldName]: value };
    
    setFormData(newFormData);
    setFormState(prev => ({
      ...prev,
      data: newFormData,
      dirty: { ...prev.dirty, [fieldName]: value !== initialData[fieldName] },
      touched: { ...prev.touched, [fieldName]: true }
    }));

    dispatchValidationEvent(ValidationEvent.FIELD_CHANGED, {
      fieldName,
      formData: newFormData
    });

    // Call before validation hook
    if (hooks.beforeValidation) {
      await hooks.beforeValidation({
        formData: newFormData,
        fieldName,
        value
      });
    }

    // Validate on change if configured
    const fieldConfig = schema.fields.find(f => f.fieldName === fieldName);
    if (fieldConfig?.validateOnChange !== false) {
      await validateFieldWithDebounce(fieldName, value, newFormData);
    }

    // Apply business rules
    if (schema.businessRules) {
      const triggeredRules = schema.businessRules
        .map(rule => ValidationService['applyBusinessRule'](newFormData, rule))
        .filter(result => result.triggered);

      for (const ruleResult of triggeredRules) {
        await handleBusinessRule(ruleResult, newFormData);
      }
    }
  }, [formData, initialData, schema, hooks, dispatchValidationEvent]);

  // Set multiple field values
  const setValues = useCallback((values: Record<string, any>) => {
    const newFormData = { ...formData, ...values };
    const newDirty: Record<string, boolean> = {};
    const newTouched: Record<string, boolean> = {};

    Object.keys(values).forEach(fieldName => {
      newDirty[fieldName] = values[fieldName] !== initialData[fieldName];
      newTouched[fieldName] = true;
    });

    setFormData(newFormData);
    setFormState(prev => ({
      ...prev,
      data: newFormData,
      dirty: { ...prev.dirty, ...newDirty },
      touched: { ...prev.touched, ...newTouched }
    }));
  }, [formData, initialData]);

  // Get field value
  const getValue = useCallback((fieldName: string) => {
    return formData[fieldName];
  }, [formData]);

  // Validate single field with debounce
  const validateFieldWithDebounce = useCallback(async (
    fieldName: string,
    value: any,
    currentFormData: Record<string, any>
  ) => {
    const fieldConfig = schema.fields.find(f => f.fieldName === fieldName);
    const debounceMs = fieldConfig?.debounceMs || 300;

    // Clear existing timeout
    const existingTimeout = validationTimeouts.current.get(fieldName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set validating state
    setFormState(prev => ({
      ...prev,
      validating: { ...prev.validating, [fieldName]: true }
    }));

    return new Promise<FieldValidationResult>((resolve) => {
      const timeout = setTimeout(async () => {
        try {
          const result = await validateField(fieldName);
          validationTimeouts.current.delete(fieldName);
          resolve(result);
        } catch (error) {
          console.error('Field validation error:', error);
          validationTimeouts.current.delete(fieldName);
          resolve({
            fieldName,
            isValid: false,
            errors: [{
              message: 'Validation error occurred',
              severity: 'ERROR' as any,
              type: 'CUSTOM' as any
            }],
            warnings: [],
            infos: []
          });
        }
      }, debounceMs);

      validationTimeouts.current.set(fieldName, timeout);
    });
  }, [schema]);

  // Validate single field
  const validateField = useCallback(async (fieldName: string): Promise<FieldValidationResult> => {
    const fieldConfig = schema.fields.find(f => f.fieldName === fieldName);
    if (!fieldConfig) {
      return {
        fieldName,
        isValid: true,
        errors: [],
        warnings: [],
        infos: []
      };
    }

    dispatchValidationEvent(ValidationEvent.VALIDATION_STARTED, { fieldName });

    try {
      const result = await ValidationService.validateField(
        fieldName,
        formData[fieldName],
        formData,
        fieldConfig.rules,
        schema
      );

      // Update form state with validation results
      setFormState(prev => ({
        ...prev,
        errors: { ...prev.errors, [fieldName]: result.errors },
        warnings: { ...prev.warnings, [fieldName]: result.warnings },
        validating: { ...prev.validating, [fieldName]: false }
      }));

      dispatchValidationEvent(ValidationEvent.VALIDATION_COMPLETED, {
        fieldName,
        validationResults: { ...lastValidationResults.current, fieldResults: { [fieldName]: result } } as any
      });

      // Call after validation hook
      if (hooks.afterValidation) {
        await hooks.afterValidation({
          formData,
          fieldName,
          value: formData[fieldName],
          validationResults: { fieldResults: { [fieldName]: result } } as any
        });
      }

      return result;
    } catch (error) {
      console.error('Validation error:', error);
      
      if (hooks.onValidationError) {
        hooks.onValidationError({
          formData,
          fieldName,
          value: formData[fieldName],
          error: error as Error
        });
      }

      throw error;
    }
  }, [formData, schema, hooks, dispatchValidationEvent]);

  // Validate entire form
  const validateForm = useCallback(async (): Promise<FormValidationResults> => {
    dispatchValidationEvent(ValidationEvent.VALIDATION_STARTED);

    try {
      // Call before validation hook
      if (hooks.beforeValidation) {
        await hooks.beforeValidation({ formData });
      }

      const results = await ValidationService.validateForm(formData, schema);
      lastValidationResults.current = results;

      // Update form state
      const errors: Record<string, any> = {};
      const warnings: Record<string, any> = {};
      const validating: Record<string, boolean> = {};

      Object.entries(results.fieldResults).forEach(([fieldName, fieldResult]) => {
        errors[fieldName] = fieldResult.errors;
        warnings[fieldName] = fieldResult.warnings;
        validating[fieldName] = false;
      });

      setFormState(prev => ({
        ...prev,
        errors,
        warnings,
        validating,
        valid: results.isValid
      }));

      dispatchValidationEvent(ValidationEvent.VALIDATION_COMPLETED, {
        validationResults: results
      });

      // Handle business rules
      for (const ruleResult of results.businessRuleResults) {
        if (ruleResult.triggered) {
          await handleBusinessRule(ruleResult, formData);
        }
      }

      // Call after validation hook
      if (hooks.afterValidation) {
        await hooks.afterValidation({
          formData,
          validationResults: results
        });
      }

      return results;
    } catch (error) {
      console.error('Form validation error:', error);
      
      if (hooks.onValidationError) {
        hooks.onValidationError({
          formData,
          error: error as Error
        });
      }

      throw error;
    }
  }, [formData, schema, hooks, dispatchValidationEvent]);

  // Handle business rule execution
  const handleBusinessRule = useCallback(async (
    ruleResult: BusinessRuleResult,
    currentFormData: Record<string, any>
  ) => {
    dispatchValidationEvent(ValidationEvent.BUSINESS_RULE_TRIGGERED);

    if (hooks.onBusinessRuleTriggered) {
      hooks.onBusinessRuleTriggered({
        formData: currentFormData,
        rule: ruleResult
      });
    }

    switch (ruleResult.action) {
      case BusinessRuleAction.SET_VALUE:
        if (ruleResult.targetField && ruleResult.metadata?.value !== undefined) {
          setValue(ruleResult.targetField, ruleResult.metadata.value);
        }
        break;
      
      case BusinessRuleAction.CLEAR_VALUE:
        if (ruleResult.targetField) {
          setValue(ruleResult.targetField, '');
        }
        break;
      
      case BusinessRuleAction.TRIGGER_VALIDATION:
        if (ruleResult.targetField) {
          await validateField(ruleResult.targetField);
        } else {
          await validateForm();
        }
        break;
    }
  }, [setValue, validateField, validateForm, hooks, dispatchValidationEvent]);

  // Clear validation errors
  const clearValidation = useCallback((fieldName?: string) => {
    if (fieldName) {
      setFormState(prev => ({
        ...prev,
        errors: { ...prev.errors, [fieldName]: [] },
        warnings: { ...prev.warnings, [fieldName]: [] }
      }));
    } else {
      setFormState(prev => ({
        ...prev,
        errors: {},
        warnings: {}
      }));
    }
  }, []);

  // Reset form
  const resetForm = useCallback((newData?: Record<string, any>) => {
    const resetData = newData || initialData;
    setFormData(resetData);
    setFormState({
      data: resetData,
      errors: {},
      warnings: {},
      touched: {},
      dirty: {},
      validating: {},
      valid: false,
      submitting: false,
      submitted: false
    });
    
    // Clear validation timers
    validationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    validationTimeouts.current.clear();
  }, [initialData]);

  // Submit form
  const submitForm = useCallback(async (): Promise<FormValidationResults> => {
    setFormState(prev => ({ ...prev, submitting: true }));
    dispatchValidationEvent(ValidationEvent.FORM_SUBMITTED);

    try {
      const results = await validateForm();
      
      setFormState(prev => ({
        ...prev,
        submitting: false,
        submitted: true
      }));

      return results;
    } catch (error) {
      setFormState(prev => ({ ...prev, submitting: false }));
      throw error;
    }
  }, [validateForm, dispatchValidationEvent]);

  // Utility functions
  const isDirty = useCallback((fieldName?: string) => {
    if (fieldName) {
      return formState.dirty[fieldName] || false;
    }
    return Object.values(formState.dirty).some(dirty => dirty);
  }, [formState.dirty]);

  const isTouched = useCallback((fieldName?: string) => {
    if (fieldName) {
      return formState.touched[fieldName] || false;
    }
    return Object.values(formState.touched).some(touched => touched);
  }, [formState.touched]);

  const isValidating = useCallback((fieldName?: string) => {
    if (fieldName) {
      return formState.validating[fieldName] || false;
    }
    return Object.values(formState.validating).some(validating => validating);
  }, [formState.validating]);

  const getFieldErrors = useCallback((fieldName: string): string[] => {
    return formState.errors[fieldName]?.map((error: any) => error.message) || [];
  }, [formState.errors]);

  const getFieldWarnings = useCallback((fieldName: string): string[] => {
    return formState.warnings[fieldName]?.map((warning: any) => warning.message) || [];
  }, [formState.warnings]);

  const hasFieldError = useCallback((fieldName: string): boolean => {
    return (formState.errors[fieldName]?.length || 0) > 0;
  }, [formState.errors]);

  const getCompletionPercentage = useCallback((): number => {
    if (!lastValidationResults.current) return 0;
    return lastValidationResults.current.summary.completionPercentage;
  }, []);

  const getValidationSummary = useCallback(() => {
    return lastValidationResults.current?.summary || null;
  }, []);

  const canSubmit = useCallback((): boolean => {
    return formState.valid && !formState.submitting && !isValidating();
  }, [formState.valid, formState.submitting, isValidating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      validationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      validationTimeouts.current.clear();
    };
  }, []);

  return {
    // Form state
    formData,
    formState,
    
    // Field operations
    setValue,
    setValues,
    getValue,
    
    // Validation operations
    validateField,
    validateForm,
    clearValidation,
    
    // Form operations
    resetForm,
    submitForm,
    isDirty,
    isTouched,
    isValidating,
    
    // Error handling
    getFieldErrors,
    getFieldWarnings,
    hasFieldError,
    
    // Utility functions
    getCompletionPercentage,
    getValidationSummary,
    canSubmit
  };
};

export default useFormValidation;