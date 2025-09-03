#!/usr/bin/env node

/**
 * Node.js Load Testing Script for FieldSync
 * Comprehensive performance testing with realistic user scenarios
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  baseUrl: process.env.TARGET_URL || 'http://localhost:3001',
  webUrl: process.env.WEB_URL || 'http://localhost:3000',
  scenarios: {
    smoke: { users: 1, duration: 60, rampUp: 0 },
    load: { users: 10, duration: 300, rampUp: 60 },
    stress: { users: 50, duration: 300, rampUp: 120 },
    spike: { users: 100, duration: 180, rampUp: 10 }
  },
  endpoints: [
    { path: '/health', method: 'GET', weight: 0.1 },
    { path: '/api/auth/methods', method: 'GET', weight: 0.2 },
    { path: '/api/monitoring/health', method: 'GET', weight: 0.15 },
    { path: '/api/monitoring/metrics', method: 'GET', weight: 0.15, auth: true },
    { path: '/api/monitoring/performance', method: 'GET', weight: 0.15, auth: true },
    { path: '/api/ticket?limit=20', method: 'GET', weight: 0.1, auth: true },
    { path: '/api/staff?limit=50', method: 'GET', weight: 0.1, auth: true },
    { path: '/api/analytics/metrics', method: 'GET', weight: 0.05, auth: true }
  ]
};

// Test data
const testUsers = Array.from({ length: 100 }, (_, i) => ({
  id: `user_${i + 1}`,
  email: `testuser${i + 1}@fieldsync.io`,
  password: 'TestPass123!',
  role: ['field_tech', 'supervisor', 'admin'][i % 3],
  name: `Test User ${i + 1}`
}));

// Statistics tracking
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errorsByCode: {},
  startTime: null,
  endTime: null,
  users: 0,
  peakUsers: 0
};

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const module = parsedUrl.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FieldSync-LoadTest/1.0',
        ...options.headers
      },
      timeout: 30000
    };

    if (options.body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const startTime = performance.now();
    
    const req = module.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        stats.totalRequests++;
        stats.responseTimes.push(responseTime);
        
        if (res.statusCode >= 200 && res.statusCode < 400) {
          stats.successfulRequests++;
        } else {
          stats.failedRequests++;
          stats.errorsByCode[res.statusCode] = (stats.errorsByCode[res.statusCode] || 0) + 1;
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          responseTime
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      stats.totalRequests++;
      stats.failedRequests++;
      stats.responseTimes.push(responseTime);
      stats.errorsByCode['ERROR'] = (stats.errorsByCode['ERROR'] || 0) + 1;
      
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      stats.totalRequests++;
      stats.failedRequests++;
      stats.responseTimes.push(responseTime);
      stats.errorsByCode['TIMEOUT'] = (stats.errorsByCode['TIMEOUT'] || 0) + 1;
      
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function authenticateUser(user) {
  try {
    const response = await makeRequest(`${CONFIG.baseUrl}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      return data.token || null;
    }
    return null;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return null;
  }
}

function selectEndpoint() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const endpoint of CONFIG.endpoints) {
    cumulativeWeight += endpoint.weight;
    if (random <= cumulativeWeight) {
      return endpoint;
    }
  }
  
  return CONFIG.endpoints[0];
}

async function userSession(user, authToken, duration) {
  const endTime = Date.now() + duration * 1000;
  
  while (Date.now() < endTime) {
    try {
      const endpoint = selectEndpoint();
      const headers = {};
      
      if (endpoint.auth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      await makeRequest(`${CONFIG.baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers
      });
      
      // Think time between requests (1-3 seconds)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      
    } catch (error) {
      // Error already logged in makeRequest
    }
  }
}

async function runScenario(scenarioName) {
  const scenario = CONFIG.scenarios[scenarioName];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }
  
  console.log(`\n🚀 Running ${scenarioName.toUpperCase()} test scenario`);
  console.log(`Target: ${CONFIG.baseUrl}`);
  console.log(`Users: ${scenario.users}, Duration: ${scenario.duration}s, Ramp-up: ${scenario.rampUp}s\n`);
  
  // Reset stats
  Object.assign(stats, {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
    errorsByCode: {},
    startTime: Date.now(),
    endTime: null,
    users: 0,
    peakUsers: 0
  });
  
  // Warmup
  console.log('🔥 Warming up application...');
  try {
    await makeRequest(`${CONFIG.baseUrl}/health`);
    console.log('✅ Warmup successful\n');
  } catch (error) {
    console.log('❌ Warmup failed, continuing anyway\n');
  }
  
  const activeUsers = new Set();
  const userPromises = [];
  
  // Ramp up users
  for (let i = 0; i < scenario.users; i++) {
    const delay = (scenario.rampUp * 1000 * i) / scenario.users;
    
    setTimeout(async () => {
      const user = testUsers[i % testUsers.length];
      const userId = `${user.id}_${i}`;
      activeUsers.add(userId);
      stats.users = activeUsers.size;
      stats.peakUsers = Math.max(stats.peakUsers, stats.users);
      
      // Authenticate user
      const authToken = await authenticateUser(user);
      
      // Run user session
      const sessionPromise = userSession(user, authToken, scenario.duration)
        .finally(() => {
          activeUsers.delete(userId);
          stats.users = activeUsers.size;
        });
      
      userPromises.push(sessionPromise);
    }, delay);
  }
  
  // Progress reporting
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const avgResponseTime = stats.responseTimes.length > 0 
      ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length 
      : 0;
    
    console.log(`⏱️  ${elapsed.toFixed(0)}s | Users: ${stats.users} | Requests: ${stats.totalRequests} | Avg RT: ${avgResponseTime.toFixed(0)}ms | Success: ${((stats.successfulRequests / Math.max(stats.totalRequests, 1)) * 100).toFixed(1)}%`);
  }, 5000);
  
  // Wait for test completion
  await Promise.allSettled(userPromises);
  clearInterval(progressInterval);
  
  stats.endTime = Date.now();
  generateReport(scenarioName);
}

function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function generateReport(scenarioName) {
  const duration = (stats.endTime - stats.startTime) / 1000;
  const avgResponseTime = stats.responseTimes.length > 0 
    ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length 
    : 0;
  
  const p50 = calculatePercentile(stats.responseTimes, 50);
  const p95 = calculatePercentile(stats.responseTimes, 95);
  const p99 = calculatePercentile(stats.responseTimes, 99);
  
  const requestsPerSecond = stats.totalRequests / duration;
  const errorRate = (stats.failedRequests / Math.max(stats.totalRequests, 1)) * 100;
  
  console.log('\n' + '='.repeat(60));
  console.log(`🏁 ${scenarioName.toUpperCase()} Test Results`);
  console.log('='.repeat(60));
  console.log(`📊 Test Overview:`);
  console.log(`   Duration: ${duration.toFixed(1)}s`);
  console.log(`   Peak Users: ${stats.peakUsers}`);
  console.log(`   Total Requests: ${stats.totalRequests}`);
  console.log(`   Requests/sec: ${requestsPerSecond.toFixed(2)}`);
  console.log('');
  console.log(`⚡ Performance Metrics:`);
  console.log(`   Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   50th Percentile: ${p50.toFixed(0)}ms`);
  console.log(`   95th Percentile: ${p95.toFixed(0)}ms`);
  console.log(`   99th Percentile: ${p99.toFixed(0)}ms`);
  console.log('');
  console.log(`📈 Success Metrics:`);
  console.log(`   Successful Requests: ${stats.successfulRequests}`);
  console.log(`   Failed Requests: ${stats.failedRequests}`);
  console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
  console.log('');
  
  if (Object.keys(stats.errorsByCode).length > 0) {
    console.log(`❌ Error Breakdown:`);
    Object.entries(stats.errorsByCode).forEach(([code, count]) => {
      console.log(`   ${code}: ${count} requests`);
    });
    console.log('');
  }
  
  // Performance assessment
  console.log(`🎯 Performance Assessment:`);
  const assessments = [];
  
  if (p95 < 2000) assessments.push('✅ 95th percentile under 2s');
  else assessments.push('❌ 95th percentile exceeds 2s');
  
  if (p99 < 5000) assessments.push('✅ 99th percentile under 5s');
  else assessments.push('❌ 99th percentile exceeds 5s');
  
  if (errorRate < 5) assessments.push('✅ Error rate below 5%');
  else assessments.push('❌ Error rate exceeds 5%');
  
  if (requestsPerSecond > 10) assessments.push('✅ Good throughput (>10 req/s)');
  else assessments.push('⚠️ Low throughput (<10 req/s)');
  
  assessments.forEach(assessment => console.log(`   ${assessment}`));
  console.log('\n');
  
  // Save results
  const results = {
    scenario: scenarioName,
    timestamp: new Date().toISOString(),
    duration,
    peakUsers: stats.peakUsers,
    totalRequests: stats.totalRequests,
    requestsPerSecond,
    avgResponseTime,
    percentiles: { p50, p95, p99 },
    successRate: ((stats.successfulRequests / Math.max(stats.totalRequests, 1)) * 100),
    errorRate,
    errorsByCode: stats.errorsByCode
  };
  
  require('fs').writeFileSync(
    `C:\\Users\\prade\\fieldsync\\load-test-${scenarioName}-${Date.now()}.json`, 
    JSON.stringify(results, null, 2)
  );
}

async function main() {
  const scenarioName = process.argv[2] || 'smoke';
  
  if (!CONFIG.scenarios[scenarioName]) {
    console.error(`❌ Unknown scenario: ${scenarioName}`);
    console.log(`Available scenarios: ${Object.keys(CONFIG.scenarios).join(', ')}`);
    process.exit(1);
  }
  
  try {
    await runScenario(scenarioName);
    console.log('🎉 Load testing completed successfully!');
  } catch (error) {
    console.error('❌ Load testing failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runScenario, CONFIG, stats };