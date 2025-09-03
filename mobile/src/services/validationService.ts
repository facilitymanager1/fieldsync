import {
  ValidationRule,
  ValidationResult,
  FormValidationSchema,
  FormValidationResults,
  FieldValidationResult,
  ValidationError,
  ValidationSeverity,
  ValidationType,
  CrossFieldRule,
  BusinessRule,
  BusinessRuleResult,
  BusinessRuleAction,
  ValidationConfig,
  DEFAULT_VALIDATION_CONFIG,
  VALIDATION_PATTERNS,
  VALIDATION_MESSAGES,
  AsyncValidationContext,
  CustomValidationContext
} from '../types/validation';

class ValidationService {
  private config: ValidationConfig = DEFAULT_VALIDATION_CONFIG;
  private asyncValidationCache = new Map<string, ValidationResult>();
  private validationTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Set validation configuration
   */
  setConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate entire form based on schema
   */
  async validateForm(
    formData: Record<string, any>,
    schema: FormValidationSchema
  ): Promise<FormValidationResults> {
    const fieldResults: Record<string, FieldValidationResult> = {};
    const crossFieldErrors: ValidationError[] = [];
    const businessRuleResults: BusinessRuleResult[] = [];

    // Validate individual fields
    for (const fieldConfig of schema.fields) {
      const fieldResult = await this.validateField(
        fieldConfig.fieldName,
        formData[fieldConfig.fieldName],
        formData,
        fieldConfig.rules,
        schema
      );
      fieldResults[fieldConfig.fieldName] = fieldResult;
    }

    // Validate cross-field rules
    if (this.config.enableCrossFieldValidation && schema.crossFieldRules) {
      for (const rule of schema.crossFieldRules) {
        const result = this.validateCrossField(formData, rule);
        if (!result.isValid) {
          crossFieldErrors.push({
            message: result.message || rule.message,
            severity: result.severity || rule.severity || ValidationSeverity.ERROR,
            type: ValidationType.CROSS_FIELD,
            code: rule.name
          });
        }
      }
    }

    // Apply business rules
    if (this.config.enableBusinessRules && schema.businessRules) {
      for (const rule of schema.businessRules) {
        const ruleResult = this.applyBusinessRule(formData, rule);
        businessRuleResults.push(ruleResult);
      }
    }

    // Calculate summary
    const summary = this.calculateValidationSummary(fieldResults, crossFieldErrors);
    const isValid = summary.fieldsWithErrors === 0 && crossFieldErrors.length === 0;

    const results: FormValidationResults = {
      isValid,
      fieldResults,
      crossFieldErrors,
      businessRuleResults,
      summary
    };

    // Trigger completion callback
    if (schema.onValidationComplete) {
      schema.onValidationComplete(results);
    }

    return results;
  }

  /**
   * Validate single field
   */
  async validateField(
    fieldName: string,
    value: any,
    formData: Record<string, any>,
    rules: ValidationRule[],
    schema?: FormValidationSchema
  ): Promise<FieldValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const infos: ValidationError[] = [];

