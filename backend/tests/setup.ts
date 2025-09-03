// Test setup for Meeting Minutes tests
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

// Setup in-memory MongoDB for testing
beforeAll(async () => {
  const MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/fieldsync-test';
  
  await mongoose.connect(MONGODB_URI);
}, 60000);

// Clean up after all tests
afterAll(async () => {
  await mongoose.disconnect();
}, 60000);

// Clear all test data after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Console suppression for cleaner test output
const originalConsole = console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
});

afterEach(() => {
  global.console = originalConsole;
});

export {};
