/**
 * Artillery.js Processor for FieldSync Load Testing
 * Provides custom functions and helpers for load testing scenarios
 */

const jwt = require('jsonwebtoken');

// Custom functions for Artillery scenarios
module.exports = {
  // Authenticate a regular user
  authenticateUser: function(context, events, done) {
    const user = context.vars;
    
    // Mock authentication for load testing
    const token = generateMockToken({
      username: user.username || 'testuser',
      role: user.role || 'FieldTech'
    });
    
    context.vars.authToken = token;
    return done();
  },

  // Authenticate an admin user
  authenticateAdmin: function(context, events, done) {
    const token = generateMockToken({
      username: 'admin',
      role: 'Admin'
    });
    
    context.vars.authToken = token;
    return done();
  },

  // Generate random coordinates
  generateRandomLocation: function(context, events, done) {
    context.vars.randomLatitude = (Math.random() * 180 - 90).toFixed(6);
    context.vars.randomLongitude = (Math.random() * 360 - 180).toFixed(6);
    return done();
  },

  // Generate random priority
  generateRandomPriority: function(context, events, done) {
    const priorities = ['low', 'medium', 'high', 'critical'];
    context.vars.randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
    return done();
  },

  // Generate random string
  generateRandomString: function(context, events, done) {
    context.vars.randomString = Math.random().toString(36).substring(2, 15);
    return done();
  },

  // Generate random ISO date (current time)
  generateRandomISO: function(context, events, done) {
    context.vars.randomISO = new Date().toISOString();
    return done();
  },

  // Generate random future ISO date (1-8 hours from now)
  generateRandomFutureISO: function(context, events, done) {
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + Math.floor(Math.random() * 8) + 1);
    context.vars.randomFutureISO = futureTime.toISOString();
    return done();
  },

  // Log performance metrics
  logMetrics: function(context, events, done) {
    events.on('response', function(data) {
      const responseTime = data.response.time;
      const statusCode = data.response.statusCode;
      
      // Log slow responses
      if (responseTime > 1000) {
        console.log(`Slow response: ${data.url} - ${responseTime}ms`);
      }
      
      // Log errors
      if (statusCode >= 400) {
        console.log(`Error response: ${data.url} - ${statusCode}`);
      }
    });
    
    return done();
  },

  // Custom think time based on user type
  customThinkTime: function(context, events, done) {
    const userRole = context.vars.role || 'FieldTech';
    let thinkTime = 1000; // Default 1 second
    
    // Different think times for different user types
    switch (userRole) {
      case 'Admin':
        thinkTime = 500; // Admins work faster
        break;
      case 'Supervisor':
        thinkTime = 750;
        break;
      case 'FieldTech':
        thinkTime = 1000;
        break;
      case 'Client':
        thinkTime = 2000; // Clients take more time
        break;
    }
    
    // Add some randomness
    thinkTime = thinkTime + (Math.random() * 500 - 250);
    
    setTimeout(done, Math.max(100, thinkTime)); // Minimum 100ms
  },

  // Validate response structure
  validateResponse: function(context, events, done) {
    events.on('response', function(data) {
      try {
        const body = JSON.parse(data.response.body);
        
        // Check standard response structure
        if (typeof body.success !== 'boolean') {
          console.log(`Invalid response structure: missing success field in ${data.url}`);
        }
        
        if (body.success && !body.data) {
          console.log(`Invalid success response: missing data field in ${data.url}`);
        }
        
        if (!body.success && !body.error) {
          console.log(`Invalid error response: missing error field in ${data.url}`);
        }
      } catch (e) {
        console.log(`Invalid JSON response from ${data.url}`);
      }
    });
    
    return done();
  },

  // Monitor memory usage
  monitorMemory: function(context, events, done) {
    const memUsage = process.memoryUsage();
    
    // Log if memory usage is high
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      console.log(`High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
    
    context.vars.memoryUsage = memUsage;
    return done();
  },

  // Custom error handler
  handleError: function(context, events, done) {
    events.on('error', function(error) {
      console.log(`Load test error: ${error.message}`);
      
      // Log additional context
      if (context.vars.authToken) {
        console.log('User was authenticated');
      }
      
      if (context.vars.lastUrl) {
        console.log(`Last URL: ${context.vars.lastUrl}`);
      }
    });
    
    return done();
  },

  // Performance threshold checker
  checkPerformanceThresholds: function(context, events, done) {
    events.on('response', function(data) {
      const responseTime = data.response.time;
      const url = data.url;
      
      // Define thresholds for different endpoints
      const thresholds = {
        '/api/auth/login': 500,
        '/api/users/profile': 200,
        '/api/dashboard/stats': 800,
        '/api/analytics/summary': 1000,
        default: 600
      };
      
      // Find matching threshold
      let threshold = thresholds.default;
      for (const [endpoint, time] of Object.entries(thresholds)) {
        if (endpoint !== 'default' && url.includes(endpoint)) {
          threshold = time;
          break;
        }
      }
      
      // Log threshold violations
      if (responseTime > threshold) {
        console.log(`Performance threshold exceeded: ${url} took ${responseTime}ms (threshold: ${threshold}ms)`);
      }
    });
    
    return done();
  }
};

// Helper function to generate mock JWT tokens for testing
function generateMockToken(payload) {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

// Export performance test configurations
module.exports.PERFORMANCE_CONFIG = {
  thresholds: {
    response_time_p95: 800,
    response_time_p99: 1500,
    response_time_max: 3000,
    error_rate_max: 0.05,
    requests_per_second_min: 100
  },
  scenarios: {
    authentication: {
      weight: 30,
      think_time: 500
    },
    shift_management: {
      weight: 25,
      think_time: 1000
    },
    ticket_operations: {
      weight: 20,
      think_time: 750
    },
    analytics: {
      weight: 15,
      think_time: 2000
    },
    sla_monitoring: {
      weight: 10,
      think_time: 1500
    }
  }
};

// Export test data generators
module.exports.generators = {
  // Generate realistic shift data
  generateShiftData: function() {
    const now = new Date();
    const start = new Date(now.getTime() + Math.random() * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + (8 + Math.random() * 4) * 60 * 60 * 1000);
    
    return {
      scheduledStartTime: start.toISOString(),
      scheduledEndTime: end.toISOString(),
      location: {
        latitude: (40.7128 + (Math.random() - 0.5) * 0.1).toFixed(6),
        longitude: (-74.0060 + (Math.random() - 0.5) * 0.1).toFixed(6),
        accuracy: Math.floor(Math.random() * 20) + 5
      }
    };
  },

  // Generate realistic ticket data
  generateTicketData: function() {
    const titles = [
      'Equipment malfunction in Building A',
      'Network connectivity issues',
      'HVAC system not working',
      'Security camera offline',
      'Elevator maintenance required',
      'Power outage in sector 3',
      'Water leak in basement',
      'Fire alarm system check'
    ];
    
    const priorities = ['low', 'medium', 'high', 'critical'];
    const categories = ['maintenance', 'security', 'network', 'facilities', 'safety'];
    
    return {
      title: titles[Math.floor(Math.random() * titles.length)],
      description: 'Load test generated ticket for performance testing',
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      location: {
        latitude: (40.7128 + (Math.random() - 0.5) * 0.2).toFixed(6),
        longitude: (-74.0060 + (Math.random() - 0.5) * 0.2).toFixed(6)
      }
    };
  }
};