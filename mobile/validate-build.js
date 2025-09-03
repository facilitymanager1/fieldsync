#!/usr/bin/env node

/**
 * Build Validation Script for React Native Mobile App
 * 
 * This script performs comprehensive validation checks before creating a release build:
 * 1. TypeScript compilation check
 * 2. ESLint validation
 * 3. Unit tests execution
 * 4. Bundle size analysis
 * 5. Platform-specific build checks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class BuildValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.mobileDir = path.join(__dirname);
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, description) {
    this.log(`Running: ${description}`, 'info');
    try {
      const result = execSync(command, { 
        cwd: this.mobileDir, 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      this.log(`✓ ${description} completed successfully`, 'success');
      return { success: true, output: result };
    } catch (error) {
      this.log(`✗ ${description} failed: ${error.message}`, 'error');
      this.errors.push({ step: description, error: error.message });
      return { success: false, error: error.message };
    }
  }

  checkProjectStructure() {
    this.log('Checking project structure...', 'info');
    
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'babel.config.js',
      'metro.config.js',
      'src/App.tsx'
    ];

    const requiredDirs = [
      'src',
      'src/components',
      'src/screens',
      'src/services'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(this.mobileDir, file))) {
        this.errors.push({ step: 'Structure Check', error: `Missing required file: ${file}` });
      }
    }

    for (const dir of requiredDirs) {
      if (!fs.existsSync(path.join(this.mobileDir, dir))) {
        this.errors.push({ step: 'Structure Check', error: `Missing required directory: ${dir}` });
      }
    }

    if (this.errors.length === 0) {
      this.log('Project structure validation passed', 'success');
    }
  }

  async validateTypeScript() {
    const result = await this.runCommand(
      'npx tsc --noEmit --skipLibCheck',
      'TypeScript compilation check'
    );
    return result.success;
  }

  async validateESLint() {
    const result = await this.runCommand(
      'npx eslint src --ext .ts,.tsx --max-warnings 0',
      'ESLint validation'
    );
    return result.success;
  }

  async runTests() {
    const result = await this.runCommand(
      'npm test -- --passWithNoTests --watchAll=false',
      'Unit tests execution'
    );
    return result.success;
  }

  async checkDependencies() {
    this.log('Checking for outdated dependencies...', 'info');
    
    try {
      const result = execSync('npm outdated --json', { 
        cwd: this.mobileDir, 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const outdated = JSON.parse(result);
      if (Object.keys(outdated).length > 0) {
        this.warnings.push({ 
          step: 'Dependencies', 
          warning: `Found ${Object.keys(outdated).length} outdated packages` 
        });
      }
    } catch (error) {
      // npm outdated returns exit code 1 when there are outdated packages
      if (error.stdout) {
        try {
          const outdated = JSON.parse(error.stdout);
          if (Object.keys(outdated).length > 0) {
            this.warnings.push({ 
              step: 'Dependencies', 
              warning: `Found ${Object.keys(outdated).length} outdated packages` 
            });
          }
        } catch (parseError) {
          // Ignore parsing errors
        }
      }
    }
  }

  async validateBundleSize() {
    this.log('Analyzing bundle size...', 'info');
    
    try {
      // Check if metro bundler can create a bundle
      const result = await this.runCommand(
        'npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/bundle.js --assets-dest /tmp/',
        'Bundle size analysis'
      );
      
      if (result.success && fs.existsSync('/tmp/bundle.js')) {
        const stats = fs.statSync('/tmp/bundle.js');
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        this.log(`Bundle size: ${sizeInMB} MB`, 'info');
        
        if (stats.size > 50 * 1024 * 1024) { // 50MB threshold
          this.warnings.push({ 
            step: 'Bundle Size', 
            warning: `Bundle size (${sizeInMB} MB) is quite large` 
          });
        }
        
        // Cleanup
        fs.unlinkSync('/tmp/bundle.js');
      }
    } catch (error) {
      this.warnings.push({ 
        step: 'Bundle Size', 
        warning: 'Could not analyze bundle size' 
      });
    }
  }

  printSummary() {
    this.log('\n🔍 BUILD VALIDATION SUMMARY', 'info');
    this.log('=' * 50, 'info');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('🎉 All validation checks passed! Ready for release build.', 'success');
    } else {
      if (this.errors.length > 0) {
        this.log(`❌ Found ${this.errors.length} error(s):`, 'error');
        this.errors.forEach((error, index) => {
          this.log(`  ${index + 1}. [${error.step}] ${error.error}`, 'error');
        });
      }
      
      if (this.warnings.length > 0) {
        this.log(`⚠️  Found ${this.warnings.length} warning(s):`, 'warning');
        this.warnings.forEach((warning, index) => {
          this.log(`  ${index + 1}. [${warning.step}] ${warning.warning}`, 'warning');
        });
      }
    }
    
    return this.errors.length === 0;
  }

  async validate() {
    this.log('🚀 Starting build validation...', 'info');
    
    // Step 1: Check project structure
    this.checkProjectStructure();
    
    // Step 2: TypeScript validation
    await this.validateTypeScript();
    
    // Step 3: ESLint validation (continue even if it fails)
    await this.validateESLint();
    
    // Step 4: Dependency check
    await this.checkDependencies();
    
    // Step 5: Bundle size analysis
    await this.validateBundleSize();
    
    // Step 6: Run tests (continue even if it fails)
    await this.runTests();
    
    // Print summary
    const isValid = this.printSummary();
    
    process.exit(isValid ? 0 : 1);
  }
}

// Run validation
const validator = new BuildValidator();
validator.validate().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
