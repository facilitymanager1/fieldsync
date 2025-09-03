import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  ValidationRule,
  ValidationSeverity,
  ValidationType,
  FieldValidationResult,
} from '../types/validation';

interface ValidatedInputProps {
  // Basic input props
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  maxLength?: number;
  
  // Validation props
  validationRules?: ValidationRule[];
  validationResult?: FieldValidationResult;
  isValidating?: boolean;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  
  // Styling props
  style?: any;
  inputStyle?: any;
  labelStyle?: any;
  errorStyle?: any;
  containerStyle?: any;
  
  // Input type specific props
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  
  // Callback props
  onFocus?: () => void;
  onBlur?: () => void;
  onValidation?: (result: FieldValidationResult) => void;
  
  // UI enhancement props
  showValidationIcon?: boolean;
  showCharacterCount?: boolean;
  animateErrors?: boolean;
  helpText?: string;
  
  // Accessibility props
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
  value,
  onChangeText,
  placeholder,
  label,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  maxLength,
  validationRules = [],
  validationResult,
  isValidating = false,
  validateOnChange = true,
  validateOnBlur = true,
  debounceMs = 300,
  style,
  inputStyle,
  labelStyle,
  errorStyle,
  containerStyle,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'none',
  autoCorrect = false,
  onFocus,
  onBlur,
  onValidation,
  showValidationIcon = true,
  showCharacterCount = false,
  animateErrors = true,
  helpText,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localValidationResult, setLocalValidationResult] = useState<FieldValidationResult | null>(null);
  
  const validationResultToUse = validationResult || localValidationResult;
  const hasErrors = validationResultToUse?.errors.length > 0;
  const hasWarnings = validationResultToUse?.warnings.length > 0;
  const isValid = validationResultToUse?.isValid !== false && !hasErrors;

  // Animation values
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const borderColor = useRef(new Animated.Value(0)).current;
  const labelScale = useRef(new Animated.Value(value ? 1 : 0.8)).current;
  const labelY = useRef(new Animated.Value(value ? -20 : 10)).current;

  // Debounced validation timer
  const validationTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Animate label position based on focus and value
    const hasValueOrFocused = value || isFocused;
    
    Animated.parallel([
      Animated.timing(labelScale, {
        toValue: hasValueOrFocused ? 0.85 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(labelY, {
        toValue: hasValueOrFocused ? -20 : 10,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, isFocused, labelScale, labelY]);

  useEffect(() => {
    // Animate border color based on validation state
    let colorValue = 0; // Default (gray)
    if (isFocused) colorValue = 1; // Blue
    else if (hasErrors) colorValue = 2; // Red
    else if (hasWarnings) colorValue = 3; // Orange
    else if (isValid && value) colorValue = 4; // Green

    Animated.timing(borderColor, {
      toValue: colorValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, hasErrors, hasWarnings, isValid, value, borderColor]);

  useEffect(() => {
    // Animate error visibility
    if (animateErrors) {
      Animated.timing(errorOpacity, {
        toValue: hasErrors || hasWarnings ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [hasErrors, hasWarnings, animateErrors, errorOpacity]);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
    
    if (validateOnBlur) {
      performValidation(value);
    }
  };

  const handleChangeText = (text: string) => {
    onChangeText(text);
    
    if (validateOnChange) {
      // Clear existing timer
      if (validationTimer.current) {
        clearTimeout(validationTimer.current);
      }
      
      // Set new timer for debounced validation
      validationTimer.current = setTimeout(() => {
        performValidation(text);
      }, debounceMs);
    }
  };

  const performValidation = async (textValue: string) => {
    if (!validationRules.length) return;

    try {
      // This would integrate with your validation service
      // For now, we'll create a mock validation result
      const result: FieldValidationResult = {
        fieldName: accessibilityLabel || 'field',
        isValid: true,
        errors: [],
        warnings: [],
        infos: []
      };

      // Simple validation examples
      for (const rule of validationRules) {
        if (rule.type === ValidationType.REQUIRED && !textValue.trim()) {
          result.isValid = false;
          result.errors.push({
            message: rule.message,
            severity: ValidationSeverity.ERROR,
            type: rule.type
          });
        } else if (rule.type === ValidationType.EMAIL && textValue) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(textValue)) {
            result.isValid = false;
            result.errors.push({
              message: rule.message,
              severity: ValidationSeverity.ERROR,
              type: rule.type
            });
          }
        } else if (rule.type === ValidationType.MIN_LENGTH && textValue) {
          const minLength = rule.params?.min || 0;
          if (textValue.length < minLength) {
            result.isValid = false;
            result.errors.push({
              message: rule.message.replace('{min}', minLength.toString()),
              severity: ValidationSeverity.ERROR,
              type: rule.type
            });
          }
        }
      }

      setLocalValidationResult(result);
      onValidation?.(result);
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getBorderColorValue = () => {
    return borderColor.interpolate({
      inputRange: [0, 1, 2, 3, 4],
      outputRange: [
        '#e0e0e0', // Default
        '#2196F3', // Focused
        '#F44336', // Error
        '#FF9800', // Warning
        '#4CAF50', // Valid
      ],
    });
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <ActivityIndicator size="small" color="#2196F3" />;
    }
    
    if (hasErrors) {
      return <Icon name="error" size={20} color="#F44336" />;
    }
    
    if (hasWarnings) {
      return <Icon name="warning" size={20} color="#FF9800" />;
    }
    
    if (isValid && value) {
      return <Icon name="check-circle" size={20} color="#4CAF50" />;
    }
    
    return null;
  };

  const renderErrors = () => {
    if (!validationResultToUse || (!hasErrors && !hasWarnings)) {
      return null;
    }

    const allMessages = [
      ...(validationResultToUse.errors || []),
      ...(validationResultToUse.warnings || [])
    ];

    if (animateErrors) {
      return (
        <Animated.View style={[styles.errorContainer, { opacity: errorOpacity }]}>
          {allMessages.map((error, index) => (
            <View key={index} style={styles.errorRow}>
              <Icon
                name={error.severity === ValidationSeverity.WARNING ? 'warning' : 'error'}
                size={16}
                color={error.severity === ValidationSeverity.WARNING ? '#FF9800' : '#F44336'}
              />
              <Text
                style={[
                  styles.errorText,
                  error.severity === ValidationSeverity.WARNING ? styles.warningText : styles.errorTextColor,
                  errorStyle
                ]}
              >
                {error.message}
              </Text>
            </View>
          ))}
        </Animated.View>
      );
    }

    return (
      <View style={styles.errorContainer}>
        {allMessages.map((error, index) => (
          <View key={index} style={styles.errorRow}>
            <Icon
              name={error.severity === ValidationSeverity.WARNING ? 'warning' : 'error'}
              size={16}
              color={error.severity === ValidationSeverity.WARNING ? '#FF9800' : '#F44336'}
            />
            <Text
              style={[
                styles.errorText,
                error.severity === ValidationSeverity.WARNING ? styles.warningText : styles.errorTextColor,
                errorStyle
              ]}
            >
              {error.message}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderCharacterCount = () => {
    if (!showCharacterCount) return null;
    
    const count = value.length;
    const isNearLimit = maxLength && count > maxLength * 0.8;
    const isOverLimit = maxLength && count > maxLength;
    
    return (
      <Text
        style={[
          styles.characterCount,
          isOverLimit ? styles.characterCountOver : isNearLimit ? styles.characterCountNear : null
        ]}
      >
        {count}{maxLength ? `/${maxLength}` : ''}
      </Text>
    );
  };

  const renderHelpText = () => {
    if (!helpText) return null;
    
    return (
      <Text style={styles.helpText}>{helpText}</Text>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputContainer}>
        {label && (
          <Animated.Text
            style={[
              styles.label,
              {
                transform: [
                  { scale: labelScale },
                  { translateY: labelY }
                ]
              },
              labelStyle
            ]}
          >
            {label}
          </Animated.Text>
        )}
        
        <Animated.View
          style={[
            styles.inputWrapper,
            { borderColor: getBorderColorValue() },
            style
          ]}
        >
          <TextInput
            style={[
              styles.input,
              multiline && styles.multilineInput,
              inputStyle
            ]}
            value={value}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={!isFocused && !label ? placeholder : undefined}
            placeholderTextColor="#999"
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : 1}
            editable={editable}
            maxLength={maxLength}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry && !showPassword}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
          />
          
          {secureTextEntry && (
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={togglePasswordVisibility}
            >
              <Icon
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          )}
          
          {showValidationIcon && (
            <View style={styles.validationIcon}>
              {getValidationIcon()}
            </View>
          )}
        </Animated.View>
        
        <View style={styles.bottomRow}>
          {renderCharacterCount()}
        </View>
      </View>
      
      {renderErrors()}
      {renderHelpText()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    position: 'relative',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'white',
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  label: {
    position: 'absolute',
    left: 12,
    fontSize: 16,
    color: '#666',
    backgroundColor: 'white',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  passwordToggle: {
    padding: 4,
    marginLeft: 8,
  },
  validationIcon: {
    marginLeft: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
  },
  characterCountNear: {
    color: '#FF9800',
  },
  characterCountOver: {
    color: '#F44336',
  },
  errorContainer: {
    marginTop: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  errorTextColor: {
    color: '#F44336',
  },
  warningText: {
    color: '#FF9800',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 16,
  },
});

export default ValidatedInput;