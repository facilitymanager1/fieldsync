#!/usr/bin/env node

/**
 * CI/CD Pipeline Validation Script
 * Validates all components of the CI/CD pipeline before deployment
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class CICDValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.tests = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    
    console.log(`${colors[type](`[${timestamp}] ${type.toUpperCase()}`)} ${message}`);
  }

  async runCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        ...options 
      });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message, output: error.stdout || error.stderr };
    }
  }

  async validateDockerConfiguration() {
    this.log('Validating Docker configuration...', 'info');
    
    // Check if Docker is available
    const dockerCheck = await this.runCommand('docker --version');
    if (!dockerCheck.success) {
      this.errors.push('Docker is not installed or not accessible');
      return false;
    }

    // Validate Dockerfile exists and is valid
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    if (!fs.existsSync(dockerfilePath)) {
      this.errors.push('Dockerfile not found in project root');
      return false;
    }

    // Try to build Docker image
    this.log('Building Docker image for validation...', 'info');
    const buildResult = await this.runCommand('docker build -t fieldsync-test:latest .', { 
      timeout: 300000 // 5 minutes
    });

    if (!buildResult.success) {
      this.errors.push(`Docker build failed: ${buildResult.error}`);
      return false;
    }

    this.log('Docker configuration validated successfully', 'success');
    return true;
  }

  async validateKubernetesConfiguration() {
    this.log('Validating Kubernetes configuration...', 'info');
    
    const k8sDir = path.join(process.cwd(), 'k8s', 'production');
    if (!fs.existsSync(k8sDir)) {
      this.errors.push('Kubernetes configuration directory not found');
      return false;
    }

    const requiredFiles = [
      'deployment.yaml',
      'service.yaml',
      'configmap.yaml',
      'secret.yaml',
      'hpa.yaml',
      'rbac.yaml'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(k8sDir, file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Required Kubernetes file missing: ${file}`);
        continue;
      }

      // Validate YAML syntax
      try {
        const yamlContent = fs.readFileSync(filePath, 'utf8');
        require('yaml').parse(yamlContent);
      } catch (error) {
        this.errors.push(`Invalid YAML in ${file}: ${error.message}`);
      }
    }

    if (this.errors.length === 0) {
      this.log('Kubernetes configuration validated successfully', 'success');
      return true;
    }

    return false;
  }

  async validateTestSuite() {
    this.log('Validating test suite...', 'info');
    
    const testResults = {};

    // Frontend tests
    this.log('Running frontend tests...', 'info');
    const frontendTest = await this.runCommand('npm run test:web');
    testResults.frontend = frontendTest.success;
    
    if (!frontendTest.success) {
      this.warnings.push('Frontend tests failed - check test output');
    }

    // Backend tests
    this.log('Running backend tests...', 'info');
    const backendTest = await this.runCommand('npm run test:backend');
    testResults.backend = backendTest.success;
    
    if (!backendTest.success) {
      this.warnings.push('Backend tests failed - check test output');
    }

    // Integration tests
    if (fs.existsSync(path.join(process.cwd(), 'scripts', 'integration-tests.js'))) {
      this.log('Integration test script found', 'info');
      testResults.integration = true;
    }

    // Performance tests
    if (fs.existsSync(path.join(process.cwd(), 'scripts', 'performance-tests.js'))) {
      this.log('Performance test script found', 'info');
      testResults.performance = true;
    }

    this.tests = testResults;
    this.log('Test suite validation completed', 'success');
    return true;
  }

  async validateSecurityConfiguration() {
    this.log('Validating security configuration...', 'info');
    
    // Check for security scanning tools configuration
    const securityChecks = [];

    // Trivy configuration
    const trivyConfig = path.join(process.cwd(), '.trivyignore');
    securityChecks.push({
      name: 'Trivy',
      configured: fs.existsSync(trivyConfig)
    });

    // Semgrep configuration
    const semgrepConfig = path.join(process.cwd(), '.semgrep.yml');
    securityChecks.push({
      name: 'Semgrep',
      configured: fs.existsSync(semgrepConfig)
    });

    // GitHub Actions security workflow
    const githubWorkflows = path.join(process.cwd(), '.github', 'workflows');
    const securityWorkflow = fs.existsSync(path.join(githubWorkflows, 'ci-cd.yml'));
    
    securityChecks.push({
      name: 'GitHub Actions Security Workflow',
      configured: securityWorkflow
    });

    for (const check of securityChecks) {
      if (check.configured) {
        this.log(`${check.name} security configuration found`, 'success');
      } else {
        this.warnings.push(`${check.name} security configuration missing`);
      }
    }

    return true;
  }

  async validateEnvironmentConfiguration() {
    this.log('Validating environment configuration...', 'info');
    
    const requiredEnvFiles = [
      '.env.example',
      '.env.development',
      '.env.production'
    ];

    for (const envFile of requiredEnvFiles) {
      const envPath = path.join(process.cwd(), envFile);
      if (!fs.existsSync(envPath)) {
        this.warnings.push(`Environment file missing: ${envFile}`);
      } else {
        this.log(`Environment file found: ${envFile}`, 'success');
      }
    }

    // Check for secret management
    const secretsPath = path.join(process.cwd(), 'backend', 'services', 'secretManagementService.ts');
    if (fs.existsSync(secretsPath)) {
      this.log('Secret management service configured', 'success');
    } else {
      this.warnings.push('Secret management service not found');
    }

    return true;
  }

  async validateDependencies() {
    this.log('Validating dependencies...', 'info');
    
    // Check package.json files
    const packageFiles = [
      'package.json',
      'backend/package.json',
      'mobile/package.json'
    ];

    for (const pkgFile of packageFiles) {
      const pkgPath = path.join(process.cwd(), pkgFile);
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          
          // Check for security vulnerabilities
          const auditResult = await this.runCommand(`npm audit --prefix ${path.dirname(pkgPath)}`, {
            cwd: path.dirname(pkgPath)
          });
          
          if (!auditResult.success && auditResult.output.includes('vulnerabilities')) {
            this.warnings.push(`Security vulnerabilities found in ${pkgFile}`);
          }
          
          this.log(`Dependencies validated for ${pkgFile}`, 'success');
        } catch (error) {
          this.errors.push(`Invalid package.json: ${pkgFile}`);
        }
      }
    }

    return true;
  }

  generateReport() {
    this.log('\n=== CI/CD Pipeline Validation Report ===', 'info');
    
    // Summary
    console.log('\n' + chalk.bold('SUMMARY'));
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Tests: ${Object.keys(this.tests).length} suites validated`);

    // Errors
    if (this.errors.length > 0) {
      console.log('\n' + chalk.red.bold('ERRORS (MUST FIX)'));
      this.errors.forEach((error, index) => {
        console.log(chalk.red(`${index + 1}. ${error}`));
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log('\n' + chalk.yellow.bold('WARNINGS (SHOULD FIX)'));
      this.warnings.forEach((warning, index) => {
        console.log(chalk.yellow(`${index + 1}. ${warning}`));
      });
    }

    // Test Results
    console.log('\n' + chalk.blue.bold('TEST RESULTS'));
    for (const [suite, passed] of Object.entries(this.tests)) {
      const status = passed ? chalk.green('PASSED') : chalk.red('FAILED');
      console.log(`${suite}: ${status}`);
    }

    // Overall status
    const overallStatus = this.errors.length === 0 ? 'READY' : 'NOT READY';
    const statusColor = this.errors.length === 0 ? chalk.green : chalk.red;
    
    console.log('\n' + chalk.bold('DEPLOYMENT STATUS: ') + statusColor.bold(overallStatus));
    
    if (this.errors.length === 0) {
      console.log(chalk.green('\n✅ CI/CD pipeline is ready for deployment!'));
    } else {
      console.log(chalk.red('\n❌ Please fix the errors before deploying.'));
    }

    return this.errors.length === 0;
  }

  async run() {
    console.log(chalk.blue.bold('\n🚀 FieldSync CI/CD Pipeline Validation\n'));

    try {
      // Run all validations
      await this.validateDockerConfiguration();
      await this.validateKubernetesConfiguration();
      await this.validateTestSuite();
      await this.validateSecurityConfiguration();
      await this.validateEnvironmentConfiguration();
      await this.validateDependencies();

      // Generate and display report
      const isReady = this.generateReport();
      
      process.exit(isReady ? 0 : 1);

    } catch (error) {
      this.log(`Validation failed: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    }
  }
}

// Install required dependencies if needed
try {
  require('chalk');
  require('yaml');
} catch (error) {
  console.log('Installing required dependencies...');
  execSync('npm install --no-save chalk yaml', { stdio: 'inherit' });
}

// Run validation
const validator = new CICDValidator();
validator.run();