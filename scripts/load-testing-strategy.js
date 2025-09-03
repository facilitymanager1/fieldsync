#!/usr/bin/env node

/**
 * Comprehensive Load Testing Strategy for FieldSync
 * Enterprise-grade performance testing with realistic user scenarios
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const apiResponseTime = new Trend('api_response_time');
const businessTransactionTime = new Trend('business_transaction_time');
const concurrentUsers = new Counter('concurrent_users');

// Test data
const testUsers = new SharedArray('users', function () {
  return Array.from({ length: 100 }, (_, i) => ({
    id: `user_${i + 1}`,
    email: `testuser${i + 1}@fieldsync.io`,
    password: 'TestPass123!',
    role: randomItem(['field_tech', 'supervisor', 'admin']),
    name: `Test User ${i + 1}`
  }));
});

const testSites = new SharedArray('sites', function () {
  return Array.from({ length: 50 }, (_, i) => ({
    id: `site_${i + 1}`,
    name: `Test Site ${i + 1}`,
    address: `${1000 + i} Test Street, Test City`,
    coordinates: {
      latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
      longitude: -74.0060 + (Math.random() - 0.5) * 0.1
    }
  }));
});

const testTickets = new SharedArray('tickets', function () {
  return Array.from({ length: 200 }, (_, i) => ({
    id: `ticket_${i + 1}`,
    title: `Test Ticket ${i + 1}`,
    description: `This is a test ticket for load testing purposes - ${i + 1}`,
    priority: randomItem(['low', 'medium', 'high', 'critical']),
    category: randomItem(['maintenance', 'repair', 'installation', 'inspection']),
    status: randomItem(['open', 'in_progress', 'pending', 'resolved'])
  }));
});

// Test configuration profiles
export const options = {
  scenarios: {
    // Smoke test - basic functionality validation
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
      env: { SCENARIO: 'smoke' }
    },
    
    // Load test - normal expected load
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },   // Ramp up
        { duration: '5m', target: 10 },   // Steady state
        { duration: '2m', target: 20 },   // Ramp up more
        { duration: '5m', target: 20 },   // Steady state
        { duration: '2m', target: 0 }     // Ramp down
      ],
      tags: { test_type: 'load' },
      env: { SCENARIO: 'load' }
    },
    
    // Stress test - high load conditions
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },   // Ramp up
        { duration: '5m', target: 20 },   // Steady state
        { duration: '2m', target: 50 },   // Stress level
        { duration: '5m', target: 50 },   // Stress steady
        { duration: '2m', target: 100 },  // Peak stress
        { duration: '5m', target: 100 },  // Peak steady
        { duration: '5m', target: 0 }     // Ramp down
      ],
      tags: { test_type: 'stress' },
      env: { SCENARIO: 'stress' }
    },
    
    // Spike test - sudden load increases
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Normal load
        { duration: '30s', target: 100 }, // Spike!
        { duration: '1m', target: 100 },  // Sustain spike
        { duration: '30s', target: 10 },  // Back to normal
        { duration: '1m', target: 10 },   // Normal steady
        { duration: '30s', target: 0 }    // Ramp down
      ],
      tags: { test_type: 'spike' },
      env: { SCENARIO: 'spike' }
    },
    
    // Soak test - extended duration testing
    soak_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30m',
      tags: { test_type: 'soak' },
      env: { SCENARIO: 'soak' }
    },
    
    // Peak performance test - maximum expected load
    peak_test: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '2m', target: 10 },   // Start slowly
        { duration: '5m', target: 50 },   // Ramp to normal
        { duration: '10m', target: 100 }, // Peak load
        { duration: '5m', target: 50 },   // Scale back
        { duration: '2m', target: 0 }     // Stop
      ],
      tags: { test_type: 'peak' },
      env: { SCENARIO: 'peak' }
    }
  },
  
  thresholds: {
    // Response time requirements
    http_req_duration: [
      'p(95)<2000',  // 95% of requests must complete within 2s
      'p(99)<5000'   // 99% of requests must complete within 5s
    ],
    
    // Error rate requirements
    http_req_failed: ['rate<0.05'], // Error rate must be below 5%
    errors: ['rate<0.05'],          // Custom error rate below 5%
    
    // Success rate requirements
    success: ['rate>0.95'],         // Success rate above 95%
    
    // API performance requirements
    api_response_time: [
      'p(50)<500',   // 50% of API calls under 500ms
      'p(95)<1500'   // 95% of API calls under 1.5s
    ],
    
    // Business transaction requirements
    business_transaction_time: [
      'p(95)<10000'  // 95% of business transactions under 10s
    ]
  }
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3001';
const WEB_URL = __ENV.WEB_URL || 'http://localhost:3000';

// Test data and state
let authToken = '';
let currentUser = null;

export function setup() {
  console.log(`🚀 Starting FieldSync Load Testing`);
  console.log(`API Target: ${BASE_URL}`);
  console.log(`Web Target: ${WEB_URL}`);
  console.log(`Scenario: ${__ENV.SCENARIO || 'default'}`);
  
  // Warm up the application
  const warmupResponse = http.get(`${BASE_URL}/health`);
  check(warmupResponse, {
    'warmup successful': (r) => r.status === 200,
  });
  
  return {
    baseUrl: BASE_URL,
    webUrl: WEB_URL,
    scenario: __ENV.SCENARIO || 'default'
  };
}

export default function (data) {
  const scenario = data.scenario;
  concurrentUsers.add(1);
  
  // Select test approach based on scenario
  switch (scenario) {
    case 'smoke':
      smokeTestScenario();
      break;
    case 'load':
    case 'stress':
    case 'peak':
      comprehensiveUserScenario();
      break;
    case 'spike':
      spikeTestScenario();
      break;
    case 'soak':
      soakTestScenario();
      break;
    default:
      defaultUserScenario();
  }
  
  // Random think time between requests
  sleep(randomIntBetween(1, 3));
}

function smokeTestScenario() {
  group('🔍 Smoke Test - Basic Functionality', () => {
    // Test critical endpoints
    const endpoints = [
      '/health',
      '/api/auth/methods',
      '/api/monitoring/health'
    ];
    
    endpoints.forEach(endpoint => {
      const response = http.get(`${BASE_URL}${endpoint}`);
      check(response, {
        [`${endpoint} is accessible`]: (r) => r.status === 200,
        [`${endpoint} responds quickly`]: (r) => r.timings.duration < 1000,
      });
    });
  });
}

function comprehensiveUserScenario() {
  const user = randomItem(testUsers);
  
  group('🔐 User Authentication Flow', () => {
    performAuthentication(user);
  });
  
  if (authToken) {
    group('📊 Dashboard Operations', () => {
      loadDashboard();
      checkSystemMetrics();
    });
    
    group('🎫 Ticket Management', () => {
      listTickets();
      createTicket();
      updateTicketStatus();
    });
    
    group('👥 Staff Management', () => {
      listStaff();
      checkAttendance();
    });
    
    group('📍 Location Services', () => {
      submitLocation();
      checkGeofences();
    });
    
    group('📈 Analytics & Reports', () => {
      loadAnalytics();
      generateReport();
    });
  }
}

function spikeTestScenario() {
  // Simplified scenario for spike testing
  const user = randomItem(testUsers);
  
  group('⚡ Spike Test - Authentication', () => {
    performAuthentication(user);
  });
  
  if (authToken) {
    group('⚡ Spike Test - Dashboard Load', () => {
      loadDashboard();
    });
  }
}

function soakTestScenario() {
  // Long-running operations for soak testing
  const user = randomItem(testUsers);
  
  group('🏃 Soak Test - Continuous Operations', () => {
    performAuthentication(user);
    
    if (authToken) {
      // Continuously perform operations
      for (let i = 0; i < 5; i++) {
        loadDashboard();
        listTickets();
        sleep(randomIntBetween(10, 30)); // Longer think time for soak test
      }
    }
  });
}

function defaultUserScenario() {
  // Standard user journey
  comprehensiveUserScenario();
}

// Authentication functions
function performAuthentication(user) {
  const startTime = Date.now();
  
  const loginPayload = {
    email: user.email,
    password: user.password
  };
  
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const success = check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'login response time OK': (r) => r.timings.duration < 2000,
    'receives auth token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.token;
      } catch {
        return false;
      }
    }
  });
  
  if (success && loginResponse.status === 200) {
    try {
      const loginData = JSON.parse(loginResponse.body);
      authToken = loginData.token;
      currentUser = user;
      successRate.add(1);
    } catch (error) {
      console.error('Failed to parse login response:', error);
      errorRate.add(1);
    }
  } else {
    errorRate.add(1);
  }
  
  apiResponseTime.add(loginResponse.timings.duration);
  businessTransactionTime.add(Date.now() - startTime);
}

// Dashboard functions
function loadDashboard() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const dashboardResponse = http.get(`${BASE_URL}/api/monitoring/metrics`, { headers });
  
  check(dashboardResponse, {
    'dashboard loads': (r) => r.status === 200,
    'dashboard response time OK': (r) => r.timings.duration < 3000,
  });
  
  apiResponseTime.add(dashboardResponse.timings.duration);
}

function checkSystemMetrics() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const metricsResponse = http.get(`${BASE_URL}/api/monitoring/performance`, { headers });
  
  check(metricsResponse, {
    'metrics accessible': (r) => r.status === 200,
    'metrics response time OK': (r) => r.timings.duration < 2000,
  });
  
  apiResponseTime.add(metricsResponse.timings.duration);
}

// Ticket management functions
function listTickets() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const ticketsResponse = http.get(`${BASE_URL}/api/ticket?limit=20`, { headers });
  
  check(ticketsResponse, {
    'tickets list loads': (r) => r.status === 200,
    'tickets response time OK': (r) => r.timings.duration < 2000,
  });
  
  apiResponseTime.add(ticketsResponse.timings.duration);
}

function createTicket() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const ticket = randomItem(testTickets);
  const site = randomItem(testSites);
  
  const ticketPayload = {
    title: `${ticket.title} - Load Test ${Date.now()}`,
    description: ticket.description,
    priority: ticket.priority,
    category: ticket.category,
    siteId: site.id,
    assignedTo: currentUser.id
  };
  
  const createResponse = http.post(`${BASE_URL}/api/ticket`, JSON.stringify(ticketPayload), { headers });
  
  check(createResponse, {
    'ticket created': (r) => r.status === 201 || r.status === 200,
    'create response time OK': (r) => r.timings.duration < 3000,
  });
  
  apiResponseTime.add(createResponse.timings.duration);
}

function updateTicketStatus() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  // Simulate updating a ticket status
  const ticketId = `ticket_${randomIntBetween(1, 200)}`;
  const updatePayload = {
    status: randomItem(['in_progress', 'pending', 'resolved'])
  };
  
  const updateResponse = http.put(`${BASE_URL}/api/ticket/${ticketId}`, JSON.stringify(updatePayload), { headers });
  
  check(updateResponse, {
    'ticket update processed': (r) => r.status === 200 || r.status === 404, // 404 is acceptable for test data
    'update response time OK': (r) => r.timings.duration < 2000,
  });
  
  apiResponseTime.add(updateResponse.timings.duration);
}

// Staff management functions
function listStaff() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const staffResponse = http.get(`${BASE_URL}/api/staff?limit=50`, { headers });
  
  check(staffResponse, {
    'staff list loads': (r) => r.status === 200,
    'staff response time OK': (r) => r.timings.duration < 2000,
  });
  
  apiResponseTime.add(staffResponse.timings.duration);
}

function checkAttendance() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const attendanceResponse = http.get(`${BASE_URL}/api/attendance/today`, { headers });
  
  check(attendanceResponse, {
    'attendance data accessible': (r) => r.status === 200,
    'attendance response time OK': (r) => r.timings.duration < 2000,
  });
  
  apiResponseTime.add(attendanceResponse.timings.duration);
}

// Location services functions
function submitLocation() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const locationPayload = {
    latitude: 40.7128 + (Math.random() - 0.5) * 0.01,
    longitude: -74.0060 + (Math.random() - 0.5) * 0.01,
    accuracy: randomIntBetween(3, 10),
    timestamp: new Date().toISOString()
  };
  
  const locationResponse = http.post(`${BASE_URL}/api/location/update`, JSON.stringify(locationPayload), { headers });
  
  check(locationResponse, {
    'location submitted': (r) => r.status === 200 || r.status === 201,
    'location response time OK': (r) => r.timings.duration < 1500,
  });
  
  apiResponseTime.add(locationResponse.timings.duration);
}

function checkGeofences() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const geofenceResponse = http.get(`${BASE_URL}/api/geofence/active`, { headers });
  
  check(geofenceResponse, {
    'geofences accessible': (r) => r.status === 200,
    'geofence response time OK': (r) => r.timings.duration < 1500,
  });
  
  apiResponseTime.add(geofenceResponse.timings.duration);
}

// Analytics functions
function loadAnalytics() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const analyticsResponse = http.get(`${BASE_URL}/api/analytics/metrics`, { headers });
  
  check(analyticsResponse, {
    'analytics loads': (r) => r.status === 200,
    'analytics response time OK': (r) => r.timings.duration < 4000,
  });
  
  apiResponseTime.add(analyticsResponse.timings.duration);
}

function generateReport() {
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  const reportPayload = {
    type: 'daily_summary',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    filters: {
      includeTickets: true,
      includeAttendance: true,
      includePerformance: true
    }
  };
  
  const reportResponse = http.post(`${BASE_URL}/api/reports/generate`, JSON.stringify(reportPayload), { headers });
  
  check(reportResponse, {
    'report generation initiated': (r) => r.status === 200 || r.status === 202,
    'report response time OK': (r) => r.timings.duration < 5000,
  });
  
  apiResponseTime.add(reportResponse.timings.duration);
}

export function teardown(data) {
  console.log('🏁 Load testing completed');
  
  // Output final statistics
  console.log('📊 Test Results Summary:');
  console.log(`Target URL: ${data.baseUrl}`);
  console.log(`Scenario: ${data.scenario}`);
  console.log('Check detailed results in the K6 output above.');
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'stdout': generateCustomSummary(data),
  };
}

function generateCustomSummary(data) {
  const scenarios = Object.keys(data.metrics.scenarios || {});
  const duration = data.state.testRunDurationMs || 0;
  
  return `
🚀 FieldSync Load Testing Results
================================

📊 Test Overview:
- Duration: ${Math.round(duration / 1000)}s
- Scenarios: ${scenarios.join(', ')}
- Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
- Data Transferred: ${((data.metrics.data_received?.values?.count || 0) / 1024 / 1024).toFixed(2)} MB

⚡ Performance Metrics:
- Average Response Time: ${Math.round(data.metrics.http_req_duration?.values?.avg || 0)}ms
- 95th Percentile: ${Math.round(data.metrics.http_req_duration?.values['p(95)'] || 0)}ms
- 99th Percentile: ${Math.round(data.metrics.http_req_duration?.values['p(99)'] || 0)}ms

📈 Success Metrics:
- Success Rate: ${((data.metrics.success?.values?.rate || 0) * 100).toFixed(2)}%
- Error Rate: ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%
- Failed Requests: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

🎯 Business Transactions:
- API Response Time (avg): ${Math.round(data.metrics.api_response_time?.values?.avg || 0)}ms
- Business Transaction Time (avg): ${Math.round(data.metrics.business_transaction_time?.values?.avg || 0)}ms

✅ Threshold Status:
${Object.entries(data.thresholds || {}).map(([name, result]) => 
  `- ${name}: ${result.ok ? '✅ PASS' : '❌ FAIL'}`
).join('\n')}

📊 Detailed Results: See load-test-results.json for complete metrics
`;
}