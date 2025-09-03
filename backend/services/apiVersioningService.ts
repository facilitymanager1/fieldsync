import { Request, Response, NextFunction } from 'express';
import semver from 'semver';
import loggingService from './loggingService';
import metricsService from './metricsService';

export interface ApiVersion {
  version: string;
  status: 'active' | 'deprecated' | 'sunset';
  releaseDate: string;
  sunsetDate?: string;
  deprecationDate?: string;
  features: string[];
  changes: Array<{
    type: 'breaking' | 'feature' | 'bugfix' | 'security';
    description: string;
    date: string;
  }>;
  compatibility: {
    minClientVersion?: string;
    maxClientVersion?: string;
  };
}

export interface ApiEndpoint {
  path: string;
  method: string;
  version: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: any;
  }>;
  responses: Array<{
    statusCode: number;
    description: string;
    schema: any;
    example?: any;
  }>;
  authentication: boolean;
  roles?: string[];
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
      requestedVersion?: string;
      versionInfo?: ApiVersion;
    }
  }
}

class ApiVersioningService {
  private versions: Map<string, ApiVersion> = new Map();
  private endpoints: Map<string, ApiEndpoint> = new Map();
  private defaultVersion = '1.0.0';
  private supportedVersions: string[] = [];

  constructor() {
    this.initializeVersions();
    this.loadEndpoints();
  }

  /**
   * Initialize API versions
   */
  private initializeVersions(): void {
    const versions: ApiVersion[] = [
      {
        version: '1.0.0',
        status: 'active',
        releaseDate: '2024-01-01',
        features: [
          'Basic authentication',
          'User management',
          'Ticket management',
          'Shift tracking'
        ],
        changes: [
          {
            type: 'feature',
            description: 'Initial API release',
            date: '2024-01-01'
          }
        ],
        compatibility: {
          minClientVersion: '1.0.0'
        }
      },
      {
        version: '1.1.0',
        status: 'active',
        releaseDate: '2024-02-01',
        features: [
          'Enhanced authentication with refresh tokens',
          'Advanced ticket filtering',
          'Location tracking',
          'Real-time notifications'
        ],
        changes: [
          {
            type: 'feature',
            description: 'Added refresh token support',
            date: '2024-02-01'
          },
          {
            type: 'feature',
            description: 'Enhanced location tracking APIs',
            date: '2024-02-01'
          },
          {
            type: 'bugfix',
            description: 'Fixed pagination in ticket listing',
            date: '2024-02-05'
          }
        ],
        compatibility: {
          minClientVersion: '1.1.0'
        }
      },
      {
        version: '2.0.0',
        status: 'active',
        releaseDate: '2024-06-01',
        features: [
          'New authentication system',
          'GraphQL support',
          'Enhanced error handling',
          'Comprehensive analytics',
          'Advanced role-based permissions'
        ],
        changes: [
          {
            type: 'breaking',
            description: 'Changed authentication response format',
            date: '2024-06-01'
          },
          {
            type: 'breaking',
            description: 'Updated error response structure',
            date: '2024-06-01'
          },
          {
            type: 'feature',
            description: 'Added GraphQL endpoint',
            date: '2024-06-01'
          },
          {
            type: 'feature',
            description: 'Comprehensive audit logging',
            date: '2024-06-01'
          }
        ],
        compatibility: {
          minClientVersion: '2.0.0'
        }
      }
    ];

    versions.forEach(version => {
      this.versions.set(version.version, version);
      this.supportedVersions.push(version.version);
    });

    // Set the latest version as default
    this.supportedVersions.sort((a, b) => semver.compare(b, a));
    this.defaultVersion = this.supportedVersions[0];

    loggingService.info('API versions initialized', {
      versions: this.supportedVersions,
      defaultVersion: this.defaultVersion
    });
  }

