module.exports = {
  testMatch: [
    '**/modules/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '**/src/**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '**/src/**/*.test.{js,jsx,ts,tsx}'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest'],
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@testing-library|react-clone-referenced-element|@react-native-community|expo(nent)?|@expo(nent)?|expo(nent)?-vector-icons|@unimodules|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-web|@react-native-picker|@react-native-masked-view|@react-native-community/masked-view|expo-auth-session|expo-constants|expo-crypto|expo-random)/)"
  ],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '\\.(svg)$': 'react-native-svg-mock'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'modules/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/__tests__/**'
  ]
};