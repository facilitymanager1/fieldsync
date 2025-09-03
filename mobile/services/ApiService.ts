// Enhanced API Service for FieldSync Mobile App
// Handles all backend communication with authentication and real-time features

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface User {
  id: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
    department?: string;
  };
  isActive: boolean;
}

class ApiService {
  private baseUrl: string;
  private authTokens: AuthTokens | null = null;

  constructor() {
    // Use environment variable or default to localhost
    this.baseUrl = __DEV__ 
      ? 'http://localhost:3001/api' 
      : 'https://your-production-api.com/api';
    
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const tokens = await AsyncStorage.getItem('auth_tokens');
      if (tokens) {
        this.authTokens = JSON.parse(tokens);
      }
    } catch (error) {
      console.error('Failed to load auth tokens:', error);
    }
  }

  private async saveAuthTokens(tokens: AuthTokens): Promise<void> {
    try {
      this.authTokens = tokens;
      await AsyncStorage.setItem('auth_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to save auth tokens:', error);
    }
  }

  private async getAuthHeader(): Promise<{ [key: string]: string }> {
    if (this.authTokens && this.authTokens.expiresAt > Date.now()) {
      return {
        'Authorization': `Bearer ${this.authTokens.accessToken}`
      };
    }
    
    // Try to refresh token
    if (this.authTokens?.refreshToken) {
      try {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return {
            'Authorization': `Bearer ${this.authTokens.accessToken}`
          };
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }
    
    return {};
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const authHeader = await this.getAuthHeader();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // === AUTHENTICATION METHODS ===
  
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.makeRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data?.tokens) {
      await this.saveAuthTokens(response.data.tokens);
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.authTokens = null;
      await AsyncStorage.removeItem('auth_tokens');
    }
  }

  async refreshToken(): Promise<boolean> {
    if (!this.authTokens?.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.authTokens.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await this.saveAuthTokens(data.tokens);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  // === SERVICE REPORT ENDPOINTS ===
  
  async getServiceReports(filters?: { staffId?: string; facilityId?: string }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams(filters || {}).toString();
    const endpoint = queryParams ? `/service-reports?${queryParams}` : '/service-reports';
    return this.makeRequest(endpoint);
  }

  async createServiceReport(reportData: any): Promise<ApiResponse> {
    return this.makeRequest('/service-reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  async submitServiceReport(reportId: string): Promise<ApiResponse> {
    return this.makeRequest(`/service-reports/${reportId}/submit`, {
      method: 'POST',
    });
  }

  // === SHIFT MANAGEMENT ENDPOINTS ===
  
  async getShifts(staffId: string): Promise<ApiResponse> {
    return this.makeRequest(`/shifts?staffId=${staffId}`);
  }

  async startShift(shiftId: string, data: { location: any; deviceInfo: any }): Promise<ApiResponse> {
    return this.makeRequest(`/shifts/${shiftId}/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async endShift(shiftId: string, data: { location: any; deviceInfo: any }): Promise<ApiResponse> {
    return this.makeRequest(`/shifts/${shiftId}/end`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startBreak(shiftId: string, data: { location: any; deviceInfo: any }): Promise<ApiResponse> {
    return this.makeRequest(`/shifts/${shiftId}/break/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async endBreak(shiftId: string, breakId: string, data: { location: any; deviceInfo: any }): Promise<ApiResponse> {
    return this.makeRequest(`/shifts/${shiftId}/break/${breakId}/end`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // === LOCATION TRACKING ENDPOINTS ===
  
  async submitLocationBatch(locations: any[]): Promise<ApiResponse> {
    return this.makeRequest('/location/batch', {
      method: 'POST',
      body: JSON.stringify({ locations }),
    });
  }

  // === COMMUNICATION ENDPOINTS ===
  
  async sendMessage(message: any): Promise<ApiResponse> {
    return this.makeRequest('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async updateMessage(messageId: string, data: any): Promise<ApiResponse> {
    return this.makeRequest(`/chat/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMessage(messageId: string): Promise<ApiResponse> {
    return this.makeRequest(`/chat/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async markMessageAsRead(messageId: string): Promise<ApiResponse> {
    return this.makeRequest(`/chat/messages/${messageId}/read`, {
      method: 'POST',
    });
  }

  async createThread(data: any): Promise<ApiResponse> {
    return this.makeRequest('/chat/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getThreads(): Promise<ApiResponse> {
    return this.makeRequest('/chat/threads');
  }

  async getThreadMessages(threadId: string, params?: any): Promise<ApiResponse> {
    const queryParams = new URLSearchParams(params || {}).toString();
    const endpoint = queryParams ? `/chat/threads/${threadId}/messages?${queryParams}` : `/chat/threads/${threadId}/messages`;
    return this.makeRequest(endpoint);
  }

  async searchMessages(params: any): Promise<ApiResponse> {
    const queryParams = new URLSearchParams(params).toString();
    return this.makeRequest(`/chat/search?${queryParams}`);
  }

  async createTicketFromMessage(data: any): Promise<ApiResponse> {
    return this.makeRequest('/chat/tickets/from-message', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createChatTicket(data: any): Promise<ApiResponse> {
    return this.makeRequest('/chat/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTicketStatus(ticketId: string, data: any): Promise<ApiResponse> {
    return this.makeRequest(`/chat/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async assignTicket(ticketId: string, data: any): Promise<ApiResponse> {
    return this.makeRequest(`/chat/tickets/${ticketId}/assign`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getThreadTickets(threadId: string): Promise<ApiResponse> {
    return this.makeRequest(`/chat/threads/${threadId}/tickets`);
  }

  async generateAISuggestions(data: any): Promise<ApiResponse> {
    return this.makeRequest('/chat/ai/suggestions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSmartReplies(messageId: string): Promise<ApiResponse> {
    return this.makeRequest(`/chat/ai/smart-replies/${messageId}`);
  }

  async uploadChatAttachment(formData: FormData): Promise<ApiResponse> {
    const authHeader = await this.getAuthHeader();
    try {
      const response = await fetch(`${this.baseUrl}/chat/upload`, {
        method: 'POST',
        headers: authHeader,
        body: formData,
      });

      const result = await response.json();
      return {
        success: response.ok,
        data: result.data,
        message: result.message,
        error: response.ok ? undefined : result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // === FACIAL RECOGNITION ENDPOINTS ===
  
  async enrollFace(userData: {
    userId: string;
    images: string[];
    deviceInfo: any;
  }): Promise<ApiResponse> {
    return this.makeRequest('/facial-recognition/enroll', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async submitAttendance(record: {
    userId: string;
    imageData: string;
    attendanceType: 'check_in' | 'check_out';
    location: any;
    deviceInfo: any;
  }): Promise<ApiResponse> {
    return this.makeRequest('/facial-recognition/attendance', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  // === UTILITY METHODS ===
  
  isAuthenticated(): boolean {
    return !!(this.authTokens && this.authTokens.expiresAt > Date.now());
  }

  getUser(): User | null {
    // In a real app, you'd store user info separately
    return null;
  }

  // Legacy methods for backward compatibility
  setAuthToken(token: string) {
    // This is handled internally now
  }

  clearAuthToken() {
    this.authTokens = null;
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { 
      token: (response.data as any)?.tokens?.accessToken || (response.data as any)?.token, 
      user: (response.data as any)?.user || response.data 
    };
  }

  async get(endpoint: string): Promise<any> {
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  async getGeofences(): Promise<ApiResponse> {
    return this.makeRequest('/geofences');
  }

  async checkGeofenceEntry(data: any): Promise<ApiResponse> {
    return this.makeRequest('/geofences/check', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export default new ApiService();
