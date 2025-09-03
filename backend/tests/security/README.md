# FieldSync Security Test Suite

This directory contains comprehensive security tests for the FieldSync backend application.

## Test Coverage

### 🔐 Authentication & Authorization Tests (`auth.security.test.ts`)
- **JWT Token Security**: Token validation, expiration, signature verification
- **Role-Based Access Control (RBAC)**: Permission enforcement across different user roles
- **Session Management**: Login/logout flows, session invalidation, concurrent sessions
- **Account Security**: Password complexity, brute force protection, account lockout
- **Multi-factor Authentication**: 2FA flows and backup codes

### 🛡️ General Security Tests (`security.test.ts`)
- **Input Validation**: SQL injection, NoSQL injection, XSS prevention
- **Rate Limiting**: API endpoint protection, login attempt limiting
- **Security Headers**: CSRF protection, security headers validation
- **File Upload Security**: File type validation, size limits, malicious file detection
- **Data Exposure**: Sensitive data filtering, error message sanitization
- **Audit Logging**: Security event tracking, audit trail protection

## Performance Tests (`performance/performance.test.ts`)
- **API Response Times**: Endpoint performance benchmarking
- **Database Query Performance**: Query optimization validation
- **Concurrent Load Handling**: Multi-user scenario testing
- **Memory Usage**: Resource consumption monitoring
- **Bulk Operations**: Large dataset processing efficiency

## Running the Tests

### Run All Security Tests
```bash
# From backend directory
node tests/runSecurityTests.js
```

### Run Individual Test Suites
```bash
# Authentication tests only
npm test -- tests/security/auth.security.test.ts

# General security tests only  
npm test -- tests/security/security.test.ts

# Performance tests only
npm test -- tests/performance/performance.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage tests/security/
```

## Test Configuration

### Environment Variables Required
```bash
NODE_ENV=test
JWT_SECRET=test-secret
MONGODB_URI=mongodb://localhost:27017/fieldsync-test
REDIS_URL=redis://localhost:6379
```

### Test Database
Tests use MongoDB Memory Server for isolated testing:
- Automatic setup and teardown
- No external database dependencies
- Consistent test environment

## Performance Thresholds

### API Response Times
- **Health Check**: < 500ms
- **Authentication**: < 500ms  
- **User Operations**: < 200ms
- **Dashboard Data**: < 800ms

### Database Queries
- **Simple Queries**: < 100ms
- **Aggregation Queries**: < 100ms
- **Bulk Operations**: < 2000ms

### Concurrent Handling
- **50 Concurrent Requests**: All successful
- **Error Rate**: < 5%
- **Memory Usage**: < 100MB growth

## Security Test Scenarios

### Authentication Flow Testing
1. **Valid Credentials**: Successful login with token generation
2. **Invalid Credentials**: Proper error handling and logging
3. **Account Lockout**: Brute force protection verification
4. **Token Expiration**: Expired token rejection
5. **Token Tampering**: Signature validation

### Authorization Testing
1. **Admin Access**: Full system access verification
2. **Supervisor Access**: Team management permissions
3. **Field Tech Access**: Job-related function access only
4. **Client Access**: Own data access only
5. **Privilege Escalation**: Prevention of unauthorized access

### Input Validation Testing
1. **SQL Injection**: Malicious query prevention
2. **NoSQL Injection**: Object injection prevention  
3. **XSS Prevention**: Script injection filtering
4. **File Upload**: Malicious file detection
5. **Data Sanitization**: Input cleaning verification

### Rate Limiting Testing
1. **Login Attempts**: Brute force prevention
2. **API Requests**: Request flooding protection
3. **Resource Access**: Denial of service prevention

## Security Best Practices Verified

### ✅ Authentication
- Strong password requirements
- JWT token security
- Session management
- Account lockout mechanisms

### ✅ Authorization  
- Role-based access control
- Permission granularity
- Privilege escalation prevention
- Resource ownership validation

### ✅ Data Protection
- Sensitive data filtering
- Input validation and sanitization
- SQL/NoSQL injection prevention
- XSS protection

### ✅ Infrastructure Security
- Security headers implementation
- CSRF protection
- Rate limiting
- Audit trail logging

## Troubleshooting

### Common Test Failures

**Database Connection Issues**
```bash
# Ensure MongoDB is running or use MongoDB Memory Server
# Check MONGODB_URI environment variable
```

**Token Generation Failures**
```bash
# Verify JWT_SECRET is set
# Check token service configuration
```

**Rate Limiting False Positives**
```bash
# Adjust rate limiting thresholds for testing
# Use different IP addresses for concurrent tests
```

**Performance Threshold Violations**
```bash
# Check system resources during test execution
# Adjust thresholds based on test environment
```

### Test Data Cleanup
Tests automatically clean up data between runs:
- Database collections cleared after each test
- In-memory caches flushed
- Temporary files removed

## Contributing

When adding new security tests:

1. **Follow Test Patterns**: Use existing test structure
2. **Add Proper Cleanup**: Ensure data isolation
3. **Document Scenarios**: Comment complex test cases
4. **Update Thresholds**: Adjust performance expectations
5. **Verify Coverage**: Ensure new features are tested

## Security Test Checklist

- [ ] Authentication flows tested
- [ ] Authorization controls verified  
- [ ] Input validation comprehensive
- [ ] Rate limiting functional
- [ ] Security headers present
- [ ] Audit logging working
- [ ] Performance thresholds met
- [ ] Error handling secure
- [ ] Data exposure prevented
- [ ] Session management secure

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
- Fast execution (< 5 minutes total)
- Reliable test isolation
- Clear pass/fail criteria
- Detailed failure reporting
- Performance regression detection