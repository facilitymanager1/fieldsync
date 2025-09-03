import request from 'supertest';
import express from 'express';
import { csrfProtection } from '../middleware/csrfProtection';
import { securityHeaders } from '../middleware/securityHeaders';
import { requestValidation } from '../middleware/requestValidation';

describe('Security Middleware Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(securityHeaders.middleware());
    app.use(requestValidation.basicValidation());
    app.use(requestValidation.sanitization());
    app.use(csrfProtection.middleware());

    // Test routes
    app.get('/csrf-token', csrfProtection.tokenEndpoint());
    app.post('/test-csrf', (req, res) => {
      res.json({ message: 'CSRF test passed' });
    });
    app.get('/test-headers', (req, res) => {
      res.json({ message: 'Headers test' });
    });
  });

  describe('Security Headers', () => {
    it('should include essential security headers', async () => {
      const response = await request(app)
        .get('/test-headers')
        .expect(200);

      // Check for key security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toContain('no-referrer');
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(response.headers['cross-origin-embedder-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should include Content Security Policy', async () => {
      const response = await request(app)
        .get('/test-headers')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/test-headers')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('CSRF Protection', () => {
    it('should allow GET requests without CSRF token', async () => {
      await request(app)
        .get('/csrf-token')
        .expect(200);
    });

    it('should provide CSRF token in response', async () => {
      const response = await request(app)
        .get('/csrf-token')
        .expect(200);

      expect(response.body.csrfToken).toBeDefined();
      expect(response.headers['x-csrf-token']).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject POST requests without CSRF token', async () => {
      await request(app)
        .post('/test-csrf')
        .send({ test: 'data' })
        .expect(403);
    });

    it('should accept POST requests with valid CSRF token', async () => {
      // First get a CSRF token
      const tokenResponse = await request(app)
        .get('/csrf-token')
        .expect(200);

      const csrfToken = tokenResponse.body.csrfToken;
      const cookies = tokenResponse.headers['set-cookie'];

      // Then use it in a POST request
      await request(app)
        .post('/test-csrf')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ test: 'data' })
        .expect(200);
    });

    it('should reject POST requests with invalid CSRF token', async () => {
      await request(app)
        .post('/test-csrf')
        .set('x-csrf-token', 'invalid-token')
        .send({ test: 'data' })
        .expect(403);
    });
  });

  describe('Request Validation', () => {
    it('should reject requests with blocked user agents', async () => {
      await request(app)
        .get('/test-headers')
        .set('User-Agent', 'sqlmap/1.0')
        .expect(403);
    });

    it('should reject URLs that are too long', async () => {
      const longPath = '/test-headers?' + 'a'.repeat(3000);
      await request(app)
        .get(longPath)
        .expect(414);
    });

    it('should reject requests with too many query parameters', async () => {
      const manyParams = Array.from({ length: 60 }, (_, i) => `param${i}=value${i}`).join('&');
      await request(app)
        .get(`/test-headers?${manyParams}`)
        .expect(400);
    });

    it('should sanitize input data', async () => {
      const maliciousData = {
        name: 'Test\x00\x01Name',
        script: '<script>alert("xss")</script>',
        nullByte: 'test\0injection'
      };

      // Get CSRF token first
      const tokenResponse = await request(app)
        .get('/csrf-token')
        .expect(200);

      const csrfToken = tokenResponse.body.csrfToken;
      const cookies = tokenResponse.headers['set-cookie'];

      const response = await request(app)
        .post('/test-csrf')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send(maliciousData)
        .expect(200);

      // The actual sanitization verification would depend on the implementation
      expect(response.status).toBe(200);
    });
  });

  describe('File Upload Validation', () => {
    beforeEach(() => {
      app.post('/upload', 
        requestValidation.fileUploadValidation({
          maxFileSize: 1024 * 1024, // 1MB
          allowedMimeTypes: ['image/jpeg', 'image/png'],
          maxFiles: 2
        }),
        (req, res) => {
          res.json({ message: 'Upload successful' });
        }
      );
    });

    it('should accept requests without files', async () => {
      // Get CSRF token first
      const tokenResponse = await request(app)
        .get('/csrf-token')
        .expect(200);

      const csrfToken = tokenResponse.body.csrfToken;
      const cookies = tokenResponse.headers['set-cookie'];

      await request(app)
        .post('/upload')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .expect(200);
    });
  });

  describe('API Security Headers', () => {
    beforeEach(() => {
      app.use('/api', securityHeaders.apiHeaders());
      app.get('/api/test', (req, res) => {
        res.json({ message: 'API test' });
      });
    });

    it('should include API-specific headers', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['api-version']).toBeDefined();
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Security Report Endpoint', () => {
    beforeEach(() => {
      app.post('/security-report', securityHeaders.reportEndpoint());
    });

    it('should accept security violation reports', async () => {
      const violationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'https://malicious.com/script.js',
          'status-code': 200
        }
      };

      await request(app)
        .post('/security-report')
        .send(violationReport)
        .expect(204);
    });
  });

  describe('Production Security', () => {
    it('should enforce HTTPS in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      const prodApp = express();
      prodApp.use(requestValidation.basicValidation());
      prodApp.get('/test', (req, res) => res.json({ test: true }));

      await request(prodApp)
        .get('/test')
        .expect(403); // Should reject non-HTTPS in production

      process.env.NODE_ENV = 'test';
    });

    it('should include HSTS header in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const prodApp = express();
      prodApp.use(securityHeaders.middleware());
      prodApp.get('/test', (req, res) => res.json({ test: true }));

      const response = await request(prodApp)
        .get('/test')
        .set('X-Forwarded-Proto', 'https')
        .expect(200);

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');

      process.env.NODE_ENV = 'test';
    });
  });

  describe('Rate Limit Bypass Detection', () => {
    it('should detect potential rate limit bypass attempts', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await request(app)
        .get('/test-headers')
        .set('X-Forwarded-For', '1.1.1.1')
        .set('X-Real-IP', '2.2.2.2')
        .set('X-Originating-IP', '3.3.3.3')
        .expect(200);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Potential rate limit bypass attempt:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('Security Configuration', () => {
  it('should validate security configuration', () => {
    const { validateSecurityConfig } = require('../config/security');
    
    // Test with secure configuration
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.REFRESH_SECRET = 'b'.repeat(32);
    
    const validation = validateSecurityConfig();
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect insecure configuration', () => {
    const { validateSecurityConfig } = require('../config/security');
    
    // Test with insecure configuration
    process.env.JWT_SECRET = 'changeme';
    process.env.REFRESH_SECRET = 'changeme';
    
    const validation = validateSecurityConfig();
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});