    for (const rule of rules) {
      // Check if rule condition is met
      if (rule.condition && !rule.condition(formData)) {
        continue;
      }

      let result: ValidationResult;

      // Handle different validation types
      switch (rule.type) {
        case ValidationType.REQUIRED:
          result = this.validateRequired(value);
          break;
        case ValidationType.EMAIL:
          result = this.validateEmail(value);
          break;
        case ValidationType.PHONE:
          result = this.validatePhone(value);
          break;
        case ValidationType.AADHAAR:
          result = this.validateAadhaar(value);
          break;
        case ValidationType.PAN:
          result = this.validatePAN(value);
          break;
        case ValidationType.IFSC:
          result = this.validateIFSC(value);
          break;
        case ValidationType.DATE:
          result = this.validateDate(value, rule.params);
          break;
        case ValidationType.DATE_RANGE:
          result = this.validateDateRange(value, rule.params);
          break;
        case ValidationType.MIN_LENGTH:
          result = this.validateMinLength(value, rule.params.min);
          break;
        case ValidationType.MAX_LENGTH:
          result = this.validateMaxLength(value, rule.params.max);
          break;
        case ValidationType.REGEX:
          result = this.validateRegex(value, rule.params.pattern);
          break;
        case ValidationType.NUMERIC:
          result = this.validateNumeric(value);
          break;
        case ValidationType.RANGE:
          result = this.validateRange(value, rule.params.min, rule.params.max);
          break;
        case ValidationType.FILE:
          result = this.validateFile(value, rule.params);
          break;
        case ValidationType.CUSTOM:
          result = await this.validateCustom(value, formData, rule.params.validator);
          break;
        case ValidationType.ASYNC:
          if (this.config.enableAsyncValidation && rule.asyncValidator) {
            result = await this.validateAsync(fieldName, value, formData, rule.asyncValidator);
          } else {
            continue;
          }
          break;
        case ValidationType.CROSS_FIELD:
          if (rule.crossFieldValidator) {
            result = rule.crossFieldValidator(value, formData, fieldName);
          } else {
            continue;
          }
          break;
        default:
          continue;
      }

      // Process validation result
      if (!result.isValid) {
        const error: ValidationError = {
          message: result.message || rule.message,
          severity: result.severity || rule.severity || ValidationSeverity.ERROR,
          type: rule.type,
          code: result.code,
          metadata: result.metadata
        };

        switch (error.severity) {
          case ValidationSeverity.ERROR:
            errors.push(error);
            break;
          case ValidationSeverity.WARNING:
            warnings.push(error);
            break;
          case ValidationSeverity.INFO:
            infos.push(error);
            break;
        }

        // Stop on first error if configured
        if (this.config.stopOnFirstError && error.severity === ValidationSeverity.ERROR) {
          break;
        }
      }
    }

