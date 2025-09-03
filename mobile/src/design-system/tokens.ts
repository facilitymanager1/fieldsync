// Enhanced Design System for FieldSync Mobile App
// Material Design 3.0 Implementation with Advanced Theming

export const designTokens = {
  // Color System - Material Design 3.0
  colors: {
    primary: {
      main: '#1976D2',
      light: '#42A5F5', 
      dark: '#1565C0',
      container: '#E3F2FD',
      onContainer: '#0D47A1'
    },
    secondary: {
      main: '#DC004E',
      light: '#FF5983',
      dark: '#9A0036',
      container: '#FCE4EC',
      onContainer: '#4A0E2D'
    },
    surface: {
      main: '#FFFFFF',
      variant: '#F5F5F5',
      tint: '#FAFAFA',
      container: '#F3F3F3',
      containerHigh: '#ECF1F6'
    },
    semantic: {
      success: { main: '#4CAF50', light: '#81C784', dark: '#388E3C' },
      warning: { main: '#FF9800', light: '#FFB74D', dark: '#F57C00' },
      error: { main: '#F44336', light: '#E57373', dark: '#D32F2F' },
      info: { main: '#2196F3', light: '#64B5F6', dark: '#1976D2' }
    },
    neutral: {
      0: '#FFFFFF',
      10: '#F9F9F9', 
      20: '#F5F5F5',
      30: '#F0F0F0',
      40: '#E0E0E0',
      50: '#C0C0C0',
      60: '#9E9E9E',
      70: '#757575',
      80: '#424242',
      90: '#212121',
      100: '#000000'
    }
  },

  // Typography Scale - Material Design 3.0
  typography: {
    displayLarge: {
      fontSize: 57,
      lineHeight: 64,
      fontWeight: '400',
      letterSpacing: -0.25
    },
    displayMedium: {
      fontSize: 45,
      lineHeight: 52,
      fontWeight: '400', 
      letterSpacing: 0
    },
    displaySmall: {
      fontSize: 36,
      lineHeight: 44,
      fontWeight: '400',
      letterSpacing: 0
    },
    headlineLarge: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '400',
      letterSpacing: 0
    },
    headlineMedium: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '400',
      letterSpacing: 0
    },
    headlineSmall: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '400',
      letterSpacing: 0
    },
    titleLarge: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '500',
      letterSpacing: 0
    },
    titleMedium: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500',
      letterSpacing: 0.15
    },
    titleSmall: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      letterSpacing: 0.1
    },
    labelLarge: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      letterSpacing: 0.1
    },
    labelMedium: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      letterSpacing: 0.5
    },
    labelSmall: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '500',
      letterSpacing: 0.5
    },
    bodyLarge: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      letterSpacing: 0.15
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
      letterSpacing: 0.25
    },
    bodySmall: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400',
      letterSpacing: 0.4
    }
  },

  // Spacing System - 8px base grid
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64
  },

  // Border Radius - Material Design 3.0
  borderRadius: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 9999
  },

  // Elevation System
  elevation: {
    level0: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0
    },
    level1: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1
    },
    level2: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.20,
      shadowRadius: 1.41,
      elevation: 2
    },
    level3: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      elevation: 3
    },
    level4: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4
    },
    level5: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 6
    }
  },

  // Animation Durations
  animation: {
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500
  },

  // Breakpoints for Responsive Design
  breakpoints: {
    xs: 0,      // Phone
    sm: 600,    // Small tablet
    md: 960,    // Large tablet
    lg: 1280,   // Desktop
    xl: 1920    // Large desktop
  }
};

// Dark Mode Theme Variations
export const darkTheme = {
  ...designTokens,
  colors: {
    ...designTokens.colors,
    surface: {
      main: '#121212',
      variant: '#1E1E1E',
      tint: '#2D2D2D',
      container: '#1F1F1F',
      containerHigh: '#2C2C2C'
    },
    neutral: {
      0: '#000000',
      10: '#1A1A1A',
      20: '#2D2D2D',
      30: '#404040',
      40: '#525252',
      50: '#737373',
      60: '#A3A3A3',
      70: '#D4D4D4',
      80: '#E5E5E5',
      90: '#F5F5F5',
      100: '#FFFFFF'
    }
  }
};

// Theme Context Provider
export const themeContext = {
  light: designTokens,
  dark: darkTheme
};
