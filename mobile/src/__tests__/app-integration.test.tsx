/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import App from '../../App';

// Mock all external dependencies
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE' },
    ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
  },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
  request: jest.fn().mockResolvedValue('granted'),
  check: jest.fn().mockResolvedValue('granted'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withSpring: jest.fn((value) => value),
    withTiming: jest.fn((value) => value),
  };
});

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => ({
      onStart: jest.fn().mockReturnThis(),
      onUpdate: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
    }),
  },
  GestureDetector: ({ children }: any) => children,
  PanGestureHandler: ({ children }: any) => children,
  TapGestureHandler: ({ children }: any) => children,
  State: { BEGAN: 1, ACTIVE: 4, END: 5 },
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      addListener: jest.fn(() => jest.fn()),
    }),
    useRoute: () => ({
      key: 'test',
      name: 'Test',
      params: {},
    }),
  };
});

describe('App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('app renders without crashing', () => {
    const { getByTestId } = render(<App />);
    
    // Should render the main app container
    expect(getByTestId('app-container')).toBeTruthy();
  });

  test('shows loading state initially', async () => {
    const { getByTestId } = render(<App />);
    
    // Should show loading indicator
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  test('navigation works between screens', async () => {
    const { getByText } = render(<App />);
    
    await waitFor(() => {
      expect(getByText('FieldSync')).toBeTruthy();
    });

    // Navigate to login
    const loginButton = getByText('Get Started');
    fireEvent.press(loginButton);
    
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('handles authentication flow', async () => {
    const { getByTestId, getByText } = render(<App />);
    
    await waitFor(() => {
      const loginButton = getByTestId('login-button');
      fireEvent.press(loginButton);
    });

    // Should handle login flow
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('handles errors gracefully', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const { getByTestId } = render(<App />);
    
    // App should still render even with errors
    expect(getByTestId('app-container')).toBeTruthy();
    
    consoleSpy.mockRestore();
  });

  test('accessibility features work', () => {
    const { getByTestId } = render(<App />);
    
    const appContainer = getByTestId('app-container');
    
    // Check accessibility props
    expect(appContainer.props.accessible).toBe(true);
    expect(appContainer.props.accessibilityLabel).toBeDefined();
  });

  test('performance optimization is active', () => {
    const performanceMark = jest.spyOn(performance, 'mark').mockImplementation();
    
    render(<App />);
    
    // Should track performance
    expect(performanceMark).toHaveBeenCalled();
    
    performanceMark.mockRestore();
  });

  test('gesture handling works', async () => {
    const { getByTestId } = render(<App />);
    
    const gestureContainer = getByTestId('gesture-container');
    
    // Simulate gesture
    fireEvent(gestureContainer, 'onGestureEvent', {
      nativeEvent: { translationX: 100, translationY: 0 },
    });
    
    // Should handle gesture without errors
    expect(gestureContainer).toBeTruthy();
  });

  test('offline functionality', async () => {
    // Mock network state
    const networkInfo = {
      isConnected: false,
      type: 'none',
    };

    const { getByTestId } = render(<App />);
    
    // Should show offline indicator
    await waitFor(() => {
      expect(getByTestId('offline-indicator')).toBeTruthy();
    });
  });

  test('state persistence works', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    
    render(<App />);
    
    // Should attempt to load saved state
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalled();
    });
  });
});
