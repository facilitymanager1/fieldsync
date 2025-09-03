import { Request, Response, NextFunction } from 'express';
import apiVersioningService from '../services/apiVersioningService';
import loggingService from '../services/loggingService';
import metricsService from '../services/metricsService';

class ApiVersioningMiddleware {
  /**
   * Apply all versioning middleware
   */
  applyVersioning() {
    return [
      apiVersioningService.versionDetection(),
      apiVersioningService.versionCompatibility(),
      this.deprecationWarnings(),
      this.versionMetrics(),
      apiVersioningService.responseTransformation()
    ];
  }

  /**
   * Enhanced deprecation warnings
   */
  deprecationWarnings() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.versionInfo?.status === 'deprecated') {
        const warningMessage = `API version ${req.apiVersion} is deprecated`;
        let warningDetails = warningMessage;

        if (req.versionInfo.sunsetDate) {
          const sunsetDate = new Date(req.versionInfo.sunsetDate);
          const daysUntilSunset = Math.ceil(
            (sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          
          warningDetails += `. It will be sunset on ${req.versionInfo.sunsetDate}`;
          
          if (daysUntilSunset > 0) {
            warningDetails += ` (${daysUntilSunset} days remaining)`;
          } else {
            warningDetails += ` (EXPIRED)`;
          }
        }

        // Set warning headers
        res.set({
          'Deprecation': 'true',
          'Warning': `299 - "${warningDetails}"`,
          'Link': `</api/docs/changelog?from=${req.apiVersion}&to=${apiVersioningService.getSupportedVersions()[0]}>; rel="successor-version"`
        });

        if (req.versionInfo.sunsetDate) {
          res.set('Sunset', req.versionInfo.sunsetDate);
        }

        // Log deprecation usage
        loggingService.warn('Deprecated API version used', {
          version: req.apiVersion,
          endpoint: `${req.method} ${req.path}`,
          userId: (req as any).user?.id,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          sunsetDate: req.versionInfo.sunsetDate
        });
      }

      next();
    };
  }

  /**
   * Version-specific metrics collection
   */
  versionMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Record version usage metrics
      metricsService.recordBusinessKPI('api_version_requests', 1, {
        version: req.apiVersion || 'unknown',
        requestedVersion: req.requestedVersion || 'unknown',
        endpoint: req.path,
        method: req.method,
        status: req.versionInfo?.status || 'unknown'
      });

      // Track deprecated version usage
      if (req.versionInfo?.status === 'deprecated') {
        metricsService.recordBusinessKPI('deprecated_api_usage', 1, {
          version: req.apiVersion!,
          endpoint: req.path,
          method: req.method,
          daysUntilSunset: req.versionInfo.sunsetDate ? 
            Math.ceil((new Date(req.versionInfo.sunsetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)).toString() : 
            'unknown'
        });
      }

      // Track version mismatches
      if (req.apiVersion !== req.requestedVersion) {
        metricsService.recordBusinessKPI('version_resolution', 1, {
          requested: req.requestedVersion!,
          resolved: req.apiVersion!,
          endpoint: req.path,
          method: req.method
        });
      }

      next();
    };
  }

  /**
   * Client version compatibility tracking
   */
  clientVersionTracking() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientVersion = req.get('Client-Version');
      const clientName = req.get('Client-Name') || req.get('User-Agent')?.split('/')[0] || 'unknown';

      if (clientVersion) {
        // Track client versions
        metricsService.recordBusinessKPI('client_versions', 1, {
          clientName,
          clientVersion,
          apiVersion: req.apiVersion!,
          platform: this.detectPlatform(req.get('User-Agent') || '')
        });

        // Check for outdated clients
        const versionInfo = req.versionInfo;
        if (versionInfo?.compatibility.minClientVersion) {
          const semver = require('semver');
          if (semver.lt(clientVersion, versionInfo.compatibility.minClientVersion)) {
            res.set('Client-Update-Required', 'true');
            res.set('Min-Client-Version', versionInfo.compatibility.minClientVersion);
            
            metricsService.recordBusinessKPI('outdated_clients', 1, {
              clientName,
              clientVersion,
              minRequired: versionInfo.compatibility.minClientVersion,
              apiVersion: req.apiVersion!
            });
          }
        }
      }

      next();
    };
  }

  /**
   * Feature flag middleware based on version
   */
  featureFlags() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add feature flags to request based on API version
      const features = req.versionInfo?.features || [];
      
      (req as any).features = {
        hasRefreshTokens: features.includes('Enhanced authentication with refresh tokens'),
        hasAdvancedFiltering: features.includes('Advanced ticket filtering'),
        hasLocationTracking: features.includes('Location tracking'),
        hasRealTimeNotifications: features.includes('Real-time notifications'),
        hasGraphQL: features.includes('GraphQL support'),
        hasAnalytics: features.includes('Comprehensive analytics'),
        hasAdvancedRBAC: features.includes('Advanced role-based permissions')
      };

      next();
    };
  }

  /**
   * API rate limiting based on version
   */
  versionBasedRateLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Different rate limits for different versions
      const rateLimits = {
        '1.0.0': { requests: 1000, windowMs: 60 * 60 * 1000 }, // 1000/hour
        '1.1.0': { requests: 2000, windowMs: 60 * 60 * 1000 }, // 2000/hour
        '2.0.0': { requests: 5000, windowMs: 60 * 60 * 1000 }  // 5000/hour
      };

      const versionLimit = rateLimits[req.apiVersion as keyof typeof rateLimits];
      
      if (versionLimit) {
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': versionLimit.requests.toString(),
          'X-RateLimit-Window': versionLimit.windowMs.toString()
        });

        // Store rate limit info for downstream middleware
        (req as any).rateLimit = versionLimit;
      }

      next();
    };
  }

  /**
   * Version-specific request validation
   */
  versionValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiVersion = req.apiVersion;
      
      // Version-specific validation rules
      if (apiVersion === '1.0.0') {
        this.validateV1Request(req, res, next);
      } else if (apiVersion === '1.1.0') {
        this.validateV1_1Request(req, res, next);
      } else if (apiVersion === '2.0.0') {
        this.validateV2Request(req, res, next);
      } else {
        next();
      }
    };
  }

  /**
   * Content negotiation based on version
   */
  contentNegotiation() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiVersion = req.apiVersion;
      const accept = req.get('Accept') || 'application/json';

      // Version-specific content type handling
      if (apiVersion === '2.0.0' && accept.includes('application/graphql')) {
        (req as any).contentType = 'graphql';
      } else {
        (req as any).contentType = 'rest';
      }

      // Set supported content types based on version
      const supportedTypes = this.getSupportedContentTypes(apiVersion!);
      res.set('X-Supported-Content-Types', supportedTypes.join(', '));

      next();
    };
  }

  /**
   * Version-specific error handling
   */
  versionErrorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      const apiVersion = req.apiVersion;
      
      // Transform error based on API version
      let errorResponse;

      switch (apiVersion) {
        case '1.0.0':
          errorResponse = this.transformErrorForV1(error);
          break;
        case '1.1.0':
          errorResponse = this.transformErrorForV1_1(error);
          break;
        case '2.0.0':
        default:
          errorResponse = this.transformErrorForV2(error);
      }

      // Log version-specific error
      loggingService.error('Version-specific error', error, {
        apiVersion,
        endpoint: `${req.method} ${req.path}`,
        userId: (req as any).user?.id
      });

      res.status(error.statusCode || 500).json(errorResponse);
    };
  }

  /**
   * Private helper methods
   */

  private detectPlatform(userAgent: string): string {
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return 'mobile';
    } else if (userAgent.includes('Electron')) {
      return 'desktop';
    } else {
      return 'web';
    }
  }

  private validateV1Request(req: Request, res: Response, next: NextFunction): void {
    // V1-specific validation
    if (req.body && req.body.refreshToken) {
      res.status(400).json({
        success: false,
        error: 'refreshToken is not supported in API version 1.0.0'
      });
      return;
    }
    next();
  }

  private validateV1_1Request(req: Request, res: Response, next: NextFunction): void {
    // V1.1-specific validation
    next();
  }

  private validateV2Request(req: Request, res: Response, next: NextFunction): void {
    // V2-specific validation
    if (req.path.includes('/auth/login') && req.body) {
      // V2 requires additional security fields
      if (!req.body.clientId) {
        res.status(400).json({
          success: false,
          error: 'clientId is required in API version 2.0.0',
          code: 'MISSING_CLIENT_ID'
        });
        return;
      }
    }
    next();
  }

  private getSupportedContentTypes(version: string): string[] {
    const baseTypes = ['application/json', 'application/xml'];
    
    if (version === '2.0.0') {
      baseTypes.push('application/graphql');
    }
    
    return baseTypes;
  }

  private transformErrorForV1(error: any): any {
    return {
      success: false,
      error: error.message || 'An error occurred'
    };
  }

  private transformErrorForV1_1(error: any): any {
    return {
      success: false,
      error: error.message || 'An error occurred',
      timestamp: new Date().toISOString()
    };
  }

  private transformErrorForV2(error: any): any {
    return {
      success: false,
      error: {
        message: error.message || 'An error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        details: error.details || null,
        timestamp: new Date().toISOString(),
        traceId: error.traceId || null
      }
    };
  }
}

export default new ApiVersioningMiddleware();