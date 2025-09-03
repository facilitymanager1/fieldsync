/**
 * Enhanced Authentication Context for FieldSync
 * Supports OAuth2/OIDC, MFA, and traditional authentication
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
    fullName: string;
    avatar?: string;
    department?: string;
  };
  mfaEnabled: boolean;
  oauth2Providers: Array<{
    provider: string;
    connected: boolean;
  }>;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresMFA: boolean;
  error: string | null;
}

export interface AuthMethods {
  traditional: boolean;
  mfa: boolean;
  oauth2: {
    google: boolean;
    microsoft: boolean;
  };
  saml: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, rememberDevice?: boolean) => Promise<{
    success: boolean;
    requiresMFA: boolean;
    error?: string;
  }>;
  verifyMFA: (email: string, password: string, mfaToken: string, isBackupCode?: boolean) => Promise<{
    success: boolean;
    error?: string;
  }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  setupMFA: (method: 'totp' | 'sms' | 'email') => Promise<{
    success: boolean;
    data?: {
      secret?: string;
      qrCode?: string;
      backupCodes?: string[];
    };
    error?: string;
  }>;
  completeMFASetup: (verificationCode: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  getAuthMethods: () => Promise<AuthMethods>;
  initiateOAuth2: (provider: 'google' | 'microsoft') => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    requiresMFA: false,
    error: null,
  });

  const router = useRouter();

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          // Verify token and get user info
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const { user } = await response.json();
            setAuthState(prev => ({
              ...prev,
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            }));
          } else {
            // Token is invalid
            localStorage.removeItem('authToken');
            setAuthState(prev => ({
              ...prev,
              isLoading: false,
            }));
          }
        } else {
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to initialize authentication',
        }));
      }
    };

    initializeAuth();
  }, []);

  // Auto-refresh token
  useEffect(() => {
    if (authState.isAuthenticated && authState.token) {
      const refreshInterval = setInterval(async () => {
        const success = await refreshToken();
        if (!success) {
          await logout();
        }
      }, 7 * 60 * 1000); // Refresh every 7 minutes (token expires in 8 hours)

      return () => clearInterval(refreshInterval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isAuthenticated, authState.token]);

  const login = useCallback(async (
    email: string, 
    password: string, 
    rememberDevice: boolean = false
  ): Promise<{ success: boolean; requiresMFA: boolean; error?: string }> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, rememberDevice }),
      });

      const data = await response.json();

      if (data.success) {
        // Successful login
        localStorage.setItem('authToken', data.token);
        setAuthState(prev => ({
          ...prev,
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          requiresMFA: false,
          isLoading: false,
        }));
        return { success: true, requiresMFA: false };
      } else if (data.requiresMFA) {
        // MFA required
        setAuthState(prev => ({
          ...prev,
          requiresMFA: true,
          isLoading: false,
        }));
        return { success: false, requiresMFA: true };
      } else {
        // Login failed
        setAuthState(prev => ({
          ...prev,
          error: data.error || 'Login failed',
          isLoading: false,
        }));
        return { success: false, requiresMFA: false, error: data.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = 'Network error. Please try again.';
      setAuthState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { success: false, requiresMFA: false, error: errorMessage };
    }
  }, []);

  const verifyMFA = useCallback(async (
    email: string,
    password: string,
    mfaToken: string,
    isBackupCode: boolean = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`${API_BASE_URL}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, mfaToken, isBackupCode }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('authToken', data.token);
        setAuthState(prev => ({
          ...prev,
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          requiresMFA: false,
          isLoading: false,
        }));
        return { success: true };
      } else {
        setAuthState(prev => ({
          ...prev,
          error: data.error || 'MFA verification failed',
          isLoading: false,
        }));
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      const errorMessage = 'Network error. Please try again.';
      setAuthState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (authState.token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        requiresMFA: false,
        error: null,
      });
      router.push('/login');
    }
  }, [authState.token, router]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include', // Include httpOnly refresh token cookie
      });

      if (response.ok) {
        const { token } = await response.json();
        localStorage.setItem('authToken', token);
        setAuthState(prev => ({
          ...prev,
          token,
        }));
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, []);

  const setupMFA = useCallback(async (
    method: 'totp' | 'sms' | 'email'
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      if (!authState.token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ method }),
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('MFA setup error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [authState.token]);

  const completeMFASetup = useCallback(async (
    verificationCode: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!authState.token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/mfa/setup/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ verificationCode }),
      });

      const data = await response.json();

      if (data.success) {
        // Update user MFA status
        setAuthState(prev => prev.user ? ({
          ...prev,
          user: {
            ...prev.user,
            mfaEnabled: true,
          },
        }) : prev);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('MFA setup completion error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [authState.token]);

  const getAuthMethods = useCallback(async (): Promise<AuthMethods> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/methods`);
      const data = await response.json();
      
      if (data.success) {
        return data.methods;
      } else {
        return {
          traditional: true,
          mfa: false,
          oauth2: { google: false, microsoft: false },
          saml: false,
        };
      }
    } catch (error) {
      console.error('Get auth methods error:', error);
      return {
        traditional: true,
        mfa: false,
        oauth2: { google: false, microsoft: false },
        saml: false,
      };
    }
  }, []);

  const initiateOAuth2 = useCallback((provider: 'google' | 'microsoft') => {
    window.location.href = `${API_BASE_URL}/api/auth/oauth2/${provider}`;
  }, []);

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Handle OAuth2 callback
  useEffect(() => {
    const handleOAuth2Callback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const error = urlParams.get('error');

      if (token) {
        localStorage.setItem('authToken', token);
        // Get user info
        fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
          .then(response => response.json())
          .then(({ user }) => {
            setAuthState(prev => ({
              ...prev,
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            }));
            // Clean up URL
            window.history.replaceState({}, document.title, '/dashboard');
          })
          .catch(err => {
            console.error('OAuth2 user fetch error:', err);
            setAuthState(prev => ({
              ...prev,
              error: 'OAuth2 authentication failed',
              isLoading: false,
            }));
          });
      } else if (error) {
        const errorMessages: Record<string, string> = {
          oauth_failed: 'OAuth2 authentication failed',
          oauth_error: 'OAuth2 authentication error',
          saml_failed: 'SAML authentication failed',
          saml_error: 'SAML authentication error',
        };
        
        setAuthState(prev => ({
          ...prev,
          error: errorMessages[error] || 'Authentication failed',
          isLoading: false,
        }));
      }
    };

    // Only handle callback on auth callback page
    if (window.location.pathname === '/auth/callback') {
      handleOAuth2Callback();
    }
  }, []);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    verifyMFA,
    logout,
    refreshToken,
    setupMFA,
    completeMFASetup,
    getAuthMethods,
    initiateOAuth2,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}