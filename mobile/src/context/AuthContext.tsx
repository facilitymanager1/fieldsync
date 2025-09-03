import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole, Permission } from '../types/permissions';
import PermissionService, { PermissionCheckResult } from '../services/permissionService';

interface AuthContextType {
  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Authentication methods
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  
  // Permission methods
  hasPermission: (permission: Permission, context?: any) => Promise<PermissionCheckResult>;
  hasAnyPermission: (permissions: Permission[]) => Promise<PermissionCheckResult>;
  hasAllPermissions: (permissions: Permission[]) => Promise<PermissionCheckResult>;
  canAccessResource: (
    resourceType: string,
    resourceId: string,
    action: Permission,
    resourceData?: any
  ) => Promise<PermissionCheckResult>;
  
  // User management
  updateUser: (updates: Partial<User>) => Promise<void>;
  getUserRole: () => UserRole | null;
  getUserPermissions: () => Permission[];
  
  // Security
  validateSession: () => Promise<boolean>;
  lockAccount: () => Promise<void>;
  unlockAccount: () => Promise<void>;
  isAccountLocked: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

interface SessionData {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: number;
  lastActivity: number;
  failedAttempts: number;
  lockedUntil?: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      PermissionService.initialize(user);
    }
  }, [user]);

  /**
   * Initialize authentication on app startup
   */
  const initializeAuth = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      const storedSession = await AsyncStorage.getItem('auth_session');
      if (!storedSession) {
        setIsLoading(false);
        return;
      }

      const session: SessionData = JSON.parse(storedSession);
      
      // Check if account is locked
      if (session.lockedUntil && session.lockedUntil > Date.now()) {
        setIsAccountLocked(true);
        setIsLoading(false);
        return;
      }

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        const refreshed = await refreshTokenInternal(session.refreshToken);
        if (!refreshed) {
          await clearSession();
          setIsLoading(false);
          return;
        }
        return; // refreshTokenInternal will set the user
      }

      // Check session timeout
      const sessionTimeout = 30 * 60 * 1000; // 30 minutes
      const timeSinceLastActivity = Date.now() - session.lastActivity;
      
      if (timeSinceLastActivity > sessionTimeout) {
        await clearSession();
        setIsLoading(false);
        return;
      }

      // Valid session - restore user
      setUser(session.user);
      setIsAuthenticated(true);
      setSessionData(session);
      await updateLastActivity();
      
    } catch (error) {
      console.error('Error initializing auth:', error);
      await clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login user with username and password
   */
  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check if account is locked
      if (isAccountLocked) {
        return { success: false, error: 'Account is temporarily locked' };
      }

      // Simulate API call - replace with actual API integration
      const loginResponse = await mockLoginAPI(username, password);
      
      if (!loginResponse) {
        await handleFailedLogin();
        return { success: false, error: 'Invalid username or password' };
      }

      // Create session data
      const session: SessionData = {
        user: loginResponse.user,
        token: loginResponse.token,
        refreshToken: loginResponse.refreshToken,
        expiresAt: loginResponse.expiresAt,
        lastActivity: Date.now(),
        failedAttempts: 0
      };

      // Store session
      await AsyncStorage.setItem('auth_session', JSON.stringify(session));
      
      // Update state
      setUser(loginResponse.user);
      setIsAuthenticated(true);
      setSessionData(session);
      setIsAccountLocked(false);

      // Initialize permission service
      await PermissionService.initialize(loginResponse.user);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  /**
   * Logout user and clear session
   */
  const logout = async (): Promise<void> => {
    try {
      // Clear server session (API call)
      if (sessionData?.token) {
        await mockLogoutAPI(sessionData.token);
      }

      await clearSession();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local session even if server call fails
      await clearSession();
    }
  };

  /**
   * Refresh authentication token
   */
  const refreshToken = async (): Promise<boolean> => {
    if (!sessionData?.refreshToken) {
      return false;
    }

    return await refreshTokenInternal(sessionData.refreshToken);
  };

  /**
   * Internal refresh token implementation
   */
  const refreshTokenInternal = async (refreshTokenValue: string): Promise<boolean> => {
    try {
      const response = await mockRefreshTokenAPI(refreshTokenValue);
      
      if (!response) {
        await clearSession();
        return false;
      }

      const newSession: SessionData = {
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        expiresAt: response.expiresAt,
        lastActivity: Date.now(),
        failedAttempts: 0
      };

      await AsyncStorage.setItem('auth_session', JSON.stringify(newSession));
      
      setUser(response.user);
      setIsAuthenticated(true);
      setSessionData(newSession);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      await clearSession();
      return false;
    }
  };

  /**
   * Handle failed login attempt
   */
  const handleFailedLogin = async (): Promise<void> => {
    const currentSession = sessionData || { failedAttempts: 0 } as SessionData;
    const failedAttempts = currentSession.failedAttempts + 1;
    
    if (failedAttempts >= 5) {
      const lockDuration = 15 * 60 * 1000; // 15 minutes
      const lockedUntil = Date.now() + lockDuration;
      
      const lockedSession: SessionData = {
        ...currentSession,
        failedAttempts,
        lockedUntil
      };

      await AsyncStorage.setItem('auth_session', JSON.stringify(lockedSession));
      setIsAccountLocked(true);
      setSessionData(lockedSession);
    } else {
      const updatedSession: SessionData = {
        ...currentSession,
        failedAttempts
      };
      
      await AsyncStorage.setItem('auth_session', JSON.stringify(updatedSession));
      setSessionData(updatedSession);
    }
  };

  /**
   * Update last activity timestamp
   */
  const updateLastActivity = async (): Promise<void> => {
    if (!sessionData) return;

    const updatedSession: SessionData = {
      ...sessionData,
      lastActivity: Date.now()
    };

    await AsyncStorage.setItem('auth_session', JSON.stringify(updatedSession));
    setSessionData(updatedSession);
  };

  /**
   * Clear session data
   */
  const clearSession = async (): Promise<void> => {
    await AsyncStorage.multiRemove(['auth_session']);
    await PermissionService.clearStoredData();
    
    setUser(null);
    setIsAuthenticated(false);
    setSessionData(null);
    setIsAccountLocked(false);
  };

  // Permission wrapper methods
  const hasPermission = async (
    permission: Permission,
    context?: any
  ): Promise<PermissionCheckResult> => {
    return await PermissionService.hasPermission(permission, context);
  };

  const hasAnyPermission = async (permissions: Permission[]): Promise<PermissionCheckResult> => {
    return await PermissionService.hasAnyPermission(permissions);
  };

  const hasAllPermissions = async (permissions: Permission[]): Promise<PermissionCheckResult> => {
    return await PermissionService.hasAllPermissions(permissions);
  };

  const canAccessResource = async (
    resourceType: string,
    resourceId: string,
    action: Permission,
    resourceData?: any
  ): Promise<PermissionCheckResult> => {
    return await PermissionService.canAccessResource(
      resourceType as any,
      resourceId,
      action,
      resourceData
    );
  };

  // User management methods
  const updateUser = async (updates: Partial<User>): Promise<void> => {
    if (!user) return;

    const updatedUser: User = { ...user, ...updates };
    
    // Update server (API call)
    await mockUpdateUserAPI(updatedUser);
    
    // Update local state
    setUser(updatedUser);
    
    // Update session storage
    if (sessionData) {
      const updatedSession: SessionData = {
        ...sessionData,
        user: updatedUser
      };
      await AsyncStorage.setItem('auth_session', JSON.stringify(updatedSession));
      setSessionData(updatedSession);
    }
  };

  const getUserRole = (): UserRole | null => {
    return user?.role || null;
  };

  const getUserPermissions = (): Permission[] => {
    if (!user) return [];
    return PermissionService.getUserPermissions(user);
  };

  const validateSession = async (): Promise<boolean> => {
    if (!sessionData) return false;
    
    // Check if token is expired
    if (sessionData.expiresAt < Date.now()) {
      const refreshed = await refreshToken();
      return refreshed;
    }
    
    await updateLastActivity();
    return true;
  };

  const lockAccount = async (): Promise<void> => {
    const lockDuration = 15 * 60 * 1000; // 15 minutes
    const lockedUntil = Date.now() + lockDuration;
    
    if (sessionData) {
      const lockedSession: SessionData = {
        ...sessionData,
        lockedUntil
      };
      
      await AsyncStorage.setItem('auth_session', JSON.stringify(lockedSession));
      setSessionData(lockedSession);
    }
    
    setIsAccountLocked(true);
  };

  const unlockAccount = async (): Promise<void> => {
    if (sessionData?.lockedUntil) {
      const unlockedSession: SessionData = {
        ...sessionData,
        lockedUntil: undefined,
        failedAttempts: 0
      };
      
      await AsyncStorage.setItem('auth_session', JSON.stringify(unlockedSession));
      setSessionData(unlockedSession);
    }
    
    setIsAccountLocked(false);
  };

  const contextValue: AuthContextType = {
    // State
    user,
    isAuthenticated,
    isLoading,
    isAccountLocked,
    
    // Authentication methods
    login,
    logout,
    refreshToken,
    
    // Permission methods
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    
    // User management
    updateUser,
    getUserRole,
    getUserPermissions,
    
    // Security
    validateSession,
    lockAccount,
    unlockAccount
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Mock API functions - replace with actual API calls
const mockLoginAPI = async (
  username: string,
  password: string
): Promise<LoginResponse | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock user database
  const mockUsers: Record<string, { user: User; password: string }> = {
    'admin@company.com': {
      user: {
        id: 'user_1',
        username: 'admin@company.com',
        email: 'admin@company.com',
        firstName: 'System',
        lastName: 'Administrator',
        role: UserRole.ADMIN,
        permissions: [],
        sites: ['site_1', 'site_2'],
        departments: ['dept_1', 'dept_2'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      password: 'admin123'
    },
    'hr@company.com': {
      user: {
        id: 'user_2',
        username: 'hr@company.com',
        email: 'hr@company.com',
        firstName: 'HR',
        lastName: 'Manager',
        role: UserRole.HR,
        permissions: [],
        sites: ['site_1'],
        departments: ['dept_1'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      password: 'hr123'
    }
  };

  const mockUser = mockUsers[username];
  if (mockUser && mockUser.password === password) {
    return {
      user: mockUser.user,
      token: `token_${Date.now()}`,
      refreshToken: `refresh_${Date.now()}`,
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    };
  }

  return null;
};

const mockLogoutAPI = async (token: string): Promise<void> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('User logged out:', token);
};

const mockRefreshTokenAPI = async (refreshToken: string): Promise<LoginResponse | null> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // In real implementation, validate refresh token and return new tokens
  // For now, return null to simulate expired refresh token
  return null;
};

const mockUpdateUserAPI = async (user: User): Promise<void> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('User updated:', user.id);
};

export default AuthContext;