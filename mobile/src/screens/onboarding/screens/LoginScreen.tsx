/**
 * Login Screen - Authentication and Site Selection (Simplified Version)
 * 
 * Features:
 * - Username/Password authentication
 * - Password visibility toggle
 * - Company/Site selection
 * - Multi-language support
 * - Form validation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  language: 'english' as const,
  setLanguage: (lang: string) => console.log('Language:', lang),
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    welcome: 'Welcome to FieldSync',
    login_subtitle: 'Please sign in to continue',
    username: 'Username',
    password: 'Password',
    username_placeholder: 'Enter your username',
    password_placeholder: 'Enter your password',
    remember_credentials: 'Remember me',
    login: 'Login',
    forgot_password: 'Forgot Password',
    select_language: 'Select Language',
    select_site: 'Select Site',
    site_selection_subtitle: 'Choose your deployment site',
    site: 'Site',
    continue: 'Continue',
    required_username: 'Username is required',
    required_password: 'Password is required',
    required_site: 'Site selection is required',
  };
  return texts[key] || key;
};

interface LoginData {
  username: string;
  password: string;
  selectedSite: string;
  organizationId: string;
}

interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

export default function LoginScreen() {
  const { goToNextStep, language, setLanguage } = useOnboarding();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sites, setSites] = useState<Site[]>([
    { id: '1', name: 'Tech Park Site', address: 'Electronic City', city: 'Bangalore', state: 'Karnataka' },
    { id: '2', name: 'Corporate Office', address: 'MG Road', city: 'Bangalore', state: 'Karnataka' },
  ]);
  const [selectedSite, setSelectedSite] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedUsername = await AsyncStorage.getItem('saved_username');
      const savedRemember = await AsyncStorage.getItem('remember_credentials');
      
      if (savedUsername && savedRemember === 'true') {
        setUsername(savedUsername);
        setRememberCredentials(true);
      }
    } catch (error) {
      console.error('Failed to load saved credentials:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!username.trim()) {
      newErrors.username = getLocalizedText('required_username', language);
    }

    if (!password.trim()) {
      newErrors.password = getLocalizedText('required_password', language);
    }

    if (isAuthenticated && !selectedSite) {
      newErrors.site = getLocalizedText('required_site', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    
    try {
      // Simulate API call for authentication
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsAuthenticated(true);
      
      // Save credentials if remember is checked
      if (rememberCredentials) {
        await AsyncStorage.setItem('saved_username', username);
        await AsyncStorage.setItem('remember_credentials', 'true');
      } else {
        await AsyncStorage.removeItem('saved_username');
        await AsyncStorage.removeItem('remember_credentials');
      }

      // Save auth token
      await AsyncStorage.setItem('auth_token', 'mock_token_123');
        
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSiteSelection = () => {
    if (!validateForm()) return;

    const loginData: LoginData = {
      username,
      password: '', // Don't store password in context
      selectedSite,
      organizationId: sites.find(site => site.id === selectedSite)?.id || '',
    };

    goToNextStep({ login: loginData });
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'Reset link will be sent to your registered email',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Reset Link', 
          onPress: () => Alert.alert('Reset Sent', 'Please check your email')
        },
      ]
    );
  };

  const renderLanguageSelector = () => (
    <View style={styles.languageContainer}>
      <Text style={styles.languageLabel}>
        {getLocalizedText('select_language', language)}
      </Text>
      <View style={styles.languageButtons}>
        {['english', 'hindi', 'kannada'].map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[
              styles.languageButton,
              language === lang && styles.languageButtonActive
            ]}
            onPress={() => setLanguage(lang as any)}
          >
            <Text style={[
              styles.languageButtonText,
              language === lang && styles.languageButtonTextActive
            ]}>
              {lang === 'english' ? 'English' : lang === 'hindi' ? 'हिंदी' : 'ಕನ್ನಡ'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderLoginForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>
        {getLocalizedText('welcome', language)}
      </Text>
      <Text style={styles.subtitle}>
        {getLocalizedText('login_subtitle', language)}
      </Text>

      {/* Username Field */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('username', language)} *
        </Text>
        <TextInput
          style={[styles.textInput, errors.username ? styles.inputError : null]}
          value={username}
          onChangeText={setUsername}
          placeholder={getLocalizedText('username_placeholder', language)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {errors.username && (
          <Text style={styles.errorText}>{errors.username}</Text>
        )}
      </View>

      {/* Password Field */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('password', language)} *
        </Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.passwordInput, errors.password ? styles.inputError : null]}
            value={password}
            onChangeText={setPassword}
            placeholder={getLocalizedText('password_placeholder', language)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </Text>
          </TouchableOpacity>
        </View>
        {errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}
      </View>

      {/* Remember Credentials */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => setRememberCredentials(!rememberCredentials)}
      >
        <Text style={styles.checkbox}>
          {rememberCredentials ? '✅' : '☑️'}
        </Text>
        <Text style={styles.checkboxText}>
          {getLocalizedText('remember_credentials', language)}
        </Text>
      </TouchableOpacity>

      {/* Login Button */}
      <TouchableOpacity
        style={[styles.loginButton, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginButtonText}>
            {getLocalizedText('login', language)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Forgot Password */}
      <TouchableOpacity onPress={handleForgotPassword}>
        <Text style={styles.forgotPasswordText}>
          {getLocalizedText('forgot_password', language)}?
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSiteSelection = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>
        {getLocalizedText('select_site', language)}
      </Text>
      <Text style={styles.subtitle}>
        {getLocalizedText('site_selection_subtitle', language)}
      </Text>

      {/* Site Selection */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('site', language)} *
        </Text>
        <View style={[styles.pickerContainer, errors.site ? styles.inputError : null]}>
          {sites.map((site) => (
            <TouchableOpacity
              key={site.id}
              style={[
                styles.siteOption,
                selectedSite === site.id && styles.siteOptionSelected
              ]}
              onPress={() => setSelectedSite(site.id)}
            >
              <Text style={[
                styles.siteOptionText,
                selectedSite === site.id && styles.siteOptionTextSelected
              ]}>
                {site.name} - {site.city}
              </Text>
              <Text style={styles.siteOptionSubtext}>
                {site.address}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.site && (
          <Text style={styles.errorText}>{errors.site}</Text>
        )}
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, !selectedSite && styles.buttonDisabled]}
        onPress={handleSiteSelection}
        disabled={!selectedSite}
      >
        <Text style={styles.continueButtonText}>
          {getLocalizedText('continue', language)}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderLanguageSelector()}
        
        {!isAuthenticated ? renderLoginForm() : renderSiteSelection()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  languageContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 12,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  languageButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  languageButtonText: {
    fontSize: 14,
    color: '#757575',
  },
  languageButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  eyeText: {
    fontSize: 20,
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    fontSize: 20,
    marginRight: 8,
  },
  checkboxText: {
    fontSize: 16,
    color: '#424242',
  },
  loginButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  forgotPasswordText: {
    fontSize: 16,
    color: '#2196F3',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  siteOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  siteOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  siteOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  siteOptionTextSelected: {
    color: '#2196F3',
  },
  siteOptionSubtext: {
    fontSize: 14,
    color: '#757575',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
