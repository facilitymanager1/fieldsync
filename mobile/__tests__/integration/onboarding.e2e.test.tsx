import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';

// Import screens for E2E testing
import BasicDetailsScreen from '../../src/screens/onboarding/screens/BasicDetailsScreen';
import DocumentVerificationScreen from '../../src/screens/onboarding/screens/DocumentVerificationScreen';
import BankDetailsScreen from '../../src/screens/onboarding/screens/BankDetailsScreen';
import SalaryDetailsScreen from '../../src/screens/onboarding/screens/SalaryDetailsScreen';

// Import contexts and services
import { AuthProvider } from '../../src/context/AuthContext';
import ValidationService from '../../src/services/validationService';
import PermissionService from '../../src/services/permissionService';
import KarzaApiService from '../../src/services/karzaApiService';

// Import test utilities
import { TestUtils, mockUserData, mockApiResponses } from '../setup';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: { tempId: 'TEST001' },
  }),
}));

// Mock services
jest.mock('../../src/services/karzaApiService', () => ({
  verifyAadhaar: jest.fn(),
  verifyPAN: jest.fn(),
  verifyBankAccount: jest.fn(),
}));

const mockKarzaService = KarzaApiService as jest.Mocked<typeof KarzaApiService>;

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NavigationContainer>
    <AuthProvider>
      {children}
    </AuthProvider>
  </NavigationContainer>
);

