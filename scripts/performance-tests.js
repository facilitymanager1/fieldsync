/**
 * K6 Performance Testing Script for FieldSync API
 * Tests various endpoints under load to ensure performance standards
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Steady state
    { duration: '2m', target: 20 }, // Ramp to higher load
    { duration: '5m', target: 20 }, // Steady state
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'], // 95% of requests must be below 1.5s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3001';

// Test data
let authToken = '';
const testUsers = [
  { email: 'test1@fieldsync.io', password: 'TestPass123!' },
  { email: 'test2@fieldsync.io', password: 'TestPass123!' },
  { email: 'test3@fieldsync.io', password: 'TestPass123!' }
];

export function setup() {
  // Login to get auth token
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'admin@fieldsync.io',
    password: 'AdminPass123!'
  });

  if (loginResponse.status === 200) {
    const loginData = JSON.parse(loginResponse.body);
    return { authToken: loginData.token };
  }
  
  return { authToken: null };
}

export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': data.authToken ? `Bearer ${data.authToken}` : ''
  };

  // Test scenario weights
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% - Authentication tests
    testAuthentication();
  } else if (scenario < 0.5) {
    // 20% - GraphQL queries
    testGraphQLQueries(headers);
  } else if (scenario < 0.7) {
    // 20% - REST API endpoints
    testRestEndpoints(headers);
  } else if (scenario < 0.85) {
    // 15% - Analytics dashboard
    testAnalyticsDashboard(headers);
  } else {
    // 15% - File operations
    testFileOperations(headers);
  }

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

function testAuthentication() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  const success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
    'login returns token': (r) => JSON.parse(r.body).token !== undefined
  });

  if (!success) {
    errorRate.add(1);
  }
}

function testGraphQLQueries(headers) {
  // Test GraphQL analytics query
  const query = `
    query {
      analyticsMetrics {
        systemMetrics {
          activeUsers
          averageResponseTime
          systemLoad
        }
        businessMetrics {
          activeTickets
          slaCompliance
          staffUtilization
        }
      }
    }
  `;

  const response = http.post(`${BASE_URL}/graphql`, JSON.stringify({
    query: query
  }), { headers });

  const success = check(response, {
    'GraphQL status is 200': (r) => r.status === 200,
    'GraphQL response time < 1000ms': (r) => r.timings.duration < 1000,
    'GraphQL returns data': (r) => JSON.parse(r.body).data !== undefined
  });

  if (!success) {
    errorRate.add(1);
  }
}

function testRestEndpoints(headers) {
  const endpoints = [
    '/api/ticket',
    '/api/shift',
    '/api/analytics/metrics',
    '/api/monitoring/health'
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const response = http.get(`${BASE_URL}${endpoint}`, { headers });

  const success = check(response, {
    'REST API status is 200': (r) => r.status === 200,
    'REST API response time < 800ms': (r) => r.timings.duration < 800,
    'REST API returns success': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.success === true || data.status === 'ok';
      } catch {
        return false;
      }
    }
  });

  if (!success) {
    errorRate.add(1);
  }
}

function testAnalyticsDashboard(headers) {
  // Test analytics metrics endpoint
  const response = http.get(`${BASE_URL}/api/analytics/metrics`, { headers });

  const success = check(response, {
    'Analytics status is 200': (r) => r.status === 200,
    'Analytics response time < 1200ms': (r) => r.timings.duration < 1200,
    'Analytics has system metrics': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.systemMetrics !== undefined;
      } catch {
        return false;
      }
    }
  });

  if (!success) {
    errorRate.add(1);
  }
}

function testFileOperations(headers) {
  // Test file upload endpoint
  const formData = {
    file: http.file(new Uint8Array([1, 2, 3, 4, 5]), 'test.txt', 'text/plain')
  };

  const response = http.post(`${BASE_URL}/api/attachments/upload`, formData, {
    headers: {
      'Authorization': headers.Authorization
    }
  });

  const success = check(response, {
    'Upload status is 200': (r) => r.status === 200 || r.status === 413, // 413 is acceptable for large files
    'Upload response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  }
}

export function handleSummary(data) {
  // Generate custom summary
  return {
    'performance-summary.json': JSON.stringify(data, null, 2),
    stdout: `
Performance Test Results:
========================
Duration: ${data.state.testRunDurationMs}ms
Requests: ${data.metrics.http_reqs.values.count}
Failed Requests: ${data.metrics.http_req_failed.values.passes}
Average Response Time: ${data.metrics.http_req_duration.values.avg}ms
95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms
Error Rate: ${data.metrics.errors ? data.metrics.errors.values.rate * 100 : 0}%
    `
  };
}