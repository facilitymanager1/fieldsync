/**
 * Standard API Response Types for FieldSync
 * Ensures consistent API responses across all endpoints
 */

export interface StandardAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends StandardAPIResponse<T[]> {
  pagination?: {
    current: number;
    pages: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Utility functions for consistent responses
export const createSuccessResponse = <T>(
  data?: T, 
  message?: string
): StandardAPIResponse<T> => ({
  success: true,
  data,
  message
});

export const createErrorResponse = (
  error: string, 
  message?: string
): StandardAPIResponse => ({
  success: false,
  error,
  message
});

export const createPaginatedResponse = <T>(
  data: T[],
  pagination: PaginatedResponse<T>['pagination'],
  message?: string
): PaginatedResponse<T> => ({
  success: true,
  data,
  pagination,
  message
});