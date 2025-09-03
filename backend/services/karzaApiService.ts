/**
 * Karza API Integration Service - Third-party API for document verification
 * 
 * Features:
 * - Aadhaar number validation and data extraction
 * - PAN number validation and verification
 * - Bank account verification (IFSC, Account Number)
 * - Document authentication
 * - Real-time validation with error handling
 * - Webhook support for async verification
 */

import axios, { AxiosInstance } from 'axios';

interface KarzaConfig {
  apiKey: string;
  apiSecret: string;
  baseURL: string;
  timeout: number;
}

interface AadhaarValidationRequest {
  aadhaarNumber: string;
  mobileNumber?: string;
  otp?: string;
  consentToken?: string;
}

interface AadhaarValidationResponse {
  success: boolean;
  data?: {
    name: string;
    dateOfBirth: string;
    gender: 'Male' | 'Female' | 'Other';
    address: {
      care_of?: string;
      house?: string;
      street?: string;
      locality?: string;
      village_tehsil?: string;
      district?: string;
      state?: string;
      pincode?: string;
    };
    photo?: string;
    verified: boolean;
    lastUpdated: string;
  };
  error?: string;
  validationId?: string;
  requiresOTP?: boolean;
}

interface PANValidationRequest {
  panNumber: string;
  name?: string;
  dateOfBirth?: string;
}

interface PANValidationResponse {
  success: boolean;
  data?: {
    panNumber: string;
    name: string;
    category: string;
    verified: boolean;
    status: 'Valid' | 'Invalid' | 'Deactivated';
    lastUpdated: string;
  };
  error?: string;
  validationId?: string;
}

interface BankAccountValidationRequest {
  accountNumber: string;
  ifscCode: string;
  name?: string;
}

interface BankAccountValidationResponse {
  success: boolean;
  data?: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName: string;
    branchAddress: string;
    accountHolderName: string;
    accountStatus: 'Active' | 'Inactive' | 'Closed';
    verified: boolean;
  };
  error?: string;
  validationId?: string;
}

interface CrossValidationRequest {
  aadhaarNumber: string;
  panNumber: string;
  bankAccount?: {
    accountNumber: string;
    ifscCode: string;
  };
  personalDetails: {
    name: string;
    dateOfBirth: string;
    mobileNumber: string;
  };
}

interface CrossValidationResponse {
  success: boolean;
  data?: {
    aadhaarPanMatch: boolean;
    nameMatch: boolean;
    dateOfBirthMatch: boolean;
    bankAccountMatch?: boolean;
    overallVerification: 'Verified' | 'Partial' | 'Failed';
    mismatchReasons?: string[];
  };
  error?: string;
  validationId?: string;
}

export class KarzaApiService {
  private client: AxiosInstance;
  private config: KarzaConfig;

