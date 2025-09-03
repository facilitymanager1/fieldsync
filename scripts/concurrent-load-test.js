#!/usr/bin/env node

/**
 * Concurrent Load Testing for FieldSync
 * Simulates realistic user load with concurrent requests
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { performance } = require('perf_hooks');

// Test configuration
const CONFIG = {
  baseUrl: 'http://localhost:3001',
  concurrentUsers: 20,
  requestsPerUser: 50,
  thinkTime: 100, // ms between requests
  timeout: 10000,
  endpoints: [
    { path: '/health', weight: 0.3 },
    { path: '/api/auth/methods', weight: 0.2 },
    { path: '/api/monitoring/health', weight: 0.2 },
    { path: '/api/monitoring/metrics', weight: 0.15, auth: true },
    { path: '/api/monitoring/performance', weight: 0.15, auth: true }
  ]
};

// Statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errorsByCode: {},
  concurrentUsers: 0,
  startTime: null,
  endTime: null
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
        'User-Agent': 'FieldSync-ConcurrentTest/1.0',
        ...options.headers
      },
      timeout: CONFIG.timeout
    };

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

function selectRandomEndpoint() {
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

async function simulateUser(userId) {
  console.log(`👤 User ${userId} starting...`);
  stats.concurrentUsers++;
  
  try {
    for (let i = 0; i < CONFIG.requestsPerUser; i++) {
      const endpoint = selectRandomEndpoint();
      
      try {
        const response = await makeRequest(`${CONFIG.baseUrl}${endpoint.path}`);
        
        if (i % 10 === 0) {
          console.log(`👤 User ${userId}: Request ${i + 1}/${CONFIG.requestsPerUser} - ${response.statusCode} (${response.responseTime.toFixed(0)}ms)`);
        }
        
        // Think time between requests
        if (i < CONFIG.requestsPerUser - 1) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.thinkTime + Math.random() * CONFIG.thinkTime));
        }
        
      } catch (error) {
        console.log(`👤 User ${userId}: Request ${i + 1} failed - ${error.message}`);
      }
    }
  } finally {
    stats.concurrentUsers--;
    console.log(`👤 User ${userId} completed. Active users: ${stats.concurrentUsers}`);
  }
}

function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function generateReport() {
  const duration = (stats.endTime - stats.startTime) / 1000;
  const avgResponseTime = stats.responseTimes.length > 0 
    ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length 
    : 0;
  
  const p50 = calculatePercentile(stats.responseTimes, 50);
  const p95 = calculatePercentile(stats.responseTimes, 95);
  const p99 = calculatePercentile(stats.responseTimes, 99);
  
  const requestsPerSecond = stats.totalRequests / duration;
  const errorRate = (stats.failedRequests / Math.max(stats.totalRequests, 1)) * 100;
  
  console.log('\n' + '='.repeat(70));
  console.log('🚀 FieldSync Concurrent Load Test Results');
  console.log('='.repeat(70));
  console.log(`📊 Test Configuration:`);
  console.log(`   Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`   Requests per User: ${CONFIG.requestsPerUser}`);
  console.log(`   Total Planned Requests: ${CONFIG.concurrentUsers * CONFIG.requestsPerUser}`);
  console.log(`   Think Time: ${CONFIG.thinkTime}ms`);
  console.log('');
  console.log(`📊 Test Results:`);
  console.log(`   Duration: ${duration.toFixed(1)}s`);
  console.log(`   Total Requests: ${stats.totalRequests}`);
  console.log(`   Requests/sec: ${requestsPerSecond.toFixed(2)}`);
  console.log('');
  console.log(`⚡ Performance Metrics:`);
  console.log(`   Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   50th Percentile: ${p50.toFixed(0)}ms`);
  console.log(`   95th Percentile: ${p95.toFixed(0)}ms`);
  console.log(`   99th Percentile: ${p99.toFixed(0)}ms`);
  console.log(`   Min Response Time: ${Math.min(...stats.responseTimes).toFixed(0)}ms`);
  console.log(`   Max Response Time: ${Math.max(...stats.responseTimes).toFixed(0)}ms`);
  console.log('');
  console.log(`📈 Success Metrics:`);
  console.log(`   Successful Requests: ${stats.successfulRequests}`);
  console.log(`   Failed Requests: ${stats.failedRequests}`);
  console.log(`   Success Rate: ${((stats.successfulRequests / Math.max(stats.totalRequests, 1)) * 100).toFixed(2)}%`);
  console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
  console.log('');
  
  if (Object.keys(stats.errorsByCode).length > 0) {
    console.log(`❌ Error Breakdown:`);
    Object.entries(stats.errorsByCode).forEach(([code, count]) => {
      console.log(`   ${code}: ${count} requests (${((count / stats.totalRequests) * 100).toFixed(1)}%)`);
    });
    console.log('');
  }
  
  // Performance assessment
  console.log(`🎯 Performance Assessment:`);
  const assessments = [];
  
  if (p95 < 1000) assessments.push('✅ Excellent: 95th percentile under 1s');
  else if (p95 < 2000) assessments.push('✅ Good: 95th percentile under 2s');
  else assessments.push('❌ Poor: 95th percentile exceeds 2s');
  
  if (p99 < 2000) assessments.push('✅ Excellent: 99th percentile under 2s');
  else if (p99 < 5000) assessments.push('✅ Good: 99th percentile under 5s');
  else assessments.push('❌ Poor: 99th percentile exceeds 5s');
  
  if (errorRate < 1) assessments.push('✅ Excellent: Error rate below 1%');
  else if (errorRate < 5) assessments.push('✅ Good: Error rate below 5%');
  else assessments.push('❌ Poor: Error rate exceeds 5%');
  
  if (requestsPerSecond > 100) assessments.push('✅ Excellent: High throughput (>100 req/s)');
  else if (requestsPerSecond > 50) assessments.push('✅ Good: Good throughput (>50 req/s)');
  else if (requestsPerSecond > 10) assessments.push('⚠️ Fair: Moderate throughput (>10 req/s)');
  else assessments.push('❌ Poor: Low throughput (<10 req/s)');
  
  assessments.forEach(assessment => console.log(`   ${assessment}`));
  
  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    duration,
    totalRequests: stats.totalRequests,
    requestsPerSecond,
    avgResponseTime,
    percentiles: { p50, p95, p99 },
    successRate: ((stats.successfulRequests / Math.max(stats.totalRequests, 1)) * 100),
    errorRate,
    errorsByCode: stats.errorsByCode,
    assessments
  };
  
  require('fs').writeFileSync(
    `C:\\Users\\prade\\fieldsync\\concurrent-load-test-${Date.now()}.json`, 
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\n📊 Detailed results saved to concurrent-load-test-${Date.now()}.json`);
}

async function main() {
  console.log('🚀 Starting FieldSync Concurrent Load Test');
  console.log(`Target: ${CONFIG.baseUrl}`);
  console.log(`Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`Requests per User: ${CONFIG.requestsPerUser}`);
  console.log(`Total Requests: ${CONFIG.concurrentUsers * CONFIG.requestsPerUser}`);
  console.log('');
  
  // Warmup
  console.log('🔥 Warming up application...');
  try {
    await makeRequest(`${CONFIG.baseUrl}/health`);
    console.log('✅ Warmup successful\n');
  } catch (error) {
    console.log('❌ Warmup failed, continuing anyway\n');
  }
  
  // Reset stats
  stats.startTime = Date.now();
  stats.totalRequests = 0;
  stats.successfulRequests = 0;
  stats.failedRequests = 0;
  stats.responseTimes = [];
  stats.errorsByCode = {};
  stats.concurrentUsers = 0;
  
  // Start concurrent users
  console.log('👥 Starting concurrent users...\n');
  const userPromises = [];
  
  for (let i = 0; i < CONFIG.concurrentUsers; i++) {
    // Stagger user start times slightly to simulate real-world conditions
    setTimeout(() => {
      userPromises.push(simulateUser(i + 1));
    }, i * 50); // 50ms stagger
  }
  
  // Progress reporting
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const avgResponseTime = stats.responseTimes.length > 0 
      ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length 
      : 0;
    
    console.log(`⏱️  ${elapsed.toFixed(0)}s | Active Users: ${stats.concurrentUsers} | Requests: ${stats.totalRequests} | Avg RT: ${avgResponseTime.toFixed(0)}ms | Success: ${((stats.successfulRequests / Math.max(stats.totalRequests, 1)) * 100).toFixed(1)}%`);
  }, 5000);
  
  // Wait for all users to complete
  await Promise.allSettled(userPromises);
  clearInterval(progressInterval);
  
  stats.endTime = Date.now();
  
  console.log('\n✅ All users completed!');
  generateReport();
}

// Run the test
main().catch(console.error);