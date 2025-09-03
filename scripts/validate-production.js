#!/usr/bin/env node

/**
 * FieldSync Production Validation Script
 * Validates that the application is properly configured for production deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Utility functions
const log = (color, message) => console.log(`${color}${message}${colors.reset}`);
const success = (message) => log(colors.green, `✅ ${message}`);
const error = (message) => log(colors.red, `❌ ${message}`);
const warning = (message) => log(colors.yellow, `⚠️  ${message}`);
const info = (message) => log(colors.blue, `ℹ️  ${message}`);
const header = (message) => log(colors.cyan, `\n🔍 ${message}`);

// Validation results
let validationResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
};

function addResult(type, message) {
  if (type === 'success') {
    validationResults.passed++;
    success(message);
  } else if (type === 'error') {
    validationResults.failed++;
    validationResults.errors.push(message);
    error(message);
  } else if (type === 'warning') {
    validationResults.warnings++;
    warning(message);
  }
}

// Load environment variables
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

// Validation functions
function validateEnvironment() {
  header('Environment Configuration');
  
  const envPath = path.join(__dirname, '../backend/.env');
  const env = loadEnvFile(envPath);
  
  if (Object.keys(env).length === 0) {
    addResult('error', 'Environment file (.env) not found or empty');
    return;
  }
  
  addResult('success', 'Environment file loaded successfully');
  
  // Required environment variables
  const required = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
    'REFRESH_SECRET',
    'CSRF_SECRET'
  ];
  
  required.forEach(key => {
    if (!env[key]) {
      addResult('error', `Missing required environment variable: ${key}`);
    } else {
      addResult('success', `Environment variable ${key} is set`);
    }
  });
  
  // Production-specific checks
  if (env.NODE_ENV === 'production') {
    // Check secret strength
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
      addResult('error', 'JWT_SECRET should be at least 32 characters in production');
    } else if (env.JWT_SECRET) {
      addResult('success', 'JWT_SECRET has adequate length');
    }
    
    if (env.REFRESH_SECRET && env.REFRESH_SECRET.length < 32) {
      addResult('error', 'REFRESH_SECRET should be at least 32 characters in production');
    } else if (env.REFRESH_SECRET) {
      addResult('success', 'REFRESH_SECRET has adequate length');
    }
    
    // Check for default values
    const dangerousDefaults = ['changeme', 'your-secret', 'development'];
    const secrets = ['JWT_SECRET', 'REFRESH_SECRET', 'CSRF_SECRET'];
    
    secrets.forEach(secret => {
      if (env[secret] && dangerousDefaults.some(def => env[secret].includes(def))) {
        addResult('error', `${secret} appears to contain default/insecure values`);
      } else if (env[secret]) {
        addResult('success', `${secret} appears to be properly configured`);
      }
    });
    
    // CORS configuration
    if (env.CORS_ORIGIN && env.CORS_ORIGIN.includes('localhost')) {
      addResult('warning', 'CORS_ORIGIN includes localhost - ensure this is intentional for production');
    }
    
    // HTTPS enforcement
    if (!env.FORCE_HTTPS || env.FORCE_HTTPS !== 'true') {
      addResult('warning', 'HTTPS is not enforced - consider setting FORCE_HTTPS=true');
    }
  }
  
  return env;
}

function validateDependencies() {
  header('Dependencies');
  
  const packagePath = path.join(__dirname, '../package.json');
  const backendPackagePath = path.join(__dirname, '../backend/package.json');
  const mobilePackagePath = path.join(__dirname, '../mobile/package.json');
  
  [
    { path: packagePath, name: 'Root' },
    { path: backendPackagePath, name: 'Backend' },
    { path: mobilePackagePath, name: 'Mobile' }
  ].forEach(({ path: pkgPath, name }) => {
    if (fs.existsSync(pkgPath)) {
      addResult('success', `${name} package.json exists`);
      
      const nodeModulesPath = path.join(path.dirname(pkgPath), 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        addResult('success', `${name} dependencies installed`);
      } else {
        addResult('error', `${name} dependencies not installed (missing node_modules)`);
      }
    } else {
      addResult('error', `${name} package.json not found`);
    }
  });
}

function validateBuild() {
  header('Build Artifacts');
  
  // Check backend build
  const backendDist = path.join(__dirname, '../backend/dist');
  if (fs.existsSync(backendDist)) {
    addResult('success', 'Backend build artifacts exist');
    
    const mainFile = path.join(backendDist, 'index.js');
    if (fs.existsSync(mainFile)) {
      addResult('success', 'Backend main entry point exists');
    } else {
      addResult('error', 'Backend main entry point (dist/index.js) not found');
    }
  } else {
    addResult('error', 'Backend not built (missing dist directory)');
  }
  
  // Check web build
  const nextBuild = path.join(__dirname, '../.next');
  if (fs.existsSync(nextBuild)) {
    addResult('success', 'Web application build artifacts exist');
  } else {
    addResult('warning', 'Web application not built (missing .next directory)');
  }
}

function validateSecurity() {
  header('Security Configuration');
  
  // Check for common security files
  const securityFiles = [
    { path: '../backend/config/security.ts', name: 'Security configuration' },
    { path: '../backend/middleware/auth.ts', name: 'Authentication middleware' },
    { path: '../backend/middleware/csrfProtection.ts', name: 'CSRF protection' },
    { path: '../backend/middleware/rateLimiter.ts', name: 'Rate limiting' }
  ];
  
  securityFiles.forEach(({ path: filePath, name }) => {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      addResult('success', `${name} file exists`);
    } else {
      addResult('error', `${name} file missing`);
    }
  });
  
  // Check SSL certificates (if configured)
  const certDir = path.join(__dirname, '../backend/certs');
  if (fs.existsSync(certDir)) {
    const certFile = path.join(certDir, 'cert.pem');
    const keyFile = path.join(certDir, 'key.pem');
    
    if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
      addResult('success', 'SSL certificates found');
    } else {
      addResult('warning', 'SSL certificate directory exists but certificates are missing');
    }
  } else {
    addResult('warning', 'SSL certificates not configured');
  }
}

function validateDatabase() {
  header('Database Configuration');
  
  const env = loadEnvFile(path.join(__dirname, '../backend/.env'));
  
  if (env.MONGODB_URI) {
    if (env.MONGODB_URI.includes('localhost') && env.NODE_ENV === 'production') {
      addResult('warning', 'MongoDB URI points to localhost in production environment');
    } else {
      addResult('success', 'MongoDB URI configured');
    }
    
    // Check for authentication in connection string
    if (env.MONGODB_URI.includes('@')) {
      addResult('success', 'MongoDB connection includes authentication');
    } else {
      addResult('warning', 'MongoDB connection does not include authentication');
    }
  } else {
    addResult('error', 'MongoDB URI not configured');
  }
}

function validateLogging() {
  header('Logging Configuration');
  
  const logsDir = path.join(__dirname, '../logs');
  if (fs.existsSync(logsDir)) {
    addResult('success', 'Logs directory exists');
    
    // Check write permissions
    try {
      const testFile = path.join(logsDir, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      addResult('success', 'Logs directory is writable');
    } catch (e) {
      addResult('error', 'Logs directory is not writable');
    }
  } else {
    addResult('warning', 'Logs directory does not exist - will be created at runtime');
  }
  
  // Check for log rotation configuration
  const logRotateConfig = '/etc/logrotate.d/fieldsync';
  if (fs.existsSync(logRotateConfig)) {
    addResult('success', 'Log rotation configured');
  } else {
    addResult('warning', 'Log rotation not configured');
  }
}

function validateProcessManagement() {
  header('Process Management');
  
  const ecosystemConfig = path.join(__dirname, '../ecosystem.config.js');
  if (fs.existsSync(ecosystemConfig)) {
    addResult('success', 'PM2 ecosystem configuration exists');
  } else {
    addResult('warning', 'PM2 ecosystem configuration not found');
  }
  
  // Check if PM2 is installed
  try {
    require.resolve('pm2');
    addResult('success', 'PM2 is available');
  } catch (e) {
    addResult('warning', 'PM2 not found - consider installing for production process management');
  }
}

function validateSystemdService() {
  header('System Service');
  
  const serviceFile = '/etc/systemd/system/fieldsync.service';
  if (fs.existsSync(serviceFile)) {
    addResult('success', 'Systemd service configured');
  } else {
    addResult('warning', 'Systemd service not configured - manual process management required');
  }
}

function validateFirewall() {
  header('Network Security');
  
  // This is a basic check - in production you'd want more sophisticated validation
  const env = loadEnvFile(path.join(__dirname, '../backend/.env'));
  
  if (env.PORT) {
    const port = parseInt(env.PORT);
    if (port < 1024 && process.getuid && process.getuid() !== 0) {
      addResult('warning', `Port ${port} requires root privileges to bind`);
    } else {
      addResult('success', `Application port ${port} configured`);
    }
  }
  
  addResult('warning', 'Firewall configuration should be verified manually');
}

function generateReport() {
  header('Validation Summary');
  
  console.log(`\n📊 Validation Results:`);
  console.log(`   ✅ Passed: ${colors.green}${validationResults.passed}${colors.reset}`);
  console.log(`   ❌ Failed: ${colors.red}${validationResults.failed}${colors.reset}`);
  console.log(`   ⚠️  Warnings: ${colors.yellow}${validationResults.warnings}${colors.reset}`);
  
  if (validationResults.failed > 0) {
    console.log(`\n${colors.red}🚨 Critical Issues Found:${colors.reset}`);
    validationResults.errors.forEach(err => console.log(`   • ${err}`));
    console.log(`\n${colors.red}❌ Application is NOT ready for production deployment${colors.reset}`);
    process.exit(1);
  } else if (validationResults.warnings > 0) {
    console.log(`\n${colors.yellow}⚠️  Warnings found - review before deployment${colors.reset}`);
    console.log(`${colors.green}✅ Application is conditionally ready for production${colors.reset}`);
  } else {
    console.log(`\n${colors.green}🎉 All validations passed - application is ready for production!${colors.reset}`);
  }
  
  // Generate timestamp
  const timestamp = new Date().toISOString();
  console.log(`\n📅 Validation completed at: ${timestamp}`);
}

// Main execution
function main() {
  console.log(`${colors.cyan}🚀 FieldSync Production Readiness Validation${colors.reset}\n`);
  
  try {
    validateEnvironment();
    validateDependencies();
    validateBuild();
    validateSecurity();
    validateDatabase();
    validateLogging();
    validateProcessManagement();
    
    // Linux-specific checks
    if (process.platform === 'linux') {
      validateSystemdService();
    }
    
    validateFirewall();
    generateReport();
    
  } catch (error) {
    console.error(`${colors.red}❌ Validation failed with error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  validateDependencies,
  validateBuild,
  validateSecurity,
  main
};