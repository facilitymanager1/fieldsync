// Accessibility System for FieldSync Mobile
// WCAG 2.1 AA compliance and advanced accessibility features

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export interface AccessibilityConfig {
  enableScreenReader: boolean;
  enableHighContrast: boolean;
  enableLargeText: boolean;
  enableReducedMotion: boolean;
  minimumTouchTarget: number;
  focusRingColor: string;
  announcePageChanges: boolean;
}

export interface AccessibilityState {
  isScreenReaderEnabled: boolean;
  isHighContrastEnabled: boolean;
  isLargeTextEnabled: boolean;
  isReducedMotionEnabled: boolean;
  textScale: number;
  colorScheme: 'light' | 'dark' | 'high-contrast';
}

export const useAccessibility = (config: Partial<AccessibilityConfig> = {}) => {
  const defaultConfig: AccessibilityConfig = {
    enableScreenReader: true,
    enableHighContrast: true,
    enableLargeText: true,
    enableReducedMotion: true,
    minimumTouchTarget: 44,
    focusRingColor: '#007AFF',
    announcePageChanges: true,
    ...config,
  };

  const [accessibilityState, setAccessibilityState] = useState<AccessibilityState>({
    isScreenReaderEnabled: false,
    isHighContrastEnabled: false,
    isLargeTextEnabled: false,
    isReducedMotionEnabled: false,
    textScale: 1,
    colorScheme: 'light',
  });

  const screenReaderChangedListener = useRef<any>(null);
  const lastAnnouncementTime = useRef<number>(0);

  // Initialize accessibility state
  useEffect(() => {
    const initializeAccessibility = async () => {
      try {
        const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        const isReducedMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
        
        setAccessibilityState(prev => ({
          ...prev,
          isScreenReaderEnabled,
          isReducedMotionEnabled,
        }));

        // Listen for screen reader changes
        screenReaderChangedListener.current = AccessibilityInfo.addEventListener(
          'screenReaderChanged',
          (enabled: boolean) => {
            setAccessibilityState(prev => ({
              ...prev,
              isScreenReaderEnabled: enabled,
            }));
          }
        );
      } catch (error) {
        console.error('Failed to initialize accessibility:', error);
      }
    };

    initializeAccessibility();

    return () => {
      if (screenReaderChangedListener.current) {
        screenReaderChangedListener.current.remove();
      }
    };
  }, []);

  // Screen reader announcement utility
  const announceForScreenReader = useCallback((message: string, delay: number = 100) => {
    if (!accessibilityState.isScreenReaderEnabled || !defaultConfig.enableScreenReader) {
      return;
    }

    const currentTime = Date.now();
    if (currentTime - lastAnnouncementTime.current < 500) {
      return; // Prevent spam
    }

    setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(message);
      lastAnnouncementTime.current = Date.now();
    }, delay);
  }, [accessibilityState.isScreenReaderEnabled, defaultConfig.enableScreenReader]);

  // Focus management
  const setAccessibilityFocus = useCallback((ref: React.RefObject<any>) => {
    if (ref.current && accessibilityState.isScreenReaderEnabled) {
      AccessibilityInfo.setAccessibilityFocus(ref.current);
    }
  }, [accessibilityState.isScreenReaderEnabled]);

  // Get accessible styles
  const getAccessibleStyles = useCallback((baseStyle: ViewStyle = {}): ViewStyle => {
    const { width } = Dimensions.get('window');
    const isTablet = width > 768;
    
    let styles: ViewStyle = { ...baseStyle };

    // Minimum touch target size - check if value is a number
    if (styles.minHeight && typeof styles.minHeight === 'number' && styles.minHeight < defaultConfig.minimumTouchTarget) {
      styles.minHeight = defaultConfig.minimumTouchTarget;
    }
    if (styles.minWidth && typeof styles.minWidth === 'number' && styles.minWidth < defaultConfig.minimumTouchTarget) {
      styles.minWidth = defaultConfig.minimumTouchTarget;
    }

    // High contrast adjustments
    if (accessibilityState.isHighContrastEnabled) {
      styles = {
        ...styles,
        borderWidth: (styles.borderWidth || 0) + 1,
        borderColor: styles.borderColor || '#000000',
      };
    }

    return styles;
  }, [
    accessibilityState.isHighContrastEnabled,
    defaultConfig.minimumTouchTarget,
  ]);

  // Get accessible text styles
  const getAccessibleTextStyles = useCallback((baseStyle: TextStyle = {}): TextStyle => {
    const { width } = Dimensions.get('window');
    const isTablet = width > 768;
    
    let styles: TextStyle = { ...baseStyle };

    // Large text scaling
    if (accessibilityState.isLargeTextEnabled) {
      const scale = isTablet ? 1.3 : 1.2;
      if (styles.fontSize && typeof styles.fontSize === 'number') {
        styles.fontSize = styles.fontSize * scale;
      }
      if (styles.lineHeight && typeof styles.lineHeight === 'number') {
        styles.lineHeight = styles.lineHeight * scale;
      }
    }

    // High contrast adjustments for text
    if (accessibilityState.isHighContrastEnabled) {
      styles = {
        ...styles,
        color: styles.color || '#000000',
      };
    }

    return styles;
  }, [
    accessibilityState.isHighContrastEnabled,
    accessibilityState.isLargeTextEnabled,
  ]);

  // Get accessible text props
  const getAccessibleTextProps = useCallback((text: string, role?: string) => {
    const props: any = {
      accessible: true,
      accessibilityRole: role || 'text',
      accessibilityLabel: text,
    };

    // Add additional context for screen readers
    if (accessibilityState.isScreenReaderEnabled) {
      if (role === 'button') {
        props.accessibilityHint = 'Double tap to activate';
      } else if (role === 'link') {
        props.accessibilityHint = 'Double tap to open link';
      }
    }

    return props;
  }, [accessibilityState.isScreenReaderEnabled]);

  // Color contrast utility
  const getContrastRatio = useCallback((color1: string, color2: string): number => {
    // Simplified contrast ratio calculation
    // In a real implementation, you'd use a proper color library
    const getLuminance = (color: string) => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const [rs, gs, bs] = [r, g, b].map(c => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (brighter + 0.05) / (darker + 0.05);
  }, []);

  // Validate color contrast for WCAG compliance
  const validateColorContrast = useCallback((
    foreground: string,
    background: string,
    level: 'AA' | 'AAA' = 'AA'
  ) => {
    const ratio = getContrastRatio(foreground, background);
    const threshold = level === 'AAA' ? 7 : 4.5;
    
    return {
      ratio,
      isCompliant: ratio >= threshold,
      recommendation: ratio < threshold ? 
        `Increase contrast. Current: ${ratio.toFixed(2)}, Required: ${threshold}` : 
        'Contrast is compliant',
    };
  }, [getContrastRatio]);

  // Navigation announcement hook
  const useNavigationAnnouncement = useCallback((screenName: string) => {
    useFocusEffect(
      useCallback(() => {
        if (defaultConfig.announcePageChanges) {
          announceForScreenReader(`Navigated to ${screenName}`, 500);
        }
      }, [screenName])
    );
  }, [announceForScreenReader, defaultConfig.announcePageChanges]);

  return {
    accessibilityState,
    config: defaultConfig,
    announceForScreenReader,
    setAccessibilityFocus,
    getAccessibleStyles,
    getAccessibleTextStyles,
    getAccessibleTextProps,
    validateColorContrast,
    getContrastRatio,
    useNavigationAnnouncement,
  };
};

