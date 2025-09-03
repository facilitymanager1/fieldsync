/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import PersonalInfoScreen from '../screens/onboarding/PersonalInfoScreen';
import CompanyInfoScreen from '../screens/onboarding/CompanyInfoScreen';
import PermissionsScreen from '../screens/onboarding/PermissionsScreen';
import NotificationsScreen from '../screens/onboarding/NotificationsScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => false),
  getId: jest.fn(() => 'test'),
  getParent: jest.fn(),
  getState: jest.fn(() => ({ routes: [], index: 0 })),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  reset: jest.fn(),
  dispatch: jest.fn(),
};

const mockRoute = {
  key: 'test',
  name: 'Test',
  params: {},
};

// Mock react-native modules
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
      CAMERA: 'ios.permission.CAMERA',
      PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
      NOTIFICATIONS: 'ios.permission.NOTIFICATIONS',
    },
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      CAMERA: 'android.permission.CAMERA',
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    LIMITED: 'limited',
    UNAVAILABLE: 'unavailable',
  },
  request: jest.fn(),
  check: jest.fn(),
  requestMultiple: jest.fn(),
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');

// Mock async storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const Stack = createStackNavigator();

const TestNavigationWrapper = ({ children }: { children: React.ReactNode }) => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Test" component={() => <>{children}</>} />
    </Stack.Navigator>
  </NavigationContainer>
);

describe('Onboarding Screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WelcomeScreen', () => {
    test('renders welcome message', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <WelcomeScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      expect(getByText('Welcome to FieldSync')).toBeTruthy();
    });

    test('navigates to next screen on continue', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <WelcomeScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const continueButton = getByText('Get Started');
      fireEvent.press(continueButton);
      
      expect(mockNavigate).toHaveBeenCalled();
    });

    test('renders feature highlights', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <WelcomeScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      expect(getByText(/Track attendance/)).toBeTruthy();
      expect(getByText(/Manage tasks/)).toBeTruthy();
      expect(getByText(/Real-time communication/)).toBeTruthy();
    });
  });

  describe('PersonalInfoScreen', () => {
    test('renders personal information form', () => {
      const { getByText, getByPlaceholderText } = render(
        <TestNavigationWrapper>
          <PersonalInfoScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      expect(getByText('Personal Information')).toBeTruthy();
      expect(getByPlaceholderText('First Name')).toBeTruthy();
      expect(getByPlaceholderText('Last Name')).toBeTruthy();
      expect(getByPlaceholderText('Email')).toBeTruthy();
    });

    test('validates required fields', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <PersonalInfoScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const continueButton = getByText('Continue');
      fireEvent.press(continueButton);
      
      // Should show validation errors
      expect(getByText(/First name is required/)).toBeTruthy();
    });

    test('handles form input changes', () => {
      const { getByPlaceholderText } = render(
        <TestNavigationWrapper>
          <PersonalInfoScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const firstNameInput = getByPlaceholderText('First Name');
      fireEvent.changeText(firstNameInput, 'John');
      
      expect(firstNameInput.props.value).toBe('John');
    });
  });

  describe('CompanyInfoScreen', () => {
    test('renders company information form', () => {
      const { getByText, getByPlaceholderText } = render(
        <TestNavigationWrapper>
          <CompanyInfoScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      expect(getByText('Company Information')).toBeTruthy();
      expect(getByPlaceholderText('Company Name')).toBeTruthy();
      expect(getByPlaceholderText('Department')).toBeTruthy();
    });

    test('validates company fields', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <CompanyInfoScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const continueButton = getByText('Continue');
      fireEvent.press(continueButton);
      
      expect(getByText(/Company name is required/)).toBeTruthy();
    });
  });

  describe('PermissionsScreen', () => {
    test('renders permission requests', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <PermissionsScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      expect(getByText('Permissions Required')).toBeTruthy();
      expect(getByText(/Location Access/)).toBeTruthy();
      expect(getByText(/Camera Access/)).toBeTruthy();
    });

    test('handles permission requests', async () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <PermissionsScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const grantButton = getByText('Grant Permissions');
      fireEvent.press(grantButton);
      
      // Should call permission request
      const { requestMultiple } = require('react-native-permissions');
      expect(requestMultiple).toHaveBeenCalled();
    });

    test('allows skipping permissions', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <PermissionsScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const skipButton = getByText('Skip for Now');
      fireEvent.press(skipButton);
      
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('NotificationsScreen', () => {
    test('renders notification settings', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <NotificationsScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      expect(getByText('Notification Preferences')).toBeTruthy();
      expect(getByText(/Push Notifications/)).toBeTruthy();
      expect(getByText(/Email Notifications/)).toBeTruthy();
    });

    test('handles notification toggles', () => {
      const { getByTestId } = render(
        <TestNavigationWrapper>
          <NotificationsScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const pushToggle = getByTestId('push-notifications-toggle');
      fireEvent(pushToggle, 'onValueChange', true);
      
      expect(pushToggle.props.value).toBe(true);
    });

    test('completes onboarding', () => {
      const { getByText } = render(
        <TestNavigationWrapper>
          <NotificationsScreen navigation={mockNavigation} route={mockRoute} />
        </TestNavigationWrapper>
      );
      
      const completeButton = getByText('Complete Setup');
      fireEvent.press(completeButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('Dashboard');
    });
  });
});
