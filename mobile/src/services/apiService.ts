import OfflineService from './offlineService';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  version?: number;
}

export interface ApiRequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  useCache?: boolean;
  cacheTimeout?: number;
  priority?: 'low' | 'normal' | 'high';
}

class ApiService {
  private static instance: ApiService;
  private baseURL: string = 'http://localhost:3000/api';
  private defaultTimeout: number = 10000;
  private cache: Map<string, { data: any; timestamp: number; timeout: number }> = new Map();

  private constructor() {}

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  private async makeRequest<T>(
    url: string,
    options: RequestInit,
    config?: ApiRequestConfig
  ): Promise<ApiResponse<T>> {
    const isOnline = OfflineService.isDeviceOnline();
    
    // Check cache first if enabled and online
    if (config?.useCache && isOnline && options.method === 'GET') {
      const cachedResponse = this.getCachedResponse(url);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    if (!isOnline) {
      throw new Error('Device is offline. Data saved locally and will sync when online.');
    }

    const requestConfig = {
      timeout: config?.timeout || this.defaultTimeout,
      retries: config?.retries || 3,
      retryDelay: config?.retryDelay || 1000,
      ...config
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= requestConfig.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);

        const response = await fetch(`${this.baseURL}${url}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const apiResponse: ApiResponse<T> = {
          success: true,
          data,
          version: response.headers.get('X-Version') 
            ? parseInt(response.headers.get('X-Version')!) 
            : undefined
        };

        // Cache successful GET responses
        if (config?.useCache && options.method === 'GET') {
          this.setCachedResponse(url, apiResponse, config.cacheTimeout || 300000); // 5 minutes default
        }

        return apiResponse;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < requestConfig.retries) {
          await this.delay(requestConfig.retryDelay * Math.pow(2, attempt)); // Exponential backoff
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  async get<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, { method: 'GET' }, config);
  }

  async post<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    // Store offline if device is offline
    if (!OfflineService.isDeviceOnline() && data) {
      const pathParts = url.split('/').filter(part => part);
      const entityType = pathParts[0] || 'unknown';
      const entityId = data.id || `temp_${Date.now()}`;
      
      await OfflineService.storeData(entityType, entityId, data);
      
      return {
        success: true,
        data: { ...data, id: entityId, _offline: true },
        message: 'Data saved offline and will sync when online'
      };
    }

    return this.makeRequest<T>(url, {
      method: 'POST',
      body: JSON.stringify(data)
    }, config);
  }

  async put<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    // Handle offline updates
    if (!OfflineService.isDeviceOnline() && data) {
      const pathParts = url.split('/').filter(part => part);
      const entityType = pathParts[0] || 'unknown';
      const entityId = pathParts[1] || data.id || `temp_${Date.now()}`;
      
      await OfflineService.updateData(entityType, entityId, data);
      
      return {
        success: true,
        data: { ...data, _offline: true, _updated: true },
        message: 'Data updated offline and will sync when online'
      };
    }

    return this.makeRequest<T>(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, config);
  }

  async delete<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    // Handle offline deletes
    if (!OfflineService.isDeviceOnline()) {
      const pathParts = url.split('/').filter(part => part);
      const entityType = pathParts[0] || 'unknown';
      const entityId = pathParts[1] || `temp_${Date.now()}`;
      
      await OfflineService.deleteData(entityType, entityId);
      
      return {
        success: true,
        message: 'Delete queued for sync when online'
      };
    }

    return this.makeRequest<T>(url, { method: 'DELETE' }, config);
  }

  async uploadFile(
    entityType: string, 
    entityId: string, 
    fileData: { fileUri: string; metadata?: any },
    config?: ApiRequestConfig
  ): Promise<ApiResponse<any>> {
    // Store file offline if device is offline
    if (!OfflineService.isDeviceOnline()) {
      await OfflineService.storeFile(entityType, entityId, fileData.fileUri, fileData.metadata);
      
      return {
        success: true,
        data: { entityType, entityId, _offline: true },
        message: 'File stored offline and will upload when online'
      };
    }

    try {
      const formData = new FormData();
      
      // Add the file
      formData.append('file', {
        uri: fileData.fileUri,
        type: 'application/octet-stream',
        name: `${entityType}_${entityId}_${Date.now()}`
      } as any);

      // Add metadata
      if (fileData.metadata) {
        formData.append('metadata', JSON.stringify(fileData.metadata));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config?.timeout || 30000);

      const response = await fetch(`${this.baseURL}/upload/${entityType}/${entityId}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  // Batch operations for efficient sync
  async batchRequest<T>(requests: Array<{
    method: string;
    url: string;
    data?: any;
  }>): Promise<ApiResponse<T[]>> {
    if (!OfflineService.isDeviceOnline()) {
      throw new Error('Batch requests require online connection');
    }

    return this.makeRequest<T[]>('/batch', {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  }

  // Cache management
  private getCachedResponse(url: string): ApiResponse | null {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < cached.timeout) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(url);
    }
    
    return null;
  }

  private setCachedResponse(url: string, response: ApiResponse, timeout: number): void {
    this.cache.set(url, {
      data: response,
      timestamp: Date.now(),
      timeout
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // Health check and connectivity
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.get('/health', {
        timeout: 5000,
        retries: 1
      });
      return response.success;
    } catch (error) {
      return false;
    }
  }

  async ping(): Promise<number> {
    const start = Date.now();
    try {
      await this.get('/ping', {
        timeout: 5000,
        retries: 0
      });
      return Date.now() - start;
    } catch (error) {
      return -1;
    }
  }

  // Error handling helpers
  isNetworkError(error: any): boolean {
    return error.message?.includes('offline') || 
           error.message?.includes('network') ||
           error.name === 'NetworkError' ||
           error.code === 'NETWORK_ERROR';
  }

  isTimeoutError(error: any): boolean {
    return error.name === 'AbortError' || 
           error.message?.includes('timeout');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configuration
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }
}

export const ApiService = ApiService.getInstance();
export default ApiService;