    return {
      fieldName,
      isValid: errors.length === 0,
      errors,
      warnings,
      infos
    };
  }

  /**
   * Validate with debounce
   */
  validateWithDebounce(
    fieldName: string,
    value: any,
    formData: Record<string, any>,
    rules: ValidationRule[],
    callback: (result: FieldValidationResult) => void,
    debounceMs: number = this.config.debounceMs
  ): void {
    // Clear existing timer
    const existingTimer = this.validationTimers.get(fieldName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      const result = await this.validateField(fieldName, value, formData, rules);
      callback(result);
      this.validationTimers.delete(fieldName);
    }, debounceMs);

    this.validationTimers.set(fieldName, timer);
  }

  /**
   * Individual validation methods
   */
  private validateRequired(value: any): ValidationResult {
    const isEmpty = value === null || value === undefined || 
                    (typeof value === 'string' && value.trim() === '') ||
                    (Array.isArray(value) && value.length === 0);
    
    return {
      isValid: !isEmpty,
      message: isEmpty ? VALIDATION_MESSAGES.REQUIRED : undefined
    };
  }

  private validateEmail(value: any): ValidationResult {
    if (!value) return { isValid: true }; // Optional field
    
    const isValid = VALIDATION_PATTERNS.EMAIL.test(value);
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.EMAIL
    };
  }

  private validatePhone(value: any): ValidationResult {
    if (!value) return { isValid: true };
    
    const cleanValue = value.toString().replace(/\D/g, '');
    const isValid = VALIDATION_PATTERNS.PHONE_INDIAN.test(cleanValue);
    
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.PHONE
    };
  }

  private validateAadhaar(value: any): ValidationResult {
    if (!value) return { isValid: true };
    
    const cleanValue = value.toString().replace(/\s/g, '');
    const isValid = VALIDATION_PATTERNS.AADHAAR.test(cleanValue) && 
                    this.verifyAadhaarChecksum(cleanValue);
    
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.AADHAAR,
      metadata: { maskedValue: this.maskAadhaar(cleanValue) }
    };
  }

  private validatePAN(value: any): ValidationResult {
    if (!value) return { isValid: true };
    
    const cleanValue = value.toString().toUpperCase();
    const isValid = VALIDATION_PATTERNS.PAN.test(cleanValue);
    
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.PAN,
      metadata: { maskedValue: this.maskPAN(cleanValue) }
    };
  }

  private validateIFSC(value: any): ValidationResult {
    if (!value) return { isValid: true };
    
    const cleanValue = value.toString().toUpperCase();
    const isValid = VALIDATION_PATTERNS.IFSC.test(cleanValue);
    
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.IFSC
    };
  }

  private validateDate(value: any, params?: any): ValidationResult {
    if (!value) return { isValid: true };
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { isValid: false, message: 'Please enter a valid date' };
    }

    const now = new Date();
    
    if (params?.noFuture && date > now) {
      return { isValid: false, message: VALIDATION_MESSAGES.DATE_FUTURE };
    }
    
    if (params?.noPast && date < now) {
      return { isValid: false, message: VALIDATION_MESSAGES.DATE_PAST };
    }

    return { isValid: true };
  }

  private validateDateRange(value: any, params: { min?: Date; max?: Date }): ValidationResult {
    if (!value) return { isValid: true };
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { isValid: false, message: 'Please enter a valid date' };
    }

    if (params.min && date < params.min) {
      return { 
        isValid: false, 
        message: VALIDATION_MESSAGES.DATE_RANGE.replace('{min}', params.min.toLocaleDateString())
      };
    }

    if (params.max && date > params.max) {
      return { 
        isValid: false, 
        message: VALIDATION_MESSAGES.DATE_RANGE.replace('{max}', params.max.toLocaleDateString())
      };
    }

    return { isValid: true };
  }

  private validateMinLength(value: any, min: number): ValidationResult {
    if (!value) return { isValid: true };
    
    const length = value.toString().length;
    const isValid = length >= min;
    
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.MIN_LENGTH.replace('{min}', min.toString())
    };
  }

  private validateMaxLength(value: any, max: number): ValidationResult {
    if (!value) return { isValid: true };
    
    const length = value.toString().length;
    const isValid = length <= max;
    
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.MAX_LENGTH.replace('{max}', max.toString())
    };
  }

  private validateRegex(value: any, pattern: RegExp): ValidationResult {
    if (!value) return { isValid: true };
    
    const isValid = pattern.test(value.toString());
    return {
      isValid,
      message: isValid ? undefined : 'Please enter a valid value'
    };
  }

  private validateNumeric(value: any): ValidationResult {
    if (!value && value !== 0) return { isValid: true };
    
    const isValid = !isNaN(Number(value)) && isFinite(Number(value));
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.NUMERIC
    };
  }

  private validateRange(value: any, min: number, max: number): ValidationResult {
    if (!value && value !== 0) return { isValid: true };
    
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return { isValid: false, message: VALIDATION_MESSAGES.NUMERIC };
    }
    
    const isValid = numValue >= min && numValue <= max;
    return {
      isValid,
      message: isValid ? undefined : VALIDATION_MESSAGES.RANGE
        .replace('{min}', min.toString())
        .replace('{max}', max.toString())
    };
  }

  private validateFile(value: any, params: any): ValidationResult {
    if (!value) return { isValid: true };
    
    const { maxSize, allowedTypes } = params;
    
    // Check file size (in MB)
    if (maxSize && value.size > maxSize * 1024 * 1024) {
      return {
        isValid: false,
        message: VALIDATION_MESSAGES.FILE_SIZE.replace('{maxSize}', maxSize.toString())
      };
    }
    
    // Check file type
    if (allowedTypes && !allowedTypes.includes(value.type)) {
      return {
        isValid: false,
        message: VALIDATION_MESSAGES.FILE_TYPE.replace('{allowedTypes}', allowedTypes.join(', '))
      };
    }
    
    return { isValid: true };
  }

  private async validateCustom(
    value: any,
    formData: Record<string, any>,
    validator: (context: CustomValidationContext) => ValidationResult | Promise<ValidationResult>
  ): Promise<ValidationResult> {
    const context: CustomValidationContext = {
      fieldName: '',
      value,
      formData,
      schema: {} as any
    };
    
    return await validator(context);
  }

  private async validateAsync(
    fieldName: string,
    value: any,
    formData: Record<string, any>,
    validator: (context: AsyncValidationContext) => Promise<ValidationResult>
  ): Promise<ValidationResult> {
    // Check cache first
    const cacheKey = `${fieldName}_${JSON.stringify(value)}`;
    if (this.asyncValidationCache.has(cacheKey)) {
      return this.asyncValidationCache.get(cacheKey)!;
    }

    const controller = new AbortController();
    const context: AsyncValidationContext = {
      fieldName,
      value,
      formData,
      signal: controller.signal
    };

    try {
      const result = await validator(context);
      
      // Cache result for 5 minutes
      this.asyncValidationCache.set(cacheKey, result);
      setTimeout(() => {
        this.asyncValidationCache.delete(cacheKey);
      }, 5 * 60 * 1000);
      
      return result;
    } catch (error) {
      return {
        isValid: false,
        message: 'Validation failed',
        code: 'ASYNC_ERROR'
      };
    }
  }

  /**
   * Cross-field validation
   */
  private validateCrossField(
    formData: Record<string, any>,
    rule: CrossFieldRule
  ): ValidationResult {
    const values: Record<string, any> = {};
    rule.fields.forEach(fieldName => {
      values[fieldName] = formData[fieldName];
    });
    
    return rule.validator(values);
  }

  /**
   * Apply business rule
   */
  private applyBusinessRule(
    formData: Record<string, any>,
    rule: BusinessRule
  ): BusinessRuleResult {
    const triggered = rule.condition(formData);
    
    return {
      ruleName: rule.name,
      triggered,
      action: rule.action,
      message: rule.message
    };
  }

  /**
   * Calculate validation summary
   */
  private calculateValidationSummary(
    fieldResults: Record<string, FieldValidationResult>,
    crossFieldErrors: ValidationError[]
  ) {
    const totalFields = Object.keys(fieldResults).length;
    const validFields = Object.values(fieldResults).filter(r => r.isValid).length;
    const fieldsWithErrors = Object.values(fieldResults).filter(r => r.errors.length > 0).length;
    const fieldsWithWarnings = Object.values(fieldResults).filter(r => r.warnings.length > 0).length;
    const totalErrors = Object.values(fieldResults)
      .reduce((sum, r) => sum + r.errors.length, 0) + crossFieldErrors.length;
    const totalWarnings = Object.values(fieldResults)
      .reduce((sum, r) => sum + r.warnings.length, 0);
    
    return {
      totalFields,
      validFields,
      fieldsWithErrors,
      fieldsWithWarnings,
      totalErrors,
      totalWarnings,
      completionPercentage: totalFields > 0 ? (validFields / totalFields) * 100 : 0
    };
  }

  /**
   * Utility methods
   */
  private verifyAadhaarChecksum(aadhaar: string): boolean {
    // Verhoeff algorithm for Aadhaar validation
    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];

    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];

    let c = 0;
    const myArray = aadhaar.split('').reverse();
    
    for (let i = 0; i < myArray.length; i++) {
      c = d[c][p[((i + 1) % 8)][parseInt(myArray[i])]];
    }
    
    return c === 0;
  }

  private maskAadhaar(aadhaar: string): string {
    return aadhaar.replace(/(\d{4})(\d{4})(\d{4})/, '$1-****-$3');
  }

  private maskPAN(pan: string): string {
    return pan.replace(/(.{3})(.{4})(.)/, '$1***$3');
  }

  /**
   * Format message with parameters
   */
  formatMessage(template: string, params: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key].toString() : match;
    });
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.asyncValidationCache.clear();
    this.validationTimers.forEach(timer => clearTimeout(timer));
    this.validationTimers.clear();
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      cacheSize: this.asyncValidationCache.size,
      pendingValidations: this.validationTimers.size,
      config: this.config
    };
  }
}

export default new ValidationService();