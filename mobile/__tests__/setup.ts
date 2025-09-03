// Test setup and configuration
import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  ExternalDirectoryPath: '/mock/external',
  exists: jest.fn(() => Promise.resolve(true)),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('mock content')),
  unlink: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({ size: 1024 })),
  readDir: jest.fn(() => Promise.resolve([])),
  copyFile: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-html-to-pdf
jest.mock('react-native-html-to-pdf', () => ({
  convert: jest.fn(() => Promise.resolve({ filePath: '/mock/pdf/file.pdf' })),
}));

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  request: jest.fn(() => Promise.resolve('granted')),
  check: jest.fn(() => Promise.resolve('granted')),
}));

// Mock react-native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'ios',
      select: jest.fn((dict) => dict.ios),
    },
    Alert: {
      alert: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
    },
    PermissionsAndroid: {
      PERMISSIONS: {
        WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
      },
      RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
      },
      request: jest.fn(() => Promise.resolve('granted')),
    },
  };
});

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests but keep error and warn
  log: jest.fn(),
  debug: jest.fn(),
};

// Setup timers for async testing
jest.useFakeTimers();

// Global test timeout
jest.setTimeout(10000);

// Mock Date for consistent testing
const mockDate = new Date('2025-01-15T10:00:00.000Z');
global.Date = jest.fn(() => mockDate) as any;
global.Date.now = jest.fn(() => mockDate.getTime());
global.Date.UTC = Date.UTC;
global.Date.parse = Date.parse;

// Helper function to wait for async operations
export const waitForAsync = () => new Promise(resolve => setImmediate(resolve));

// Helper function to advance timers and wait
export const advanceTimersAndWait = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  await waitForAsync();
};

// Mock user data for testing
export const mockUserData = {
  basicDetails: {
    tempId: 'TEST001',
    firstName: 'John',
    lastName: 'Doe',
    fatherName: 'James Doe',
    dateOfBirth: '1990-01-01',
    dateOfJoining: '2025-01-20',
    gender: 'Male',
    maritalStatus: 'Single',
    bloodGroup: 'O+',
    nationality: 'Indian',
    phoneNumber: '9876543210',
    alternatePhoneNumber: '9876543211',
    email: 'john.doe@example.com',
    alternateEmail: 'john.alternate@example.com',
    currentAddress: '123 Main St, City, State 123456',
    permanentAddress: '123 Main St, City, State 123456',
    pincode: '123456',
    district: 'Test District',
    state: 'Test State',
    country: 'India',
    aadhaarNumber: '123456789012',
    panNumber: 'ABCDE1234F',
    speciallyAbled: 'No',
  },
  documents: {
    aadhaarNumber: '123456789012',
    panNumber: 'ABCDE1234F',
    documents: [
      {
        type: 'AADHAAR',
        number: '123456789012',
        issuedDate: '2020-01-01',
        issuedBy: 'UIDAI',
        status: 'verified',
      },
      {
        type: 'PAN',
        number: 'ABCDE1234F',
        issuedDate: '2019-01-01',
        issuedBy: 'Income Tax Department',
        status: 'verified',
      },
    ],
  },
  emergencyContacts: [
    {
      name: 'Jane Doe',
      relationship: 'Sister',
      phoneNumber: '9876543220',
      alternatePhone: '9876543221',
      address: '456 Oak St, City, State 123456',
      isPrimary: true,
    },
  ],
  bankDetails: {
    accountHolderName: 'John Doe',
    accountNumber: '1234567890123456',
    bankName: 'Test Bank',
    branchName: 'Main Branch',
    ifscCode: 'TEST0001234',
    accountType: 'Savings',
    bankAddress: '789 Bank St, City, State 123456',
  },
  salaryDetails: {
    designation: 'Software Engineer',
    department: 'Technology',
    joiningDate: '2025-01-20',
    basicSalary: 50000,
    hra: 20000,
    conveyanceAllowance: 5000,
    medicalAllowance: 2000,
    otherAllowances: 3000,
    grossSalary: 80000,
    pfDeduction: 6000,
    esiDeduction: 1400,
    tds: 2000,
    otherDeductions: 500,
    netSalary: 70100,
  },
  education: [
    {
      level: 'Bachelor',
      institution: 'Test University',
      degree: 'Computer Science',
      specialization: 'Software Engineering',
      yearOfPassing: '2015',
      percentage: 85,
      grade: 'A',
      boardUniversity: 'Test University Board',
    },
  ],
  workExperience: [
    {
      companyName: 'Previous Company',
      designation: 'Junior Developer',
      joiningDate: '2020-01-01',
      relievingDate: '2024-12-31',
      salary: 30000,
      reasonForLeaving: 'Career Growth',
      responsibilities: 'Software Development',
      reportingManager: 'Manager Name',
      hrContact: 'hr@previous.com',
    },
  ],
  uniform: {
    category: 'gents',
    items: {
      shirt: { size: 'M', quantity: 3 },
      pant: { size: '32', quantity: 2 },
      shoes: { size: '9', quantity: 1 },
      additionalItems: [
        { item: 'cap', size: 'Free Size', quantity: 1 },
      ],
    },
    totalCost: 5000,
    status: 'pending',
  },
};

// Mock API responses
export const mockApiResponses = {
  login: {
    success: true,
    data: {
      user: {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'HR',
      },
      token: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
    },
  },
  validation: {
    aadhaarValid: { isValid: true, message: null },
    aadhaarInvalid: { isValid: false, message: 'Invalid Aadhaar number' },
    panValid: { isValid: true, message: null },
    panInvalid: { isValid: false, message: 'Invalid PAN number' },
    emailExists: { isValid: false, message: 'Email already exists' },
    emailAvailable: { isValid: true, message: null },
  },
  karza: {
    aadhaarVerification: {
      success: true,
      data: {
        name: 'JOHN DOE',
        dateOfBirth: '01/01/1990',
        gender: 'M',
        address: '123 MAIN ST, CITY, STATE 123456',
        photo: 'base64-encoded-photo',
      },
    },
    panVerification: {
      success: true,
      data: {
        name: 'JOHN DOE',
        dateOfBirth: '01/01/1990',
        panStatus: 'Valid',
      },
    },
  },
};

// Test data generators
export const generateTestUser = (overrides = {}) => ({
  ...mockUserData.basicDetails,
  ...overrides,
});

export const generateTestValidationResult = (isValid = true, errors = []) => ({
  fieldName: 'testField',
  isValid,
  errors: errors.map(message => ({
    message,
    severity: 'ERROR',
    type: 'CUSTOM',
  })),
  warnings: [],
  infos: [],
});

// Custom matchers
expect.extend({
  toHaveValidationError(received, expected) {
    const hasError = received.errors && received.errors.some(error => error.message === expected);
    return {
      message: () => hasError 
        ? `Expected validation result not to have error: ${expected}`
        : `Expected validation result to have error: ${expected}`,
      pass: hasError,
    };
  },
});

// Export commonly used testing utilities
export const TestUtils = {
  waitForAsync,
  advanceTimersAndWait,
  mockUserData,
  mockApiResponses,
  generateTestUser,
  generateTestValidationResult,
};