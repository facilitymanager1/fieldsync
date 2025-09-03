/**
 * Centralized API Client for Consistent Data Fetching
 * Standardizes all API calls across the frontend
 */

import { APIResponse, PaginatedAPIResponse } from '../types/entities';

class APIClient {
  private baseURL: string;

  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Specialized methods for common patterns
  async getPaginated<T>(
    endpoint: string, 
    params?: Record<string, any>
  ): Promise<PaginatedAPIResponse<T>> {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' });
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Convenience hooks for common endpoints
export const useAPI = () => ({
  // Tickets
  getTickets: (params?: any) => 
    apiClient.getPaginated('/backend/tickets', params),
  
  createTicket: (ticketData: any) => 
    apiClient.post('/backend/tickets', ticketData),
  
  updateTicket: (id: string, updates: any) => 
    apiClient.put(`/backend/tickets/${id}`, updates),
  
  // Staff
  getStaff: () => 
    apiClient.get('/backend/staff'),
  
  // Analytics
  getAnalytics: (params?: any) => 
    apiClient.get('/backend/analytics', params),
});