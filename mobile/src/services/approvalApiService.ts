/**
 * Approval API Service - Frontend service for HR approval workflow
 * Handles all API communication for approval operations
 */

import { 
  EmployeeApprovalSummary, 
  ApprovalFilters, 
  ApprovalStats, 
  EmployeeStatus,
  UpdateApprovalData 
} from '../types/approval';

// API Base URL - should be configured based on environment
const API_BASE_URL = process.env.REACT_NATIVE_API_URL || 'http://localhost:3000/api';

interface ApprovalResponse {
  approvals: EmployeeApprovalSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}


class ApprovalApiService {
  
  /**
   * Get approval records with filtering and pagination
   */
  async getApprovals(filters: ApprovalFilters = {}, page: number = 1, limit: number = 20): Promise<ApprovalResponse> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      // Add filter parameters
      if (filters.status && filters.status.length > 0) {
        queryParams.append('status', filters.status.join(','));
      }
      if (filters.validationStatus) {
        queryParams.append('validationStatus', filters.validationStatus);
      }
      if (filters.searchQuery) {
        queryParams.append('search', filters.searchQuery);
      }
      if (filters.priority && filters.priority.length > 0) {
        queryParams.append('priority', filters.priority.join(','));
      }
      if (filters.submittedDateRange) {
        queryParams.append('fromDate', filters.submittedDateRange.from.toISOString());
        queryParams.append('toDate', filters.submittedDateRange.to.toISOString());
      }

      const response = await fetch(`${API_BASE_URL}/approvals?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform backend data to frontend format
      return {
        approvals: data.approvals.map(this.transformApprovalData),
        pagination: data.pagination
      };

    } catch (error) {
      console.error('Error fetching approvals:', error);
      throw new Error('Failed to fetch approvals');
    }
  }

  /**
   * Get approval statistics for dashboard
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/approvals/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error fetching approval stats:', error);
      throw new Error('Failed to fetch approval statistics');
    }
  }

  /**
   * Update single approval record
   */
  async updateApproval(approvalId: string, updateData: UpdateApprovalData): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/approvals/${approvalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error updating approval:', error);
      throw new Error('Failed to update approval');
    }
  }

  /**
   * Bulk update multiple approvals
   */
  async bulkUpdateApprovals(approvalIds: string[], updateData: UpdateApprovalData): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/approvals/bulk-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
        body: JSON.stringify({
          approvalIds,
          updateData
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error bulk updating approvals:', error);
      throw new Error('Failed to bulk update approvals');
    }
  }

  /**
   * Get specific approval details
   */
  async getApprovalDetails(approvalId: string): Promise<EmployeeApprovalSummary> {
    try {
      const response = await fetch(`${API_BASE_URL}/approvals/${approvalId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.transformApprovalData(data);

    } catch (error) {
      console.error('Error fetching approval details:', error);
      throw new Error('Failed to fetch approval details');
    }
  }

  /**
   * Generate permanent employee ID
   */
  async generatePermanentId(approvalId: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/approvals/${approvalId}/generate-permanent-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.permanentId;

    } catch (error) {
      console.error('Error generating permanent ID:', error);
      throw new Error('Failed to generate permanent ID');
    }
  }

  /**
   * Get approval history/events
   */
  async getApprovalHistory(approvalId: string): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/approvals/${approvalId}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error fetching approval history:', error);
      throw new Error('Failed to fetch approval history');
    }
  }

  /**
   * Export approvals data
   */
  async exportApprovals(filters: ApprovalFilters = {}, format: 'csv' | 'excel' = 'csv'): Promise<string> {
    try {
      const queryParams = new URLSearchParams({
        format
      });

      // Add filter parameters
      if (filters.status && filters.status.length > 0) {
        queryParams.append('status', filters.status.join(','));
      }
      if (filters.validationStatus) {
        queryParams.append('validationStatus', filters.validationStatus);
      }
      if (filters.searchQuery) {
        queryParams.append('search', filters.searchQuery);
      }

      const response = await fetch(`${API_BASE_URL}/approvals/export?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': await this.getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Return the download URL or blob URL
      const blob = await response.blob();
      return URL.createObjectURL(blob);

    } catch (error) {
      console.error('Error exporting approvals:', error);
      throw new Error('Failed to export approvals');
    }
  }

  /**
   * Transform backend approval data to frontend format
   */
  private transformApprovalData(backendData: any): EmployeeApprovalSummary {
    return {
      id: backendData._id,
      tempId: backendData.tempId,
      permanentId: backendData.permanentId,
      profilePhoto: backendData.onboardingRecordId?.personalInfo?.profilePhoto,
      name: backendData.onboardingRecordId?.personalInfo?.aadhaarName || 'Unknown',
      phoneNumber: backendData.onboardingRecordId?.personalInfo?.mobileNumber || '',
      status: backendData.status,
      validationChecks: {
        hr: backendData.validationChecks?.hr || false,
        esi: backendData.validationChecks?.esi || false,
        pf: backendData.validationChecks?.pf || false,
        uan: backendData.validationChecks?.uan || false,
      },
      rejectionReason: backendData.rejectionReason,
      submittedAt: new Date(backendData.submittedAt),
      approvedAt: backendData.approvedAt ? new Date(backendData.approvedAt) : undefined,
      priority: backendData.priority || 'medium',
    };
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string> {
    // This should integrate with your authentication system
    // For now, returning a placeholder
    try {
      // Import your auth service here
      // const { authService } = await import('./authService');
      // return await authService.getToken();
      
      // Placeholder - replace with actual auth token retrieval
      return 'Bearer your-auth-token';
    } catch (error) {
      throw new Error('Authentication required');
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any, operation: string): never {
    console.error(`${operation} failed:`, error);
    
    if (error.response) {
      // HTTP error response
      throw new Error(`${operation} failed: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.request) {
      // Network error
      throw new Error(`${operation} failed: Network error`);
    } else {
      // Other error
      throw new Error(`${operation} failed: ${error.message}`);
    }
  }
}

export const approvalApiService = new ApprovalApiService();