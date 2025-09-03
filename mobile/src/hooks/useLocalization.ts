import { useState, useEffect, useCallback } from 'react';
import LocalizationService, { SupportedLanguage, LanguageConfig } from '../services/localizationService';

export interface LocalizationState {
  currentLanguage: SupportedLanguage;
  languageConfig: LanguageConfig;
  supportedLanguages: LanguageConfig[];
  isRTL: boolean;
  loading: boolean;
  error?: string;
}

export interface LocalizationActions {
  translate: (key: string, params?: Record<string, any>, options?: {
    count?: number;
    language?: SupportedLanguage;
    fallback?: string;
  }) => string;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  formatDate: (date: Date, format?: string) => string;
  formatNumber: (number: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  addTranslations: (language: SupportedLanguage, translations: Record<string, any>) => Promise<void>;
  clearCache: () => Promise<void>;
}

export function useLocalization(): LocalizationState & LocalizationActions {
  const [state, setState] = useState<LocalizationState>({
    currentLanguage: 'en',
    languageConfig: {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'en-US',
      enabled: true
    },
    supportedLanguages: [],
    isRTL: false,
    loading: true
  });

  useEffect(() => {
    let mounted = true;

    const initializeLocalization = async () => {
      try {
        // Set up language change listener
        const removeListener = LocalizationService.addLanguageChangeListener((language) => {
          if (mounted) {
            updateState();
          }
        });

        // Initial state update
        await updateState();

        return () => {
          removeListener();
        };
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: `Initialization error: ${error}`
          }));
        }
      }
    };

    const updateState = async () => {
      try {
        const currentLanguage = LocalizationService.getCurrentLanguage();
        const languageConfig = LocalizationService.getCurrentLanguageConfig();
        const supportedLanguages = LocalizationService.getSupportedLanguages();
        const isRTL = LocalizationService.isRTL();

        if (mounted) {
          setState(prev => ({
            ...prev,
            currentLanguage,
            languageConfig,
            supportedLanguages,
            isRTL,
            loading: false,
            error: undefined
          }));
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: `Failed to update state: ${error}`
          }));
        }
      }
    };

    initializeLocalization();

    return () => {
      mounted = false;
    };
  }, []);

  const translate = useCallback((
    key: string, 
    params?: Record<string, any>, 
    options?: {
      count?: number;
      language?: SupportedLanguage;
      fallback?: string;
    }
  ): string => {
    try {
      return LocalizationService.translate(key, params, options);
    } catch (error) {
      console.error('Translation error:', error);
      return options?.fallback || key;
    }
  }, []);

  const setLanguage = useCallback(async (language: SupportedLanguage) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      await LocalizationService.setLanguage(language);
      
      // State will be updated by the listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to set language: ${error}`
      }));
      throw error;
    }
  }, []);

  const formatDate = useCallback((date: Date, format?: string): string => {
    try {
      return LocalizationService.formatDate(date, format);
    } catch (error) {
      console.error('Date formatting error:', error);
      return date.toLocaleDateString();
    }
  }, []);

  const formatNumber = useCallback((number: number, options?: Intl.NumberFormatOptions): string => {
    try {
      return LocalizationService.formatNumber(number, options);
    } catch (error) {
      console.error('Number formatting error:', error);
      return number.toString();
    }
  }, []);

  const formatCurrency = useCallback((amount: number, currency: string = 'INR'): string => {
    try {
      return LocalizationService.formatCurrency(amount, currency);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `₹${amount}`;
    }
  }, []);

  const addTranslations = useCallback(async (language: SupportedLanguage, translations: Record<string, any>) => {
    try {
      await LocalizationService.addTranslations(language, translations);
    } catch (error) {
      console.error('Error adding translations:', error);
      throw error;
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      await LocalizationService.clearCache();
      // State will be updated by re-initialization
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to clear cache: ${error}`
      }));
      throw error;
    }
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    translate,
    setLanguage,
    formatDate,
    formatNumber,
    formatCurrency,
    addTranslations,
    clearCache
  };
}

// Shorthand hook for just translation
export function useTranslation() {
  const { translate, currentLanguage, isRTL } = useLocalization();
  
  const t = useCallback((key: string, params?: Record<string, any>) => {
    return translate(key, params);
  }, [translate]);

  return { t, translate, currentLanguage, isRTL };
}

// Hook for form-specific translations
export function useFormTranslation(formType: string = 'onboarding') {
  const { translate } = useLocalization();
  
  const tf = useCallback((key: string, params?: Record<string, any>) => {
    return translate(`${formType}.${key}`, params, { fallback: key });
  }, [translate, formType]);

  const tv = useCallback((key: string, params?: Record<string, any>) => {
    return translate(`validation.${key}`, params, { fallback: key });
  }, [translate]);

  const te = useCallback((key: string, params?: Record<string, any>) => {
    return translate(`errors.${key}`, params, { fallback: key });
  }, [translate]);

  return { 
    tf, // Form translations
    tv, // Validation translations  
    te, // Error translations
    translate 
  };
}

// Hook for number and date formatting
export function useFormatting() {
  const { formatDate, formatNumber, formatCurrency, languageConfig } = useLocalization();
  
  return {
    formatDate,
    formatNumber,
    formatCurrency,
    dateFormat: languageConfig.dateFormat,
    numberFormat: languageConfig.numberFormat
  };
}