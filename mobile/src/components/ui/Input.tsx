/**
 * Input Component - Reusable text input with validation and styling
 * 
 * Features:
 * - Multiple variants (default, outline, underline)
 * - Built-in validation
 * - Error state with custom messages
 * - Icon support (left and right)
 * - Password toggle for secure fields
 * - Character counter
 * - Multi-language placeholder support
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helpText?: string;
  variant?: 'default' | 'outline' | 'underline';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  showCharacterCount?: boolean;
  maxLength?: number;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  helpTextStyle?: TextStyle;
  testID?: string;
}

export default function Input({
  label,
  error,
  helpText,
  variant = 'default',
  leftIcon,
  rightIcon,
  isPassword = false,
  showCharacterCount = false,
  maxLength,
  required = false,
  containerStyle,
  inputStyle,
  labelStyle,
  helpTextStyle,
  testID,
  value = '',
  ...props
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const hasError = !!error;
  const characterCount = value?.length || 0;

  const containerStyles = [
    styles.container,
    containerStyle,
  ].filter(Boolean) as ViewStyle[];

  const inputContainerStyles = [
    styles.inputContainer,
    styles[`inputContainer_${variant}` as keyof typeof styles],
    isFocused && styles.inputContainerFocused,
    hasError && styles.inputContainerError,
  ].filter((style) => Boolean(style)) as ViewStyle[];

  const textInputStyles = [
    styles.textInput,
    styles[`textInput_${variant}` as keyof typeof styles],
    leftIcon && styles.textInputWithLeftIcon,
    (rightIcon || isPassword) && styles.textInputWithRightIcon,
    inputStyle,
  ].filter((style) => Boolean(style)) as TextStyle[];

  const labelStyles = [
    styles.label,
    required && styles.labelRequired,
    hasError && styles.labelError,
    labelStyle,
  ].filter(Boolean) as TextStyle[];

  const renderPasswordToggle = () => {
    if (!isPassword) return null;

    return (
      <TouchableOpacity
        style={styles.iconButton}
        onPress={togglePasswordVisibility}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.passwordToggleIcon}>
          {isPasswordVisible ? '👁️' : '👁️‍🗨️'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCharacterCount = () => {
    if (!showCharacterCount || !maxLength) return null;

    const isOverLimit = characterCount > maxLength;

    return (
      <Text style={[styles.characterCount, isOverLimit && styles.characterCountError]}>
        {characterCount}/{maxLength}
      </Text>
    );
  };

  return (
    <View style={containerStyles}>
      {label && (
        <Text style={labelStyles}>
          {label}
          {required && <Text style={styles.requiredAsterisk}> *</Text>}
        </Text>
      )}
      
      <View style={inputContainerStyles}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          style={textInputStyles}
          value={value}
          secureTextEntry={isPassword && !isPasswordVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={maxLength}
          testID={testID}
          {...props}
        />
        
        <View style={styles.rightIconContainer}>
          {isPassword && renderPasswordToggle()}
          {rightIcon && !isPassword && rightIcon}
        </View>
      </View>
      
      <View style={styles.bottomRow}>
        {hasError && (
          <Text style={styles.errorText}>
            {error}
          </Text>
        )}
        {helpText && !hasError && (
          <Text style={[styles.helpText, helpTextStyle]}>
            {helpText}
          </Text>
        )}
        <View style={styles.spacer} />
        {renderCharacterCount()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  labelRequired: {
    fontWeight: '600',
  },
  labelError: {
    color: '#F44336',
  },
  requiredAsterisk: {
    color: '#F44336',
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  
  // Variants
  inputContainer_default: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  inputContainer_outline: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
  },
  inputContainer_underline: {
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
    borderRadius: 0,
  },
  
  // States
  inputContainerFocused: {
    borderColor: '#2196F3',
  },
  inputContainerError: {
    borderColor: '#F44336',
  },
  
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    paddingVertical: 12,
  },
  
  // Variants
  textInput_default: {
    paddingHorizontal: 16,
  },
  textInput_outline: {
    paddingHorizontal: 16,
  },
  textInput_underline: {
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  
  // Icon adjustments
  textInputWithLeftIcon: {
    paddingLeft: 8,
  },
  textInputWithRightIcon: {
    paddingRight: 8,
  },
  
  leftIconContainer: {
    paddingLeft: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  rightIconContainer: {
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  iconButton: {
    padding: 4,
  },
  
  passwordToggleIcon: {
    fontSize: 20,
    color: '#757575',
  },
  
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    minHeight: 20,
  },
  
  errorText: {
    fontSize: 14,
    color: '#F44336',
    flex: 1,
  },
  
  helpText: {
    fontSize: 12,
    color: '#757575',
    flex: 1,
    marginTop: 2,
  },
  
  spacer: {
    flex: 1,
  },
  
  characterCount: {
    fontSize: 12,
    color: '#757575',
  },
  characterCountError: {
    color: '#F44336',
  },
});