  constructor(config: KarzaConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-API-Secret': config.apiSecret,
      },
    });

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`Karza API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Karza API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`Karza API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('Karza API Response Error:', error.response?.data || error.message);
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response;
      switch (status) {
        case 400:
          return new Error(`Invalid request: ${data.message || 'Bad request'}`);
        case 401:
          return new Error('Unauthorized: Invalid API credentials');
        case 403:
          return new Error('Forbidden: Insufficient permissions');
        case 404:
          return new Error('Not found: API endpoint not found');
        case 429:
          return new Error('Rate limit exceeded: Too many requests');
        case 500:
          return new Error('Server error: Karza API is temporarily unavailable');
        default:
          return new Error(`API error: ${data.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      return new Error('Network error: Unable to connect to Karza API');
    } else {
      return new Error(`Request error: ${error.message}`);
    }
  }

  /**
   * Validate Aadhaar number and extract personal information
   */
  async validateAadhaar(request: AadhaarValidationRequest): Promise<AadhaarValidationResponse> {
    try {
      // Step 1: Initiate Aadhaar verification
      const initiateResponse = await this.client.post('/aadhaar/verification/initiate', {
        aadhaar_number: request.aadhaarNumber,
        mobile_number: request.mobileNumber,
      });

      if (initiateResponse.data.requires_otp) {
        return {
          success: false,
          requiresOTP: true,
          validationId: initiateResponse.data.validation_id,
        };
      }

      // Step 2: Complete verification (with OTP if required)
      const payload: any = {
        validation_id: request.consentToken || initiateResponse.data.validation_id,
      };

      if (request.otp) {
        payload.otp = request.otp;
      }

      const verifyResponse = await this.client.post('/aadhaar/verification/complete', payload);

      if (!verifyResponse.data.success) {
        return {
          success: false,
          error: verifyResponse.data.error || 'Aadhaar verification failed',
        };
      }

      // Step 3: Parse and return verification data
      const aadhaarData = verifyResponse.data.data;
      
      return {
        success: true,
        data: {
          name: aadhaarData.name,
          dateOfBirth: this.formatDate(aadhaarData.date_of_birth),
          gender: aadhaarData.gender,
          address: {
            care_of: aadhaarData.address?.care_of,
            house: aadhaarData.address?.house,
            street: aadhaarData.address?.street,
            locality: aadhaarData.address?.locality,
            village_tehsil: aadhaarData.address?.village_tehsil,
            district: aadhaarData.address?.district,
            state: aadhaarData.address?.state,
            pincode: aadhaarData.address?.pincode,
          },
          photo: aadhaarData.photo_base64,
          verified: true,
          lastUpdated: new Date().toISOString(),
        },
        validationId: verifyResponse.data.validation_id,
      };

    } catch (error) {
      console.error('Aadhaar validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate PAN number and verify holder information
   */
  async validatePAN(request: PANValidationRequest): Promise<PANValidationResponse> {
    try {
      const response = await this.client.post('/pan/verification', {
        pan_number: request.panNumber,
        name: request.name,
        date_of_birth: request.dateOfBirth,
      });

      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error || 'PAN verification failed',
        };
      }

      const panData = response.data.data;

      return {
        success: true,
        data: {
          panNumber: panData.pan_number,
          name: panData.name,
          category: panData.category,
          verified: panData.verified,
          status: panData.status,
          lastUpdated: new Date().toISOString(),
        },
        validationId: response.data.validation_id,
      };

    } catch (error) {
      console.error('PAN validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate bank account details using IFSC and Account Number
   */
  async validateBankAccount(request: BankAccountValidationRequest): Promise<BankAccountValidationResponse> {
    try {
      const response = await this.client.post('/bank/account/verification', {
        account_number: request.accountNumber,
        ifsc_code: request.ifscCode,
        account_holder_name: request.name,
      });

      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error || 'Bank account verification failed',
        };
      }

      const bankData = response.data.data;

      return {
        success: true,
        data: {
          accountNumber: bankData.account_number,
          ifscCode: bankData.ifsc_code,
          bankName: bankData.bank_name,
          branchName: bankData.branch_name,
          branchAddress: bankData.branch_address,
          accountHolderName: bankData.account_holder_name,
          accountStatus: bankData.account_status,
          verified: bankData.verified,
        },
        validationId: response.data.validation_id,
      };

    } catch (error) {
      console.error('Bank account validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Perform cross-validation between Aadhaar, PAN, and Bank details
   */
  async performCrossValidation(request: CrossValidationRequest): Promise<CrossValidationResponse> {
    try {
      // Validate individual documents first
      const [aadhaarResult, panResult, bankResult] = await Promise.allSettled([
        this.validateAadhaar({ aadhaarNumber: request.aadhaarNumber }),
        this.validatePAN({ panNumber: request.panNumber, name: request.personalDetails.name }),
        request.bankAccount 
          ? this.validateBankAccount({
              accountNumber: request.bankAccount.accountNumber,
              ifscCode: request.bankAccount.ifscCode,
              name: request.personalDetails.name,
            })
          : Promise.resolve(null),
      ]);

      // Check if validations were successful
      const aadhaarData = aadhaarResult.status === 'fulfilled' && aadhaarResult.value.success 
        ? aadhaarResult.value.data 
        : null;
      
      const panData = panResult.status === 'fulfilled' && panResult.value.success 
        ? panResult.value.data 
        : null;
        
      const bankData = bankResult.status === 'fulfilled' && bankResult.value 
        ? bankResult.value.data 
        : null;

      // Perform cross-validations
      const mismatchReasons: string[] = [];
      
      // Aadhaar-PAN name match
      const aadhaarPanMatch = this.compareNames(
        aadhaarData?.name || '', 
        panData?.name || ''
      );
      if (!aadhaarPanMatch) {
        mismatchReasons.push('Aadhaar and PAN names do not match');
      }

      // Name match with provided details
      const nameMatch = this.compareNames(
        request.personalDetails.name,
        aadhaarData?.name || panData?.name || ''
      );
      if (!nameMatch) {
        mismatchReasons.push('Provided name does not match document names');
      }

      // Date of birth match
      const dateOfBirthMatch = aadhaarData?.dateOfBirth === request.personalDetails.dateOfBirth;
      if (!dateOfBirthMatch && aadhaarData?.dateOfBirth) {
        mismatchReasons.push('Date of birth does not match Aadhaar record');
      }

      // Bank account name match
      const bankAccountMatch = bankData 
        ? this.compareNames(request.personalDetails.name, bankData.accountHolderName)
        : undefined;
      if (bankAccountMatch === false) {
        mismatchReasons.push('Bank account holder name does not match');
      }

      // Determine overall verification status
      let overallVerification: 'Verified' | 'Partial' | 'Failed';
      if (mismatchReasons.length === 0) {
        overallVerification = 'Verified';
      } else if (aadhaarPanMatch && nameMatch) {
        overallVerification = 'Partial';
      } else {
        overallVerification = 'Failed';
      }

      return {
        success: true,
        data: {
          aadhaarPanMatch,
          nameMatch,
          dateOfBirthMatch,
          bankAccountMatch,
          overallVerification,
          mismatchReasons: mismatchReasons.length > 0 ? mismatchReasons : undefined,
        },
        validationId: `cross_val_${Date.now()}`,
      };

    } catch (error) {
      console.error('Cross-validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cross-validation failed',
      };
    }
  }

  /**
   * Get IFSC code details for bank validation
   */
  async getIFSCDetails(ifscCode: string): Promise<{
    success: boolean;
    data?: {
      ifsc: string;
      bankName: string;
      branchName: string;
      address: string;
      city: string;
      state: string;
      contact: string;
    };
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/ifsc/${ifscCode}`);

      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error || 'IFSC code not found',
        };
      }

      return {
        success: true,
        data: response.data.data,
      };

    } catch (error) {
      console.error('IFSC validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'IFSC validation failed',
      };
    }
  }

  /**
   * Webhook handler for async verification results
   */
  async handleWebhook(payload: any): Promise<boolean> {
    try {
      console.log('Karza webhook received:', payload);

      // Process webhook based on verification type
      switch (payload.verification_type) {
        case 'aadhaar':
          await this.processAadhaarWebhook(payload);
          break;
        case 'pan':
          await this.processPANWebhook(payload);
          break;
        case 'bank':
          await this.processBankWebhook(payload);
          break;
        default:
          console.warn('Unknown verification type:', payload.verification_type);
      }

      return true;
    } catch (error) {
      console.error('Webhook processing error:', error);
      return false;
    }
  }

  // Helper methods

  private formatDate(dateString: string): string {
    try {
      // Convert various date formats to DD/MM/YYYY
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB');
    } catch {
      return dateString; // Return as-is if parsing fails
    }
  }

  private compareNames(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;
    
    // Normalize names for comparison
    const normalize = (name: string) => 
      name.toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove special characters
          .replace(/\s+/g, ' ')    // Normalize spaces
          .trim();
    
    const normalizedName1 = normalize(name1);
    const normalizedName2 = normalize(name2);
    
    // Exact match
    if (normalizedName1 === normalizedName2) return true;
    
    // Check if one name contains the other (for cases like "John Doe" vs "John")
    const words1 = normalizedName1.split(' ');
    const words2 = normalizedName2.split(' ');
    
    // At least 80% of words should match
    const matchingWords = words1.filter(word1 => 
      words2.some(word2 => 
        word1.includes(word2) || word2.includes(word1) || 
        this.calculateSimilarity(word1, word2) > 0.8
      )
    );
    
    return matchingWords.length >= Math.min(words1.length, words2.length) * 0.8;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async processAadhaarWebhook(payload: any): Promise<void> {
    // Process Aadhaar verification webhook
    console.log('Processing Aadhaar webhook:', payload);
    // Implementation would update database with verification results
  }

  private async processPANWebhook(payload: any): Promise<void> {
    // Process PAN verification webhook
    console.log('Processing PAN webhook:', payload);
    // Implementation would update database with verification results
  }

  private async processBankWebhook(payload: any): Promise<void> {
    // Process Bank account verification webhook
    console.log('Processing Bank webhook:', payload);
    // Implementation would update database with verification results
  }
}

// Factory function to create configured service instance
export const createKarzaApiService = (): KarzaApiService => {
  const config: KarzaConfig = {
    apiKey: process.env.KARZA_API_KEY || '',
    apiSecret: process.env.KARZA_API_SECRET || '',
    baseURL: process.env.KARZA_API_BASE_URL || 'https://api.karza.in/v3',
    timeout: parseInt(process.env.KARZA_API_TIMEOUT || '30000'),
  };

  if (!config.apiKey || !config.apiSecret) {
    throw new Error('Karza API credentials not configured');
  }

  return new KarzaApiService(config);
};

export default KarzaApiService;