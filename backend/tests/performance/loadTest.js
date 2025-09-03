/**
 * Load Testing Script for FieldSync Backend
 * Uses Artillery.js for load testing scenarios
 * Run with: npx artillery run backend/tests/performance/loadTest.js
 */

module.exports = {
  config: {
    target: 'http://localhost:3001',
    phases: [
      {
        duration: 60,
        arrivalRate: 5,
        name: 'Warm up'
      },
      {
        duration: 120,
        arrivalRate: 10,
        name: 'Ramp up load'
      },
      {
        duration: 180,
        arrivalRate: 25,
        name: 'Sustained load'
      },
      {
        duration: 60,
        arrivalRate: 50,
        name: 'Peak load'
      },
      {
        duration: 60,
        arrivalRate: 5,
        name: 'Cool down'
      }
    ],
    payload: {
      path: './test-users.csv',
      fields: ['username', 'password', 'role']
    },
    plugins: {
      'artillery-plugin-statsd': {
        host: 'localhost',
        port: 8125,
        prefix: 'fieldsync.load_test'
      }
    },
    processor: './loadTestProcessor.js'
  },
  scenarios: [
    {
      name: 'Authentication Flow',
      weight: 30,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              username: '{{ username }}',
              password: '{{ password }}'
            },
            capture: {
              json: '$.data.token',
              as: 'authToken'
            },
            expect: [
              { statusCode: 200 },
              { hasProperty: 'data.token' }
            ]
          }
        },
        {
          get: {
            url: '/api/users/profile',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 },
              { hasProperty: 'data.username' }
            ]
          }
        },
        {
          post: {
            url: '/api/auth/logout',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        }
      ]
    },
    {
      name: 'Shift Management',
      weight: 25,
      flow: [
        {
          function: 'authenticateUser'
        },
        {
          get: {
            url: '/api/shifts/my-shifts',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        },
        {
          post: {
            url: '/api/shifts',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            json: {
              scheduledStartTime: '{{ $randomISO }}',
              scheduledEndTime: '{{ $randomFutureISO }}',
              location: {
                latitude: '{{ $randomLatitude }}',
                longitude: '{{ $randomLongitude }}',
                accuracy: 10
              }
            },
            capture: {
              json: '$.data.id',
              as: 'shiftId'
            },
            expect: [
              { statusCode: 201 }
            ]
          }
        },
        {
          patch: {
            url: '/api/shifts/{{ shiftId }}/status',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            json: {
              status: 'in_progress'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        }
      ]
    },
    {
      name: 'Ticket Operations',
      weight: 20,
      flow: [
        {
          function: 'authenticateUser'
        },
        {
          get: {
            url: '/api/tickets?limit=10',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        },
        {
          post: {
            url: '/api/tickets',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            json: {
              title: 'Load Test Ticket {{ $randomString }}',
              description: 'Generated during load testing',
              priority: '{{ $randomPriority }}',
              category: 'maintenance',
              location: {
                latitude: '{{ $randomLatitude }}',
                longitude: '{{ $randomLongitude }}'
              }
            },
            capture: {
              json: '$.data.id',
              as: 'ticketId'
            },
            expect: [
              { statusCode: 201 }
            ]
          }
        },
        {
          get: {
            url: '/api/tickets/{{ ticketId }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        }
      ]
    },
    {
      name: 'Analytics Dashboard',
      weight: 15,
      flow: [
        {
          function: 'authenticateAdmin'
        },
        {
          get: {
            url: '/api/dashboard/stats',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        },
        {
          get: {
            url: '/api/analytics/summary',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        },
        {
          get: {
            url: '/api/analytics/performance-metrics',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        }
      ]
    },
    {
      name: 'SLA Monitoring',
      weight: 10,
      flow: [
        {
          function: 'authenticateAdmin'
        },
        {
          get: {
            url: '/api/sla/templates',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        },
        {
          get: {
            url: '/api/sla/trackers/active',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        },
        {
          get: {
            url: '/api/sla/compliance-report',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            expect: [
              { statusCode: 200 }
            ]
          }
        }
      ]
    }
  ]
};

// Performance thresholds for assertions
const PERFORMANCE_THRESHOLDS = {
  response_time: {
    p95: 800,    // 95th percentile response time (ms)
    p99: 1500,   // 99th percentile response time (ms)
    max: 3000    // Maximum acceptable response time (ms)
  },
  error_rate: {
    max: 0.05    // Maximum 5% error rate
  },
  throughput: {
    min: 100     // Minimum requests per second
  }
};

// Test data for CSV file
const testUsers = [
  'admin,AdminPass123!,Admin',
  'supervisor1,SuperPass123!,Supervisor',
  'supervisor2,SuperPass123!,Supervisor',
  'fieldtech1,FieldPass123!,FieldTech',
  'fieldtech2,FieldPass123!,FieldTech',
  'fieldtech3,FieldPass123!,FieldTech',
  'fieldtech4,FieldPass123!,FieldTech',
  'fieldtech5,FieldPass123!,FieldTech',
  'client1,ClientPass123!,Client',
  'client2,ClientPass123!,Client'
];

// Save test users to CSV file
const fs = require('fs');
const path = require('path');

const csvContent = 'username,password,role\n' + testUsers.join('\n');
const csvPath = path.join(__dirname, 'test-users.csv');

try {
  fs.writeFileSync(csvPath, csvContent);
  console.log('Test users CSV file created successfully');
} catch (error) {
  console.error('Failed to create test users CSV file:', error);
}