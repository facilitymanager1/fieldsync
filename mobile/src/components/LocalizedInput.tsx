import React from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet } from 'react-native';
import { useTranslation, useFormatting } from '../hooks/useLocalization';
import { SupportedLanguage } from '../services/localizationService';

interface LocalizedInputProps extends Omit<TextInputProps, 'placeholder'> {
  labelKey?: string;
  placeholderKey?: string;
  errorKey?: string;
  helpKey?: string;
  labelParams?: Record<string, any>;
  placeholderParams?: Record<string, any>;
  errorParams?: Record<string, any>;
  helpParams?: Record<string, any>;
  fallbackLabel?: string;
  fallbackPlaceholder?: string;
  fallbackError?: string;
  fallbackHelp?: string;
  language?: SupportedLanguage;
  required?: boolean;
  showRequiredIndicator?: boolean;
  inputStyle?: any;
  labelStyle?: any;
  errorStyle?: any;
  helpStyle?: any;
  containerStyle?: any;
}

const LocalizedInput: React.FC<LocalizedInputProps> = ({
  labelKey,
  placeholderKey,
  errorKey,
  helpKey,
  labelParams,
  placeholderParams,
  errorParams,
  helpParams,
  fallbackLabel,
  fallbackPlaceholder,
  fallbackError,
  fallbackHelp,
  language,
  required = false,
  showRequiredIndicator = true,
  style,
  inputStyle,
  labelStyle,
  errorStyle,
  helpStyle,
  containerStyle,
  ...inputProps
}) => {
  const { translate, isRTL } = useTranslation();

  const getTranslatedText = (
    key?: string,
    params?: Record<string, any>,
    fallback?: string
  ): string => {
    if (!key) return fallback || '';
    
    return translate(key, params, {
      language,
      fallback: fallback || key
    });
  };

  const label = getTranslatedText(labelKey, labelParams, fallbackLabel);
  const placeholder = getTranslatedText(placeholderKey, placeholderParams, fallbackPlaceholder);
  const error = getTranslatedText(errorKey, errorParams, fallbackError);
  const help = getTranslatedText(helpKey, helpParams, fallbackHelp);

  const inputDirection = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[
            styles.label,
            labelStyle,
            isRTL && styles.rtlText
          ]}>
            {label}
            {required && showRequiredIndicator && (
              <Text style={styles.requiredIndicator}> *</Text>
            )}
          </Text>
        </View>
      )}

      <TextInput
        {...inputProps}
        placeholder={placeholder}
        style={[
          styles.input,
          inputStyle,
          style,
          {
            textAlign,
            writingDirection: inputDirection,
          },
          error && styles.inputError,
          isRTL && styles.rtlInput
        ]}
        placeholderTextColor={inputProps.placeholderTextColor || '#999'}
      />

      {error && (
        <Text style={[
          styles.errorText,
          errorStyle,
          isRTL && styles.rtlText
        ]}>
          {error}
        </Text>
      )}

      {help && !error && (
        <Text style={[
          styles.helpText,
          helpStyle,
          isRTL && styles.rtlText
        ]}>
          {help}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requiredIndicator: {
    color: '#FF5252',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#333',
  },
  inputError: {
    borderColor: '#FF5252',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 14,
    color: '#FF5252',
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlInput: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default LocalizedInput;