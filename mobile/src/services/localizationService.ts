import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

export type SupportedLanguage = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'ml' | 'gu' | 'mr' | 'bn';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl: boolean;
  dateFormat: string;
  numberFormat: string;
  enabled: boolean;
}

export interface LocalizationConfig {
  fallbackLanguage: SupportedLanguage;
  enablePluralForms: boolean;
  enableInterpolation: boolean;
  cacheTranslations: boolean;
  autoDetectLanguage: boolean;
}

class LocalizationService {
  private static instance: LocalizationService;
  private currentLanguage: SupportedLanguage = 'en';
  private translations: Map<SupportedLanguage, Record<string, any>> = new Map();
  private listeners: ((language: SupportedLanguage) => void)[] = [];
  private config: LocalizationConfig = {
    fallbackLanguage: 'en',
    enablePluralForms: true,
    enableInterpolation: true,
    cacheTranslations: true,
    autoDetectLanguage: true
  };

  private supportedLanguages: LanguageConfig[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'en-US',
      enabled: true
    },
    {
      code: 'hi',
      name: 'Hindi',
      nativeName: 'हिंदी',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'hi-IN',
      enabled: true
    },
    {
      code: 'kn',
      name: 'Kannada',
      nativeName: 'ಕನ್ನಡ',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'kn-IN',
      enabled: true
    },
    {
      code: 'ta',
      name: 'Tamil',
      nativeName: 'தமிழ்',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'ta-IN',
      enabled: true
    },
    {
      code: 'te',
      name: 'Telugu',
      nativeName: 'తెలుగు',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'te-IN',
      enabled: true
    },
    {
      code: 'ml',
      name: 'Malayalam',
      nativeName: 'മലയാളം',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'ml-IN',
      enabled: true
    },
    {
      code: 'gu',
      name: 'Gujarati',
      nativeName: 'ગુજરાતી',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'gu-IN',
      enabled: true
    },
    {
      code: 'mr',
      name: 'Marathi',
      nativeName: 'मराठी',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'mr-IN',
      enabled: true
    },
    {
      code: 'bn',
      name: 'Bengali',
      nativeName: 'বাংলা',
      rtl: false,
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'bn-IN',
      enabled: true
    }
  ];

  private constructor() {
    this.initialize();
  }

  static getInstance(): LocalizationService {
    if (!LocalizationService.instance) {
      LocalizationService.instance = new LocalizationService();
    }
    return LocalizationService.instance;
  }

  private async initialize() {
    try {
      // Load saved language preference
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage && this.isLanguageSupported(savedLanguage as SupportedLanguage)) {
        this.currentLanguage = savedLanguage as SupportedLanguage;
      } else if (this.config.autoDetectLanguage) {
        this.currentLanguage = this.detectDeviceLanguage();
      }

      // Load translations for current language
      await this.loadTranslations(this.currentLanguage);
      
      // Load fallback language if different
      if (this.currentLanguage !== this.config.fallbackLanguage) {
        await this.loadTranslations(this.config.fallbackLanguage);
      }

    } catch (error) {
      console.error('Error initializing localization service:', error);
      this.currentLanguage = this.config.fallbackLanguage;
    }
  }

  private detectDeviceLanguage(): SupportedLanguage {
    try {
      let deviceLanguage = 'en';
      
      if (Platform.OS === 'ios') {
        deviceLanguage = NativeModules.SettingsManager?.settings?.AppleLocale || 
                        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || 
                        'en';
      } else {
        deviceLanguage = NativeModules.I18nManager?.localeIdentifier || 'en';
      }

      // Extract language code
      const languageCode = deviceLanguage.split('_')[0].split('-')[0] as SupportedLanguage;
      
      return this.isLanguageSupported(languageCode) ? languageCode : 'en';
    } catch (error) {
      console.error('Error detecting device language:', error);
      return 'en';
    }
  }

  private isLanguageSupported(language: SupportedLanguage): boolean {
    return this.supportedLanguages.some(lang => lang.code === language && lang.enabled);
  }

  async loadTranslations(language: SupportedLanguage): Promise<void> {
    if (this.translations.has(language)) {
      return; // Already loaded
    }

    try {
      // Load base translations
      const baseTranslations = await this.loadTranslationFile(language, 'base');
      
      // Load onboarding-specific translations
      const onboardingTranslations = await this.loadTranslationFile(language, 'onboarding');
      
      // Load validation translations
      const validationTranslations = await this.loadTranslationFile(language, 'validation');
      
      // Load error translations
      const errorTranslations = await this.loadTranslationFile(language, 'errors');

      // Merge all translations
      const allTranslations = {
        ...baseTranslations,
        onboarding: onboardingTranslations,
        validation: validationTranslations,
        errors: errorTranslations
      };

      this.translations.set(language, allTranslations);

      // Cache translations if enabled
      if (this.config.cacheTranslations) {
        await AsyncStorage.setItem(
          `translations_${language}`,
          JSON.stringify(allTranslations)
        );
      }

    } catch (error) {
      console.error(`Error loading translations for ${language}:`, error);
    }
  }

  private async loadTranslationFile(language: SupportedLanguage, category: string): Promise<Record<string, any>> {
    try {
      // Check cache first
      if (this.config.cacheTranslations) {
        const cached = await AsyncStorage.getItem(`translations_${language}_${category}`);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Load from files (in a real app, these would be bundled or downloaded)
      const translations = await this.getTranslationData(language, category);
      return translations;
    } catch (error) {
      console.error(`Error loading ${category} translations for ${language}:`, error);
      return {};
    }
  }

  private async getTranslationData(language: SupportedLanguage, category: string): Promise<Record<string, any>> {
    // In a real implementation, this would load from actual translation files
    // For now, returning sample translations
    const translations = this.getSampleTranslations(language, category);
    return translations;
  }

  // Translation Methods

  translate(key: string, params?: Record<string, any>, options?: {
    count?: number;
    language?: SupportedLanguage;
    fallback?: string;
  }): string {
    const language = options?.language || this.currentLanguage;
    const translations = this.translations.get(language);
    
    let translation = this.getNestedTranslation(translations, key);

    // Fallback to default language
    if (!translation && language !== this.config.fallbackLanguage) {
      const fallbackTranslations = this.translations.get(this.config.fallbackLanguage);
      translation = this.getNestedTranslation(fallbackTranslations, key);
    }

    // Use provided fallback or key as last resort
    if (!translation) {
      translation = options?.fallback || key;
    }

    // Handle pluralization
    if (this.config.enablePluralForms && options?.count !== undefined) {
      translation = this.handlePluralization(translation, options.count, language);
    }

    // Handle interpolation
    if (this.config.enableInterpolation && params) {
      translation = this.interpolateString(translation, params);
    }

    return translation;
  }

  private getNestedTranslation(translations: Record<string, any> | undefined, key: string): string | null {
    if (!translations) return null;

    const keys = key.split('.');
    let current = translations;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  private handlePluralization(translation: string, count: number, language: SupportedLanguage): string {
    // Simple pluralization rules - can be enhanced for language-specific rules
    if (typeof translation === 'object') {
      if (count === 0 && 'zero' in translation) return translation.zero;
      if (count === 1 && 'one' in translation) return translation.one;
      if ('other' in translation) return translation.other;
    }

    return translation;
  }

  private interpolateString(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  // Language Management

  async setLanguage(language: SupportedLanguage): Promise<void> {
    if (!this.isLanguageSupported(language)) {
      throw new Error(`Language ${language} is not supported`);
    }

    this.currentLanguage = language;
    
    // Load translations if not already loaded
    if (!this.translations.has(language)) {
      await this.loadTranslations(language);
    }

    // Save preference
    await AsyncStorage.setItem('app_language', language);

    // Notify listeners
    this.notifyLanguageChange();
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  getCurrentLanguageConfig(): LanguageConfig {
    return this.supportedLanguages.find(lang => lang.code === this.currentLanguage)!;
  }

  getSupportedLanguages(): LanguageConfig[] {
    return this.supportedLanguages.filter(lang => lang.enabled);
  }

  addLanguageChangeListener(listener: (language: SupportedLanguage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyLanguageChange(): void {
    this.listeners.forEach(listener => listener(this.currentLanguage));
  }

  // Utility Methods

  formatDate(date: Date, format?: string): string {
    const config = this.getCurrentLanguageConfig();
    const locale = `${this.currentLanguage}-IN`;
    
    try {
      if (format) {
        // Custom format handling
        return this.formatDateCustom(date, format);
      }
      
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (error) {
      return date.toLocaleDateString();
    }
  }

  private formatDateCustom(date: Date, format: string): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    
    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year);
  }

  formatNumber(number: number, options?: Intl.NumberFormatOptions): string {
    const config = this.getCurrentLanguageConfig();
    const locale = `${this.currentLanguage}-IN`;
    
    try {
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      return number.toString();
    }
  }

  formatCurrency(amount: number, currency: string = 'INR'): string {
    return this.formatNumber(amount, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    });
  }

  isRTL(): boolean {
    const config = this.getCurrentLanguageConfig();
    return config.rtl;
  }

  // Configuration

  setConfig(config: Partial<LocalizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LocalizationConfig {
    return { ...this.config };
  }

  // Translation Management

  async addTranslations(language: SupportedLanguage, translations: Record<string, any>): Promise<void> {
    const existing = this.translations.get(language) || {};
    const merged = this.deepMerge(existing, translations);
    
    this.translations.set(language, merged);

    if (this.config.cacheTranslations) {
      await AsyncStorage.setItem(
        `translations_${language}`,
        JSON.stringify(merged)
      );
    }
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  async clearCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const translationKeys = keys.filter(key => key.startsWith('translations_'));
    
    if (translationKeys.length > 0) {
      await AsyncStorage.multiRemove(translationKeys);
    }
    
    this.translations.clear();
    await this.initialize();
  }

  // Sample translations - in production, these would come from files or API
  private getSampleTranslations(language: SupportedLanguage, category: string): Record<string, any> {
    const translations: Record<SupportedLanguage, Record<string, any>> = {
      en: {
        base: {
          common: {
            save: 'Save',
            cancel: 'Cancel',
            submit: 'Submit',
            next: 'Next',
            previous: 'Previous',
            required: 'Required',
            optional: 'Optional',
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            warning: 'Warning',
            info: 'Information'
          }
        },
        onboarding: {
          title: 'Employee Onboarding',
          steps: {
            basicDetails: 'Basic Details',
            documents: 'Documents',
            bankDetails: 'Bank Details',
            education: 'Education',
            experience: 'Experience',
            emergency: 'Emergency Contact',
            salary: 'Salary Details'
          },
          fields: {
            firstName: 'First Name',
            lastName: 'Last Name',
            email: 'Email Address',
            phone: 'Phone Number',
            dateOfBirth: 'Date of Birth',
            gender: 'Gender',
            maritalStatus: 'Marital Status',
            address: 'Address'
          }
        },
        validation: {
          required: 'This field is required',
          email: 'Please enter a valid email address',
          phone: 'Please enter a valid phone number',
          minLength: 'Minimum {{min}} characters required',
          maxLength: 'Maximum {{max}} characters allowed'
        },
        errors: {
          networkError: 'Network error occurred',
          serverError: 'Server error occurred',
          validationError: 'Validation error occurred'
        }
      },
      hi: {
        base: {
          common: {
            save: 'सेव करें',
            cancel: 'रद्द करें',
            submit: 'सबमिट करें',
            next: 'अगला',
            previous: 'पिछला',
            required: 'आवश्यक',
            optional: 'वैकल्पिक',
            loading: 'लोड हो रहा है...',
            error: 'त्रुटि',
            success: 'सफलता',
            warning: 'चेतावनी',
            info: 'जानकारी'
          }
        },
        onboarding: {
          title: 'कर्मचारी ऑनबोर्डिंग',
          steps: {
            basicDetails: 'बुनियादी विवरण',
            documents: 'दस्तावेज़',
            bankDetails: 'बैंक विवरण',
            education: 'शिक्षा',
            experience: 'अनुभव',
            emergency: 'आपातकालीन संपर्क',
            salary: 'वेतन विवरण'
          },
          fields: {
            firstName: 'पहला नाम',
            lastName: 'अंतिम नाम',
            email: 'ईमेल पता',
            phone: 'फोन नंबर',
            dateOfBirth: 'जन्म तिथि',
            gender: 'लिंग',
            maritalStatus: 'वैवाहिक स्थिति',
            address: 'पता'
          }
        },
        validation: {
          required: 'यह फील्ड आवश्यक है',
          email: 'कृपया एक वैध ईमेल पता दर्ज करें',
          phone: 'कृपया एक वैध फोन नंबर दर्ज करें',
          minLength: 'न्यूनतम {{min}} अक्षर आवश्यक',
          maxLength: 'अधिकतम {{max}} अक्षर अनुमतित'
        },
        errors: {
          networkError: 'नेटवर्क त्रुटि हुई',
          serverError: 'सर्वर त्रुटि हुई',
          validationError: 'सत्यापन त्रुटि हुई'
        }
      },
      kn: {
        base: {
          common: {
            save: 'ಉಳಿಸಿ',
            cancel: 'ರದ್ದುಮಾಡಿ',
            submit: 'ಸಲ್ಲಿಸಿ',
            next: 'ಮುಂದೆ',
            previous: 'ಹಿಂದೆ',
            required: 'ಅಗತ್ಯ',
            optional: 'ಐಚ್ಛಿಕ',
            loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
            error: 'ದೋಷ',
            success: 'ಯಶಸ್ಸು',
            warning: 'ಎಚ್ಚರಿಕೆ',
            info: 'ಮಾಹಿತಿ'
          }
        },
        onboarding: {
          title: 'ಉದ್ಯೋಗಿ ಆನ್‌ಬೋರ್ಡಿಂಗ್',
          steps: {
            basicDetails: 'ಮೂಲಭೂತ ವಿವರಗಳು',
            documents: 'ದಾಖಲೆಗಳು',
            bankDetails: 'ಬ್ಯಾಂಕ್ ವಿವರಗಳು',
            education: 'ಶಿಕ್ಷಣ',
            experience: 'ಅನುಭವ',
            emergency: 'ತುರ್ತು ಸಂಪರ್ಕ',
            salary: 'ಸಂಬಳ ವಿವರಗಳು'
          },
          fields: {
            firstName: 'ಮೊದಲ ಹೆಸರು',
            lastName: 'ಕೊನೆಯ ಹೆಸರು',
            email: 'ಇಮೇಲ್ ವಿಳಾಸ',
            phone: 'ಫೋನ್ ಸಂಖ್ಯೆ',
            dateOfBirth: 'ಜನ್ಮ ದಿನಾಂಕ',
            gender: 'ಲಿಂಗ',
            maritalStatus: 'ವೈವಾಹಿಕ ಸ್ಥಿತಿ',
            address: 'ವಿಳಾಸ'
          }
        },
        validation: {
          required: 'ಈ ಕ್ಷೇತ್ರ ಅಗತ್ಯವಿದೆ',
          email: 'ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ',
          phone: 'ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ',
          minLength: 'ಕನಿಷ್ಠ {{min}} ಅಕ್ಷರಗಳು ಅಗತ್ಯ',
          maxLength: 'ಗರಿಷ್ಠ {{max}} ಅಕ್ಷರಗಳು ಅನುಮತಿಸಲಾಗಿದೆ'
        },
        errors: {
          networkError: 'ನೆಟ್‌ವರ್ಕ್ ದೋಷ ಸಂಭವಿಸಿದೆ',
          serverError: 'ಸರ್ವರ್ ದೋಷ ಸಂಭವಿಸಿದೆ',
          validationError: 'ಮೌಲ್ಯೀಕರಣ ದೋಷ ಸಂಭವಿಸಿದೆ'
        }
      },
      ta: {}, te: {}, ml: {}, gu: {}, mr: {}, bn: {} // Add other languages as needed
    };

    return translations[language]?.[category] || {};
  }
}

export default LocalizationService.getInstance();