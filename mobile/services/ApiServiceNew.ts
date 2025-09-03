// Enhanced API Service for FieldSync Mobile App
// Handles all backend communication with authentication and real-time features

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
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
  private baseURL: string;
  private authToken: string | null = null;

  constructor() {
    this.baseURL = __DEV__ 
      ? 'http://localhost:3001/api' 
      : 'https://api.fieldsync.app/api';
  }

  // Authentication methods
  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuthToken() {
    this.authToken = null;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async handleResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'API request failed');
      }
      
      return data;
    } else {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.text();
    }
  }

  // Generic HTTP methods
  async get(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('GET request failed:', error);
      throw error;
    }
  }

  async post(endpoint: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('POST request failed:', error);
      throw error;
    }
  }

  async put(endpoint: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('PUT request failed:', error);
      throw error;
    }
  }

  async delete(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('DELETE request failed:', error);
      throw error;
    }
  }

  // Authentication API
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.post('/auth/login', { email, password });
  }

  async register(userData: any): Promise<any> {
    return this.post('/auth/register', userData);
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.get('/auth/me');
  }

  async updateProfile(profileData: any): Promise<any> {
    return this.put('/auth/profile', profileData);
  }

  // Tickets API
  async getTickets(params?: any): Promise<any> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/tickets${queryString}`);
  }

  async getTicketById(id: string): Promise<any> {
    return this.get(`/tickets/${id}`);
  }

  async createTicket(ticketData: any): Promise<any> {
    return this.post('/tickets', ticketData);
  }

  async updateTicket(id: string, ticketData: any): Promise<any> {
    return this.put(`/tickets/${id}`, ticketData);
  }

  async deleteTicket(id: string): Promise<any> {
    return this.delete(`/tickets/${id}`);
  }

  async addTicketComment(id: string, comment: any): Promise<any> {
    return this.post(`/tickets/${id}/comments`, comment);
  }

  // Location API
  async updateLocation(locationData: any): Promise<any> {
    return this.post('/locations', locationData);
  }

  async getLocationHistory(params?: any): Promise<any> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/locations${queryString}`);
  }

  // Analytics API
  async getAnalytics(params?: any): Promise<any> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/analytics${queryString}`);
  }

  async getTicketStats(): Promise<any> {
    return this.get('/tickets/stats');
  }

  async getDashboardMetrics(): Promise<any> {
    return this.get('/analytics/dashboard');
  }

  // Reports API
  async getReports(params?: any): Promise<any> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/service-reports${queryString}`);
  }

  async createReport(reportData: any): Promise<any> {
    return this.post('/service-reports', reportData);
  }

  async updateReport(id: string, reportData: any): Promise<any> {
    return this.put(`/service-reports/${id}`, reportData);
  }

  // Staff API
  async getStaff(params?: any): Promise<any> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.get(`/staff${queryString}`);
  }

  async updateStaffStatus(id: string, status: any): Promise<any> {
    return this.put(`/staff/${id}/status`, status);
  }

  // Geofence API
  async getGeofences(): Promise<any> {
    return this.get('/geofences');
  }

  async checkGeofenceEntry(geofenceData: any): Promise<any> {
    return this.post('/geofences/check', geofenceData);
  }

  // Sync API for offline data
  async syncData(syncPayload: any): Promise<any> {
    return this.post('/sync', syncPayload);
  }

  async getLastSyncTime(): Promise<any> {
    return this.get('/sync/last-sync');
  }
}

// Export singleton instance
export default new ApiService();