// Accessible text component
export interface AccessibleTextProps {
  children: string;
  style?: any;
  role?: 'text' | 'header' | 'button' | 'link';
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  announcement?: string;
}

export const AccessibleText: React.FC<AccessibleTextProps> = ({
  children,
  style,
  role = 'text',
  level,
  announcement,
}) => {
  const { getAccessibleTextProps, getAccessibleStyles, announceForScreenReader } = useAccessibility();
  
  useEffect(() => {
    if (announcement) {
      announceForScreenReader(announcement);
    }
  }, [announcement, announceForScreenReader]);

  const accessibilityRole = level ? 'header' : role;
  const accessibilityLevel = level ? { accessibilityLevel: level } : {};

  return (
    <Text
      style={[getAccessibleStyles(style)]}
      {...getAccessibleTextProps(children, accessibilityRole)}
      {...accessibilityLevel}
    >
      {children}
    </Text>
  );
};

// Accessible button wrapper
export interface AccessibleButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  hint?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  onPress,
  label,
  hint,
  style,
  disabled = false,
}) => {
  const { getAccessibleStyles } = useAccessibility();
  const buttonRef = useRef<View>(null);

  return (
    <View
      ref={buttonRef}
      style={[styles.button, getAccessibleStyles(style)]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint || 'Double tap to activate'}
      accessibilityState={{ disabled }}
      onAccessibilityTap={disabled ? undefined : onPress}
    >
      {children}
    </View>
  );
};

// Focus ring component for keyboard navigation
export interface FocusRingProps {
  children: React.ReactNode;
  focused: boolean;
  color?: string;
}

export const FocusRing: React.FC<FocusRingProps> = ({
  children,
  focused,
  color = '#007AFF',
}) => {
  return (
    <View style={[styles.focusRing, focused && { borderColor: color, borderWidth: 2 }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusRing: {
    borderRadius: 4,
    borderWidth: 0,
    borderColor: 'transparent',
  },
});

export default useAccessibility;
