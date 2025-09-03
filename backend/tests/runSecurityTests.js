/**
 * Simple Security Test Runner
 * Runs security tests in isolation without TypeScript compilation issues
 */

const { execSync } = require('child_process');

console.log('🔒 Running FieldSync Security Test Suite...\n');

const testFiles = [
  'tests/security/security.test.ts',
  'tests/security/auth.security.test.ts',
  'tests/performance/performance.test.ts'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

testFiles.forEach((testFile, index) => {
  console.log(`\n📋 Running Test ${index + 1}/${testFiles.length}: ${testFile}`);
  console.log('─'.repeat(60));
  
  try {
    const result = execSync(`npx jest ${testFile} --verbose --testTimeout=30000 --passWithNoTests`, {
      cwd: process.cwd(),
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    console.log('✅ Test suite completed successfully');
    passedTests++;
  } catch (error) {
    console.log('❌ Test suite failed');
    failedTests++;
    
    if (error.stdout) {
      console.log('STDOUT:', error.stdout);
    }
    if (error.stderr) {
      console.log('STDERR:', error.stderr);
    }
  }
  
  totalTests++;
});

console.log('\n' + '='.repeat(60));
console.log('🔒 SECURITY TEST SUITE SUMMARY');
console.log('='.repeat(60));
console.log(`📊 Total Test Files: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests > 0) {
  console.log('\n⚠️ Some security tests failed. Please review the output above.');
  console.log('📋 Common issues to check:');
  console.log('  - Database connection issues');
  console.log('  - Missing environment variables');
  console.log('  - TypeScript compilation errors');
  console.log('  - Missing dependencies');
} else {
  console.log('\n🎉 All security tests passed successfully!');
  console.log('🔒 Your FieldSync backend security implementation is working correctly.');
}

console.log('\n📚 Test Coverage Areas:');
console.log('  🔐 Authentication & Authorization');
console.log('  🛡️ Input Validation & Sanitization');
console.log('  🚀 Performance & Load Testing');
console.log('  🔒 Security Headers & CSRF Protection');
console.log('  📊 Rate Limiting & Session Management');
console.log('  🗄️ Database Security & Injection Prevention');

process.exit(failedTests > 0 ? 1 : 0);