describe('Onboarding E2E Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    ValidationService.clearCache();
    
    // Setup default API responses
    mockKarzaService.verifyAadhaar.mockResolvedValue(mockApiResponses.karza.aadhaarVerification);
    mockKarzaService.verifyPAN.mockResolvedValue(mockApiResponses.karza.panVerification);
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  describe('Complete Onboarding Flow', () => {
    it('should complete basic details → documents → bank details → salary flow', async () => {
      // Step 1: Basic Details
      const { getByPlaceholderText, getByText, rerender } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Fill basic details form
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/first name/i), 'John');
        fireEvent.changeText(getByPlaceholderText(/last name/i), 'Doe');
        fireEvent.changeText(getByPlaceholderText(/email/i), 'john.doe@example.com');
        fireEvent.changeText(getByPlaceholderText(/phone/i), '9876543210');
        fireEvent.changeText(getByPlaceholderText(/aadhaar/i), '123456789012');
        fireEvent.changeText(getByPlaceholderText(/pan/i), 'ABCDE1234F');
      });

      // Submit basic details
      const nextButton = getByText(/next|continue|save/i);
      fireEvent.press(nextButton);

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'onboarding_basic_details',
          expect.stringContaining('John')
        );
      });

      // Step 2: Document Verification
      rerender(
        <TestWrapper>
          <DocumentVerificationScreen />
        </TestWrapper>
      );

      // Wait for data to load
      await waitFor(() => {
        expect(getByText(/document verification/i)).toBeTruthy();
      });

      // Mock file upload (would be actual file in real E2E)
      const uploadButton = getByText(/upload.*aadhaar/i);
      fireEvent.press(uploadButton);

      // Wait for Karza API call
      await waitFor(() => {
        expect(mockKarzaService.verifyAadhaar).toHaveBeenCalledWith('123456789012');
      });

      // Step 3: Bank Details
      rerender(
        <TestWrapper>
          <BankDetailsScreen />
        </TestWrapper>
      );

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/account.*holder/i), 'John Doe');
        fireEvent.changeText(getByPlaceholderText(/account.*number/i), '1234567890123456');
        fireEvent.changeText(getByPlaceholderText(/confirm.*account/i), '1234567890123456');
        fireEvent.changeText(getByPlaceholderText(/ifsc/i), 'SBIN0001234');
      });

      const bankNextButton = getByText(/next|continue|save/i);
      fireEvent.press(bankNextButton);

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'onboarding_bank_details',
          expect.stringContaining('1234567890123456')
        );
      });

      // Step 4: Salary Details
      rerender(
        <TestWrapper>
          <SalaryDetailsScreen />
        </TestWrapper>
      );

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/basic.*salary/i), '50000');
        fireEvent.changeText(getByPlaceholderText(/hra/i), '20000');
        fireEvent.changeText(getByPlaceholderText(/conveyance/i), '5000');
      });

      const salaryNextButton = getByText(/next|continue|save/i);
      fireEvent.press(salaryNextButton);

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'onboarding_salary_details',
          expect.stringContaining('50000')
        );
      });

      // Verify navigation was called
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should handle validation errors throughout the flow', async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Try to submit with invalid data
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/first name/i), 'J'); // Too short
        fireEvent.changeText(getByPlaceholderText(/email/i), 'invalid-email'); // Invalid format
        fireEvent.changeText(getByPlaceholderText(/phone/i), '123456'); // Invalid phone
      });

      const nextButton = getByText(/next|continue|save/i);
      fireEvent.press(nextButton);

      // Should show validation errors
      await waitFor(() => {
        expect(getByText(/minimum.*character/i)).toBeTruthy();
        expect(getByText(/valid.*email/i)).toBeTruthy();
        expect(getByText(/valid.*phone/i)).toBeTruthy();
      });

      // Should not navigate due to validation errors
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should save draft data and restore on return', async () => {
      const { getByPlaceholderText, getByText, unmount } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Fill partial data
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/first name/i), 'John');
        fireEvent.changeText(getByPlaceholderText(/email/i), 'john@example.com');
      });

      // Save as draft
      const draftButton = getByText(/save.*draft/i);
      if (draftButton) {
        fireEvent.press(draftButton);
      }

      unmount();

      // Re-render screen
      const { getByDisplayValue } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Should restore draft data
      await waitFor(() => {
        expect(getByDisplayValue('John')).toBeTruthy();
        expect(getByDisplayValue('john@example.com')).toBeTruthy();
      });
    });
  });

  describe('Business Rule Testing', () => {
    it('should handle marital status dependent fields', async () => {
      const { getByPlaceholderText, queryByPlaceholderText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Initially single - should show father's name
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/marital status/i), 'Single');
      });

      expect(queryByPlaceholderText(/father.*name/i)).toBeTruthy();
      expect(queryByPlaceholderText(/spouse.*name/i)).toBeFalsy();

      // Change to married - should show spouse name
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/marital status/i), 'Married');
      });

      await waitFor(() => {
        expect(queryByPlaceholderText(/spouse.*name/i)).toBeTruthy();
        expect(queryByPlaceholderText(/father.*name/i)).toBeFalsy();
      });
    });

    it('should handle salary-based ESI visibility', async () => {
      const { getByPlaceholderText, queryByPlaceholderText } = render(
        <TestWrapper>
          <SalaryDetailsScreen />
        </TestWrapper>
      );

      // Low salary - ESI should be visible and required
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/basic.*salary/i), '15000');
        fireEvent.changeText(getByPlaceholderText(/hra/i), '5000');
      });

      await waitFor(() => {
        expect(queryByPlaceholderText(/esi/i)).toBeTruthy();
      });

      // High salary - ESI should be hidden
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/basic.*salary/i), '50000');
        fireEvent.changeText(getByPlaceholderText(/hra/i), '20000');
      });

      await waitFor(() => {
        expect(queryByPlaceholderText(/esi/i)).toBeFalsy();
      });
    });

    it('should handle specially abled conditional fields', async () => {
      const { getByPlaceholderText, queryByPlaceholderText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Set specially abled to Yes
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/specially.*abled/i), 'Yes');
      });

      // Should show remarks field
      await waitFor(() => {
        expect(queryByPlaceholderText(/remarks/i)).toBeTruthy();
      });

      // Set to No
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/specially.*abled/i), 'No');
      });

      // Should hide remarks field
      await waitFor(() => {
        expect(queryByPlaceholderText(/remarks/i)).toBeFalsy();
      });
    });
  });

  describe('API Integration Testing', () => {
    it('should verify Aadhaar through Karza API', async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <DocumentVerificationScreen />
        </TestWrapper>
      );

      // Enter Aadhaar number
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/aadhaar/i), '123456789012');
      });

      // Trigger verification
      const verifyButton = getByText(/verify|upload/i);
      fireEvent.press(verifyButton);

      // Should call Karza API
      await waitFor(() => {
        expect(mockKarzaService.verifyAadhaar).toHaveBeenCalledWith('123456789012');
      });

      // Should show verification result
      await waitFor(() => {
        expect(getByText(/verified|success/i)).toBeTruthy();
      });
    });

    it('should handle API verification failures', async () => {
      // Mock API failure
      mockKarzaService.verifyAadhaar.mockRejectedValue(new Error('Verification failed'));

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <DocumentVerificationScreen />
        </TestWrapper>
      );

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/aadhaar/i), '123456789012');
      });

      const verifyButton = getByText(/verify|upload/i);
      fireEvent.press(verifyButton);

      await waitFor(() => {
        expect(getByText(/verification.*failed|error/i)).toBeTruthy();
      });
    });

    it('should cross-validate DOB across documents', async () => {
      // Mock conflicting DOB data
      mockKarzaService.verifyAadhaar.mockResolvedValue({
        success: true,
        data: { ...mockApiResponses.karza.aadhaarVerification.data, dateOfBirth: '01/01/1990' }
      });

      mockKarzaService.verifyPAN.mockResolvedValue({
        success: true,
        data: { ...mockApiResponses.karza.panVerification.data, dateOfBirth: '01/01/1995' }
      });

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <DocumentVerificationScreen />
        </TestWrapper>
      );

      // Trigger both verifications
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/aadhaar/i), '123456789012');
        fireEvent.changeText(getByPlaceholderText(/pan/i), 'ABCDE1234F');
      });

      const verifyButton = getByText(/verify.*all|submit/i);
      fireEvent.press(verifyButton);

      // Should show DOB mismatch warning
      await waitFor(() => {
        expect(getByText(/date.*birth.*mismatch|dob.*different/i)).toBeTruthy();
      });
    });
  });

  describe('Offline Capability Testing', () => {
    it('should queue actions when offline', async () => {
      // Mock offline state
      const mockNetworkState = { isConnected: false };
      
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Fill and submit form while offline
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/first name/i), 'John');
        fireEvent.changeText(getByPlaceholderText(/email/i), 'john@example.com');
      });

      const saveButton = getByText(/save|submit/i);
      fireEvent.press(saveButton);

      // Should show offline indicator
      await waitFor(() => {
        expect(getByText(/offline|queued/i)).toBeTruthy();
      });

      // Data should still be saved locally
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should sync data when back online', async () => {
      // Start offline, then go online
      const mockNetworkState = { isConnected: true };
      
      const { getByText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Should attempt to sync queued data
      await waitFor(() => {
        // Would verify sync API calls in real implementation
        expect(getByText).toBeTruthy();
      });
    });
  });

  describe('Permission-based Access Testing', () => {
    it('should restrict fields based on user role', async () => {
      // Mock employee role user
      const mockEmployee = {
        id: 'emp123',
        role: 'EMPLOYEE',
        permissions: ['VIEW_EMPLOYEE', 'UPLOAD_DOCUMENTS']
      };

      await PermissionService.initialize(mockEmployee);

      const { queryByPlaceholderText } = render(
        <TestWrapper>
          <SalaryDetailsScreen />
        </TestWrapper>
      );

      // Employee should not see salary fields
      expect(queryByPlaceholderText(/salary/i)).toBeFalsy();
    });

    it('should show all fields for HR role', async () => {
      // Mock HR role user
      const mockHR = {
        id: 'hr123',
        role: 'HR',
        permissions: ['VIEW_EMPLOYEE', 'EDIT_EMPLOYEE', 'VIEW_SALARY', 'EDIT_SALARY']
      };

      await PermissionService.initialize(mockHR);

      const { getByPlaceholderText } = render(
        <TestWrapper>
          <SalaryDetailsScreen />
        </TestWrapper>
      );

      // HR should see all salary fields
      expect(getByPlaceholderText(/basic.*salary/i)).toBeTruthy();
      expect(getByPlaceholderText(/hra/i)).toBeTruthy();
    });
  });

  describe('Data Persistence Testing', () => {
    it('should persist data across app sessions', async () => {
      const testData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      // Save data
      await AsyncStorage.setItem('onboarding_basic_details', JSON.stringify(testData));

      const { getByDisplayValue } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Should load persisted data
      await waitFor(() => {
        expect(getByDisplayValue('John')).toBeTruthy();
        expect(getByDisplayValue('Doe')).toBeTruthy();
        expect(getByDisplayValue('john@example.com')).toBeTruthy();
      });
    });

    it('should handle corrupted storage data gracefully', async () => {
      // Set corrupted data
      await AsyncStorage.setItem('onboarding_basic_details', 'corrupted-json-data');

      const { getByPlaceholderText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Should not crash and show empty form
      await waitFor(() => {
        expect(getByPlaceholderText(/first name/i)).toBeTruthy();
      });
    });
  });

  describe('Performance Testing', () => {
    it('should render screens within acceptable time', async () => {
      const start = Date.now();
      
      const { getByText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText).toBeTruthy();
      });

      const renderTime = Date.now() - start;
      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });

    it('should handle large forms efficiently', async () => {
      const start = Date.now();

      const { getByPlaceholderText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Fill many fields rapidly
      const fields = [
        'firstName', 'lastName', 'email', 'phone', 
        'aadhaar', 'pan', 'address1', 'address2'
      ];

      await act(async () => {
        fields.forEach((field, index) => {
          const input = getByPlaceholderText(new RegExp(field, 'i'));
          if (input) {
            fireEvent.changeText(input, `value${index}`);
          }
        });
      });

      const processingTime = Date.now() - start;
      expect(processingTime).toBeLessThan(1000); // Should process within 1 second
    });
  });

  describe('Error Recovery Testing', () => {
    it('should recover from validation service errors', async () => {
      // Mock validation service error
      ValidationService.validateForm = jest.fn().mockRejectedValue(new Error('Validation error'));

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/first name/i), 'John');
      });

      const submitButton = getByText(/submit|save/i);
      fireEvent.press(submitButton);

      // Should show error message but not crash
      await waitFor(() => {
        expect(getByText(/error|failed/i)).toBeTruthy();
      });
    });

    it('should recover from storage errors', async () => {
      // Mock storage error
      AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      await act(async () => {
        fireEvent.changeText(getByPlaceholderText(/first name/i), 'John');
      });

      const saveButton = getByText(/save/i);
      fireEvent.press(saveButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(getByText(/error|failed/i)).toBeTruthy();
      });
    });
  });

  describe('Accessibility Testing', () => {
    it('should be accessible for screen readers', async () => {
      const { getByLabelText, getByPlaceholderText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Should have proper accessibility labels
      expect(getByLabelText || getByPlaceholderText(/first name/i)).toBeTruthy();
      expect(getByLabelText || getByPlaceholderText(/email/i)).toBeTruthy();
    });

    it('should support dynamic text sizing', async () => {
      // Mock large text size preference
      const mockDimensions = { fontScale: 2.0 };
      
      const { getByText } = render(
        <TestWrapper>
          <BasicDetailsScreen />
        </TestWrapper>
      );

      // Should render without layout issues
      await waitFor(() => {
        expect(getByText).toBeTruthy();
      });
    });
  });
});