  /**
   * Load endpoint definitions
   */
  private loadEndpoints(): void {
    // This would typically load from a configuration file or database
    // For now, we'll define some sample endpoints
    const endpoints: ApiEndpoint[] = [
      {
        path: '/auth/login',
        method: 'POST',
        version: '1.0.0',
        description: 'Authenticate user and get access token',
        parameters: [
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'User email address',
            example: 'user@example.com'
          },
          {
            name: 'password',
            type: 'string',
            required: true,
            description: 'User password',
            example: 'password123'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Authentication successful',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    refreshToken: { type: 'string' },
                    user: { type: 'object' }
                  }
                }
              }
            }
          },
          {
            statusCode: 401,
            description: 'Invalid credentials',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                error: { type: 'string' }
              }
            }
          }
        ],
        authentication: false
      },
      {
        path: '/tickets',
        method: 'GET',
        version: '1.0.0',
        description: 'Get list of tickets with optional filtering',
        parameters: [
          {
            name: 'status',
            type: 'string',
            required: false,
            description: 'Filter by ticket status',
            example: 'open'
          },
          {
            name: 'priority',
            type: 'string',
            required: false,
            description: 'Filter by priority level',
            example: 'high'
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Number of tickets to return',
            example: 50
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'List of tickets',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    tickets: { type: 'array' },
                    pagination: { type: 'object' }
                  }
                }
              }
            }
          }
        ],
        authentication: true,
        roles: ['admin', 'supervisor', 'fieldtech']
      }
    ];

    endpoints.forEach(endpoint => {
      const key = `${endpoint.method}:${endpoint.path}:${endpoint.version}`;
      this.endpoints.set(key, endpoint);
    });
  }

  /**
   * Version detection middleware
   */
  versionDetection() {
    return (req: Request, res: Response, next: NextFunction) => {
      let requestedVersion = this.defaultVersion;

      // Check for version in header
      const headerVersion = req.get('API-Version') || req.get('Accept-Version');
      if (headerVersion) {
        requestedVersion = this.normalizeVersion(headerVersion);
      }

      // Check for version in URL path (e.g., /api/v2/tickets)
      const pathMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)?(?:\.\d+)?)/);
      if (pathMatch) {
        requestedVersion = this.normalizeVersion(pathMatch[1]);
        // Remove version from path for downstream processing
        req.url = req.url.replace(/\/v\d+(?:\.\d+)?(?:\.\d+)?/, '');
        req.path = req.path.replace(/\/v\d+(?:\.\d+)?(?:\.\d+)?/, '');
      }

      // Check for version in query parameter
      if (req.query.version) {
        requestedVersion = this.normalizeVersion(req.query.version as string);
        delete req.query.version;
      }

      // Validate and set version
      const resolvedVersion = this.resolveVersion(requestedVersion);
      if (!resolvedVersion) {
        return res.status(400).json({
          success: false,
          error: `Unsupported API version: ${requestedVersion}`,
          supportedVersions: this.supportedVersions
        });
      }

      req.apiVersion = resolvedVersion;
      req.requestedVersion = requestedVersion;
      req.versionInfo = this.versions.get(resolvedVersion);

      // Set response headers
      res.set('API-Version', resolvedVersion);
      res.set('Supported-Versions', this.supportedVersions.join(', '));

      // Check for deprecated version
      if (req.versionInfo?.status === 'deprecated') {
        res.set('Deprecation', 'true');
        if (req.versionInfo.sunsetDate) {
          res.set('Sunset', req.versionInfo.sunsetDate);
        }
        res.set('Warning', `299 - "API version ${resolvedVersion} is deprecated"`);
      }

      // Record metrics
      metricsService.recordBusinessKPI('api_version_usage', 1, {
        version: resolvedVersion,
        requestedVersion,
        endpoint: req.path,
        method: req.method
      });

      next();
    };
  }

  /**
   * Version compatibility middleware
   */
  versionCompatibility() {
    return (req: Request, res: Response, next: NextFunction) => {
      const endpoint = this.getEndpoint(req.method, req.path, req.apiVersion!);
      
      if (!endpoint) {
        // Endpoint doesn't exist in this version
        const availableVersions = this.getEndpointVersions(req.method, req.path);
        
        if (availableVersions.length > 0) {
          const suggestedVersion = availableVersions[availableVersions.length - 1];
          return res.status(404).json({
            success: false,
            error: `Endpoint ${req.method} ${req.path} not available in version ${req.apiVersion}`,
            availableVersions,
            suggestedVersion
          });
        }
      }

      // Check client version compatibility
      const clientVersion = req.get('Client-Version');
      if (clientVersion && req.versionInfo) {
        const compatibility = req.versionInfo.compatibility;
        
        if (compatibility.minClientVersion && 
            semver.lt(clientVersion, compatibility.minClientVersion)) {
          return res.status(400).json({
            success: false,
            error: 'Client version too old',
            requiredMinVersion: compatibility.minClientVersion,
            clientVersion
          });
        }

        if (compatibility.maxClientVersion && 
            semver.gt(clientVersion, compatibility.maxClientVersion)) {
          return res.status(400).json({
            success: false,
            error: 'Client version too new',
            requiredMaxVersion: compatibility.maxClientVersion,
            clientVersion
          });
        }
      }

      next();
    };
  }

  /**
   * Version-specific response transformation
   */
  responseTransformation() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      res.json = function(data: any) {
        const transformedData = this.transformResponseForVersion(data, req.apiVersion!);
        return originalJson.call(this, transformedData);
      }.bind(this);

      next();
    };
  }

  /**
   * Get API documentation
   */
  getApiDocumentation(version?: string): any {
    const targetVersion = version || this.defaultVersion;
    const versionInfo = this.versions.get(targetVersion);

    if (!versionInfo) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    const endpoints = Array.from(this.endpoints.values())
      .filter(endpoint => endpoint.version === targetVersion);

    return {
      openapi: '3.0.0',
      info: {
        title: 'FieldSync API',
        version: targetVersion,
        description: 'Comprehensive field service management API',
        contact: {
          name: 'FieldSync Support',
          email: 'support@fieldsync.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v${targetVersion}`,
          description: `FieldSync API v${targetVersion}`
        }
      ],
      paths: this.generateOpenApiPaths(endpoints),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas: this.generateOpenApiSchemas()
      },
      security: [
        {
          bearerAuth: []
        }
      ]
    };
  }

  /**
   * Get supported versions
   */
  getSupportedVersions(): string[] {
    return [...this.supportedVersions];
  }

  /**
   * Get version information
   */
  getVersionInfo(version: string): ApiVersion | null {
    return this.versions.get(version) || null;
  }

  /**
   * Add or update API version
   */
  addVersion(version: ApiVersion): void {
    this.versions.set(version.version, version);
    
    if (!this.supportedVersions.includes(version.version)) {
      this.supportedVersions.push(version.version);
      this.supportedVersions.sort((a, b) => semver.compare(b, a));
    }

    loggingService.info('API version added/updated', { version: version.version });
  }

  /**
   * Deprecate API version
   */
  deprecateVersion(version: string, sunsetDate?: string): boolean {
    const versionInfo = this.versions.get(version);
    
    if (!versionInfo) {
      return false;
    }

    versionInfo.status = 'deprecated';
    versionInfo.deprecationDate = new Date().toISOString();
    
    if (sunsetDate) {
      versionInfo.sunsetDate = sunsetDate;
    }

    loggingService.info('API version deprecated', { 
      version, 
      sunsetDate: versionInfo.sunsetDate 
    });

    return true;
  }

  /**
   * Get version usage statistics
   */
  getVersionUsageStats(timeWindow: number = 24): Record<string, {
    requests: number;
    uniqueClients: number;
    endpoints: Record<string, number>;
  }> {
    // This would typically query metrics service or database
    // For now, return sample data structure
    const stats: Record<string, any> = {};

    this.supportedVersions.forEach(version => {
      stats[version] = {
        requests: 0,
        uniqueClients: 0,
        endpoints: {}
      };
    });

    return stats;
  }

  /**
   * Private helper methods
   */

  private normalizeVersion(version: string): string {
    // Convert version formats like "2" to "2.0.0", "1.1" to "1.1.0"
    const parts = version.split('.');
    
    while (parts.length < 3) {
      parts.push('0');
    }

    return parts.join('.');
  }

  private resolveVersion(requestedVersion: string): string | null {
    // Exact match
    if (this.versions.has(requestedVersion)) {
      return requestedVersion;
    }

    // Find compatible version
    const compatible = this.supportedVersions.find(version => {
      return semver.satisfies(version, `^${requestedVersion}`);
    });

    return compatible || null;
  }

  private getEndpoint(method: string, path: string, version: string): ApiEndpoint | null {
    const key = `${method}:${path}:${version}`;
    return this.endpoints.get(key) || null;
  }

  private getEndpointVersions(method: string, path: string): string[] {
    const versions: string[] = [];
    
    for (const [key, endpoint] of this.endpoints) {
      if (key.startsWith(`${method}:${path}:`)) {
        versions.push(endpoint.version);
      }
    }

    return versions.sort((a, b) => semver.compare(a, b));
  }

  private transformResponseForVersion(data: any, version: string): any {
    // Apply version-specific transformations
    switch (version) {
      case '1.0.0':
        return this.transformToV1(data);
      case '1.1.0':
        return this.transformToV1_1(data);
      case '2.0.0':
      default:
        return data;
    }
  }

  private transformToV1(data: any): any {
    // Transform response to v1.0.0 format
    if (data && typeof data === 'object') {
      // Remove new fields not available in v1.0.0
      const { refreshToken, ...v1Data } = data;
      return v1Data;
    }
    return data;
  }

  private transformToV1_1(data: any): any {
    // Transform response to v1.1.0 format
    return data;
  }

  private generateOpenApiPaths(endpoints: ApiEndpoint[]): any {
    const paths: any = {};

    endpoints.forEach(endpoint => {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      const method = endpoint.method.toLowerCase();
      paths[endpoint.path][method] = {
        summary: endpoint.description,
        parameters: endpoint.parameters.map(param => ({
          name: param.name,
          in: method === 'get' ? 'query' : 'body',
          required: param.required,
          description: param.description,
          schema: {
            type: param.type,
            example: param.example
          }
        })),
        responses: endpoint.responses.reduce((acc, response) => {
          acc[response.statusCode] = {
            description: response.description,
            content: {
              'application/json': {
                schema: response.schema,
                example: response.example
              }
            }
          };
          return acc;
        }, {} as any),
        security: endpoint.authentication ? [{ bearerAuth: [] }] : []
      };
    });

    return paths;
  }

  private generateOpenApiSchemas(): any {
    return {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Error message' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string' }
        }
      },
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          assignedTo: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    };
  }
}

export default new ApiVersioningService();