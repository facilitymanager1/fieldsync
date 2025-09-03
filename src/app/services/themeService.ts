/**
 * Theme Service
 * Handles theme persistence, system preference detection, and theme utilities
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemePreferences {
  mode: ThemeMode;
  primaryColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
  density?: 'comfortable' | 'compact';
}

const THEME_STORAGE_KEY = 'fieldsync-theme-preferences';

export class ThemeService {
  /**
   * Get system color scheme preference
   */
  static getSystemPreference(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light';
  }

  /**
   * Get stored theme preferences
   */
  static getStoredPreferences(): ThemePreferences {
    if (typeof window === 'undefined') {
      return { mode: 'system' };
    }

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to parse stored theme preferences:', error);
    }

    return { mode: 'system' };
  }

  /**
   * Save theme preferences
   */
  static savePreferences(preferences: ThemePreferences): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save theme preferences:', error);
    }
  }

  /**
   * Resolve theme mode to actual light/dark value
   */
  static resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'system') {
      return this.getSystemPreference();
    }
    return mode;
  }

  /**
   * Listen for system theme changes
   */
  static listenForSystemChanges(callback: (isDark: boolean) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      callback(event.matches);
    };

    mediaQuery.addEventListener('change', listener);

    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }

  /**
   * Apply theme to document
   */
  static applyThemeToDocument(mode: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;

    // Update document class
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${mode}`);

    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = mode === 'dark' ? '#1e1e1e' : '#1976d2';
      metaThemeColor.setAttribute('content', color);
    }

    // Update CSS custom properties for additional theming
    const root = document.documentElement;
    if (mode === 'dark') {
      root.style.setProperty('--app-bg-color', '#121212');
      root.style.setProperty('--app-paper-color', '#1e1e1e');
      root.style.setProperty('--app-text-primary', '#ffffff');
      root.style.setProperty('--app-text-secondary', 'rgba(255, 255, 255, 0.7)');
    } else {
      root.style.setProperty('--app-bg-color', '#fafafa');
      root.style.setProperty('--app-paper-color', '#ffffff');
      root.style.setProperty('--app-text-primary', 'rgba(0, 0, 0, 0.87)');
      root.style.setProperty('--app-text-secondary', 'rgba(0, 0, 0, 0.6)');
    }
  }

  /**
   * Get theme-appropriate colors for charts and visualizations
   */
  static getVisualizationColors(mode: 'light' | 'dark') {
    const lightColors = [
      '#1976d2', '#dc004e', '#388e3c', '#f57c00',
      '#7b1fa2', '#00796b', '#c62828', '#5d4037'
    ];

    const darkColors = [
      '#90caf9', '#f48fb1', '#a5d6a7', '#ffb74d',
      '#ce93d8', '#80cbc4', '#ef9a9a', '#bcaaa4'
    ];

    return mode === 'dark' ? darkColors : lightColors;
  }

  /**
   * Check if current theme is high contrast
   */
  static isHighContrastMode(): boolean {
    if (typeof window === 'undefined') return false;
    
    return window.matchMedia('(prefers-contrast: high)').matches;
  }

  /**
   * Check if user prefers reduced motion
   */
  static prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get accessibility-friendly theme settings
   */
  static getAccessibilitySettings() {
    return {
      highContrast: this.isHighContrastMode(),
      reducedMotion: this.prefersReducedMotion(),
      systemTheme: this.getSystemPreference(),
    };
  }
}