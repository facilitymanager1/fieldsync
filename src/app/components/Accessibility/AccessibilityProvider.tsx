"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  focusIndicators: 'default' | 'enhanced';
  keyboardNavigation: boolean;
  skipLinks: boolean;
  announcementLevel: 'polite' | 'assertive' | 'off';
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  isReducedMotion: boolean;
  isHighContrast: boolean;
  isFocusVisible: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

const ACCESSIBILITY_STORAGE_KEY = 'fieldsync-accessibility-settings';
const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  screenReaderOptimized: false,
  fontSize: 'medium',
  focusIndicators: 'default',
  keyboardNavigation: true,
  skipLinks: true,
  announcementLevel: 'polite',
};

export default function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const [isFocusVisible, setIsFocusVisible] = useState(false);

  // System preferences detection
  const [systemPreferences, setSystemPreferences] = useState({
    reducedMotion: false,
    highContrast: false,
  });

  // Load settings on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load saved settings
    try {
      const savedSettings = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load accessibility settings:', error);
    }

    // Detect system preferences
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const updateSystemPreferences = () => {
      setSystemPreferences({
        reducedMotion: reducedMotionQuery.matches,
        highContrast: highContrastQuery.matches,
      });
    };

    updateSystemPreferences();
    reducedMotionQuery.addEventListener('change', updateSystemPreferences);
    highContrastQuery.addEventListener('change', updateSystemPreferences);

    // Keyboard navigation detection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setIsFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      reducedMotionQuery.removeEventListener('change', updateSystemPreferences);
      highContrastQuery.removeEventListener('change', updateSystemPreferences);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Apply settings to document
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    
    // High contrast mode
    const isHighContrast = settings.highContrast || systemPreferences.highContrast;
    root.classList.toggle('high-contrast', isHighContrast);
    
    // Reduced motion
    const isReducedMotion = settings.reducedMotion || systemPreferences.reducedMotion;
    root.classList.toggle('reduced-motion', isReducedMotion);
    
    // Font size
    root.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large');
    root.classList.add(`font-${settings.fontSize}`);
    
    // Focus indicators
    root.classList.toggle('enhanced-focus', settings.focusIndicators === 'enhanced');
    
    // Screen reader optimization
    root.classList.toggle('screen-reader-optimized', settings.screenReaderOptimized);
    
    // Keyboard navigation
    root.classList.toggle('keyboard-navigation', settings.keyboardNavigation);

    // Focus visible state
    root.classList.toggle('focus-visible', isFocusVisible);

    // Update CSS custom properties
    root.style.setProperty('--focus-ring-width', settings.focusIndicators === 'enhanced' ? '3px' : '2px');
    root.style.setProperty('--animation-duration', isReducedMotion ? '0ms' : '300ms');
    
  }, [settings, systemPreferences, isFocusVisible]);

  // Save settings when they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save accessibility settings:', error);
    }
  }, [settings]);

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const announceToScreenReader = (
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    if (typeof document === 'undefined' || settings.announcementLevel === 'off') return;
    
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  const contextValue: AccessibilityContextType = {
    settings,
    updateSetting,
    announceToScreenReader,
    isReducedMotion: settings.reducedMotion || systemPreferences.reducedMotion,
    isHighContrast: settings.highContrast || systemPreferences.highContrast,
    isFocusVisible,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
      
      {/* Screen reader announcements container */}
      <div id="a11y-announcements" aria-live="polite" aria-atomic="true" className="sr-only" />
      
      {/* Skip links */}
      {settings.skipLinks && (
        <div className="skip-links">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <a href="#navigation" className="skip-link">
            Skip to navigation
          </a>
          <a href="#search" className="skip-link">
            Skip to search
          </a>
        </div>
      )}
    </AccessibilityContext.Provider>
  );
}