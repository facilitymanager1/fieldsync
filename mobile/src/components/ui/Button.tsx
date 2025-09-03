/**
 * Button Component - Reusable button with multiple variants
 * 
 * Features:
 * - Multiple variants (primary, secondary, outline, text)
 * - Multiple sizes (small, medium, large)
 * - Loading state with spinner
 * - Disabled state
 * - Icon support
 * - Customizable colors and styles
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const buttonStyles: StyleProp<ViewStyle> = [
    styles.button,
    styles[`button_${variant}` as keyof typeof styles] as ViewStyle,
    styles[`button_${size}` as keyof typeof styles] as ViewStyle,
    fullWidth && styles.buttonFullWidth,
    (disabled || loading) && styles.buttonDisabled,
    style,
  ];

  const textStyles: StyleProp<TextStyle> = [
    styles.text,
    styles[`text_${variant}` as keyof typeof styles] as TextStyle,
    styles[`text_${size}` as keyof typeof styles] as TextStyle,
    (disabled || loading) && styles.textDisabled,
    textStyle,
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            size={size === 'small' ? 'small' : 'small'} 
            color={variant === 'primary' || variant === 'danger' ? '#fff' : '#2196F3'} 
          />
          <Text style={[textStyles, styles.loadingText]}>{title}</Text>
        </View>
      );
    }

    if (icon) {
      return (
        <View style={[styles.iconContainer, iconPosition === 'right' && styles.iconContainerReverse]}>
          {iconPosition === 'left' && icon}
          <Text style={textStyles}>{title}</Text>
          {iconPosition === 'right' && icon}
        </View>
      );
    }

    return <Text style={textStyles}>{title}</Text>;
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      testID={testID}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
  },
  
  // Variants
  button_primary: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  button_secondary: {
    backgroundColor: '#757575',
    borderColor: '#757575',
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderColor: '#2196F3',
  },
  button_text: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  button_danger: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
  },
  
  // Sizes
  button_small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  button_medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  button_large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 52,
  },
  
  // States
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
    borderColor: '#E0E0E0',
  },
  buttonFullWidth: {
    width: '100%',
  },
  
  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Text variants
  text_primary: {
    color: '#fff',
  },
  text_secondary: {
    color: '#fff',
  },
  text_outline: {
    color: '#2196F3',
  },
  text_text: {
    color: '#2196F3',
  },
  text_danger: {
    color: '#fff',
  },
  
  // Text sizes
  text_small: {
    fontSize: 14,
  },
  text_medium: {
    fontSize: 16,
  },
  text_large: {
    fontSize: 18,
  },
  
  textDisabled: {
    color: '#9E9E9E',
  },
  
  // Icon and loading styles
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainerReverse: {
    flexDirection: 'row-reverse',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    marginLeft: 8,
  },
});
