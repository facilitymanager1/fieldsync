import fs from 'fs';
import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import loggingService from './loggingService';
import apiVersioningService from './apiVersioningService';

export interface ApiDocumentationOptions {
  includeExamples: boolean;
  includeSchemas: boolean;
  includeAuthentication: boolean;
  format: 'openapi' | 'swagger' | 'json' | 'yaml';
  version?: string;
}

export interface ExampleRequest {
  method: string;
  endpoint: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export interface ExampleResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: any;
}

export interface CodeSample {
  language: string;
  code: string;
  description?: string;
}

class ApiDocumentationService {
  private documentationCache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.initializeDocumentation();
  }

  /**
   * Initialize documentation service
   */
  private async initializeDocumentation(): Promise<void> {
    try {
      // Generate documentation for all supported versions
      const versions = apiVersioningService.getSupportedVersions();
      
      for (const version of versions) {
        await this.generateDocumentation(version);
      }

      loggingService.info('API documentation service initialized', {
        versions: versions.length
      });
    } catch (error) {
      loggingService.error('Failed to initialize documentation service', error);
    }
  }

  /**
   * Generate comprehensive API documentation
   */
  async generateDocumentation(
    version: string,
    options: Partial<ApiDocumentationOptions> = {}
  ): Promise<any> {
    try {
      const cacheKey = `${version}-${JSON.stringify(options)}`;
      
      // Check cache
      if (this.isDocumentationCached(cacheKey)) {
        return this.documentationCache.get(cacheKey);
      }

      const defaultOptions: ApiDocumentationOptions = {
        includeExamples: true,
        includeSchemas: true,
        includeAuthentication: true,
        format: 'openapi',
        version
      };

      const finalOptions = { ...defaultOptions, ...options };

      // Get base OpenAPI spec
      const baseSpec = apiVersioningService.getApiDocumentation(version);
      
      // Enhance with additional information
      const enhancedSpec = await this.enhanceDocumentation(baseSpec, finalOptions);
      
      // Validate the specification
      await this.validateSpecification(enhancedSpec);

      // Cache the result
      this.documentationCache.set(cacheKey, enhancedSpec);
      this.cacheExpiry.set(cacheKey, Date.now() + this.cacheTimeout);

      return enhancedSpec;
    } catch (error) {
      loggingService.error('Failed to generate API documentation', error, { version });
      throw error;
    }
  }

  /**
   * Get interactive documentation HTML
   */
  generateInteractiveDocumentation(
    version: string,
    theme: 'light' | 'dark' = 'light'
  ): string {
    const spec = this.getDocumentation(version);
    
    return this.generateSwaggerUIHtml(spec, theme);
  }

  /**
   * Get documentation in various formats
   */
  async getDocumentation(
    version: string,
    format: 'json' | 'yaml' | 'html' = 'json'
  ): Promise<any> {
    const spec = await this.generateDocumentation(version);

    switch (format) {
      case 'yaml':
        return this.convertToYaml(spec);
      case 'html':
        return this.generateInteractiveDocumentation(version);
      case 'json':
      default:
        return spec;
    }
  }

  /**
   * Generate code samples for endpoints
   */
  generateCodeSamples(
    method: string,
    endpoint: string,
    version: string,
    languages: string[] = ['curl', 'javascript', 'python', 'java']
  ): CodeSample[] {
    const samples: CodeSample[] = [];

    const exampleRequest = this.generateExampleRequest(method, endpoint, version);
    
    for (const language of languages) {
      const sample = this.generateCodeSampleForLanguage(language, exampleRequest);
      if (sample) {
        samples.push(sample);
      }
    }

    return samples;
  }

  /**
   * Generate example requests and responses
   */
  generateExamples(endpoint: string, method: string, version: string): {
    request: ExampleRequest;
    responses: ExampleResponse[];
  } {
    const request = this.generateExampleRequest(method, endpoint, version);
    const responses = this.generateExampleResponses(method, endpoint, version);

    return { request, responses };
  }

  /**
   * Export documentation to file
   */
  async exportDocumentation(
    version: string,
    format: 'json' | 'yaml' | 'html',
    outputPath: string
  ): Promise<string> {
    try {
      const documentation = await this.getDocumentation(version, format);
      
      let content: string;
      let filename: string;

      switch (format) {
        case 'yaml':
          content = documentation;
          filename = `api-v${version}.yaml`;
          break;
        case 'html':
          content = documentation;
          filename = `api-v${version}.html`;
          break;
        case 'json':
        default:
          content = JSON.stringify(documentation, null, 2);
          filename = `api-v${version}.json`;
      }

      const fullPath = path.join(outputPath, filename);
      
      // Ensure directory exists
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf8');

      loggingService.info('API documentation exported', {
        version,
        format,
        path: fullPath
      });

      return fullPath;
    } catch (error) {
      loggingService.error('Failed to export documentation', error);
      throw error;
    }
  }

  /**
   * Generate changelog between versions
   */
  generateChangelog(fromVersion: string, toVersion: string): any {
    const fromVersionInfo = apiVersioningService.getVersionInfo(fromVersion);
    const toVersionInfo = apiVersioningService.getVersionInfo(toVersion);

    if (!fromVersionInfo || !toVersionInfo) {
      throw new Error('Version not found');
    }

    const changes = toVersionInfo.changes.filter(change => 
      new Date(change.date) > new Date(fromVersionInfo.releaseDate)
    );

    return {
      fromVersion,
      toVersion,
      summary: {
        breaking: changes.filter(c => c.type === 'breaking').length,
        features: changes.filter(c => c.type === 'feature').length,
        bugfixes: changes.filter(c => c.type === 'bugfix').length,
        security: changes.filter(c => c.type === 'security').length
      },
      changes: changes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  }

  /**
   * Generate API usage statistics
   */
  generateUsageStatistics(): any {
    const versions = apiVersioningService.getSupportedVersions();
    const stats = apiVersioningService.getVersionUsageStats();

    return {
      totalVersions: versions.length,
      activeVersions: versions.filter(v => {
        const info = apiVersioningService.getVersionInfo(v);
        return info?.status === 'active';
      }).length,
      usage: stats,
      popularEndpoints: this.getPopularEndpoints(),
      clientDistribution: this.getClientDistribution()
    };
  }

  /**
   * Validate API specification
   */
  private async validateSpecification(spec: any): Promise<void> {
    try {
      await SwaggerParser.validate(spec);
    } catch (error) {
      loggingService.error('API specification validation failed', error);
      throw new Error('Invalid API specification');
    }
  }

  /**
   * Enhance documentation with additional information
   */
  private async enhanceDocumentation(
    baseSpec: any,
    options: ApiDocumentationOptions
  ): Promise<any> {
    const enhanced = { ...baseSpec };

    // Add examples if requested
    if (options.includeExamples) {
      this.addExamples(enhanced);
    }

    // Add code samples
    this.addCodeSamples(enhanced);

    // Add rate limiting information
    this.addRateLimitingInfo(enhanced);

    // Add webhook documentation
    this.addWebhookDocumentation(enhanced);

    // Add error codes reference
    this.addErrorCodesReference(enhanced);

    return enhanced;
  }

  /**
   * Add examples to specification
   */
  private addExamples(spec: any): void {
    for (const [path, pathObj] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathObj as any)) {
        if (typeof operation === 'object' && operation !== null) {
          const examples = this.generateExamples(path, method.toUpperCase(), spec.info.version);
          
          if (examples.request.body) {
            operation.requestBody = {
              content: {
                'application/json': {
                  example: examples.request.body
                }
              }
            };
          }

          // Add response examples
          for (const response of examples.responses) {
            if (operation.responses[response.statusCode]) {
              operation.responses[response.statusCode].content = {
                'application/json': {
                  example: response.body
                }
              };
            }
          }
        }
      }
    }
  }

  /**
   * Add code samples to specification
   */
  private addCodeSamples(spec: any): void {
    for (const [path, pathObj] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathObj as any)) {
        if (typeof operation === 'object' && operation !== null) {
          const samples = this.generateCodeSamples(
            method.toUpperCase(),
            path,
            spec.info.version
          );

          operation['x-code-samples'] = samples.map(sample => ({
            lang: sample.language,
            source: sample.code,
            label: sample.description || `${sample.language} example`
          }));
        }
      }
    }
  }

  /**
   * Add rate limiting information
   */
  private addRateLimitingInfo(spec: any): void {
    spec.components = spec.components || {};
    spec.components.headers = spec.components.headers || {};

    spec.components.headers['X-RateLimit-Limit'] = {
      description: 'Request limit per window',
      schema: { type: 'integer' }
    };

    spec.components.headers['X-RateLimit-Remaining'] = {
      description: 'Requests remaining in current window',
      schema: { type: 'integer' }
    };

    spec.components.headers['X-RateLimit-Reset'] = {
      description: 'Time when the current window resets',
      schema: { type: 'integer' }
    };
  }

  /**
   * Add webhook documentation
   */
  private addWebhookDocumentation(spec: any): void {
    spec.webhooks = {
      ticketCreated: {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    event: { type: 'string', example: 'ticket.created' },
                    data: { $ref: '#/components/schemas/Ticket' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Webhook received successfully'
            }
          }
        }
      }
    };
  }

  /**
   * Add error codes reference
   */
  private addErrorCodesReference(spec: any): void {
    spec.components.schemas.ErrorCodes = {
      type: 'object',
      properties: {
        'AUTH_001': { type: 'string', example: 'Invalid credentials' },
        'AUTH_002': { type: 'string', example: 'Token expired' },
        'VAL_001': { type: 'string', example: 'Required field missing' },
        'VAL_002': { type: 'string', example: 'Invalid format' },
        'BUS_001': { type: 'string', example: 'Business rule violation' },
        'SYS_001': { type: 'string', example: 'Internal server error' }
      }
    };
  }

  /**
   * Generate example request
   */
  private generateExampleRequest(method: string, endpoint: string, version: string): ExampleRequest {
    const request: ExampleRequest = {
      method,
      endpoint,
      headers: {
        'Content-Type': 'application/json',
        'API-Version': version,
        'Authorization': 'Bearer your-jwt-token'
      }
    };

    // Add method-specific examples
    switch (method.toUpperCase()) {
      case 'POST':
        if (endpoint.includes('login')) {
          request.body = {
            email: 'user@example.com',
            password: 'password123'
          };
          delete request.headers!.Authorization;
        } else if (endpoint.includes('tickets')) {
          request.body = {
            title: 'Sample ticket',
            description: 'This is a sample ticket description',
            priority: 'medium',
            assignedTo: 'user-id-123'
          };
        }
        break;
      case 'GET':
        if (endpoint.includes('tickets')) {
          request.query = {
            status: 'open',
            limit: '50'
          };
        }
        break;
    }

    return request;
  }

  /**
   * Generate example responses
   */
  private generateExampleResponses(method: string, endpoint: string, version: string): ExampleResponse[] {
    const responses: ExampleResponse[] = [];

    // Success response
    responses.push({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'API-Version': version
      },
      body: {
        success: true,
        data: this.generateExampleData(endpoint),
        meta: {
          version,
          timestamp: new Date().toISOString()
        }
      }
    });

    // Error responses
    if (!endpoint.includes('login')) {
      responses.push({
        statusCode: 401,
        body: {
          success: false,
          error: 'Unauthorized access',
          code: 'AUTH_001'
        }
      });
    }

    responses.push({
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'SYS_001'
      }
    });

    return responses;
  }

  /**
   * Generate example data based on endpoint
   */
  private generateExampleData(endpoint: string): any {
    if (endpoint.includes('login')) {
      return {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh_token_here',
        user: {
          id: 'user-123',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'fieldtech'
        }
      };
    }

    if (endpoint.includes('tickets')) {
      return {
        tickets: [
          {
            id: 'ticket-123',
            title: 'Sample ticket',
            description: 'This is a sample ticket',
            status: 'open',
            priority: 'medium',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 50
        }
      };
    }

    return {};
  }

  /**
   * Generate code sample for specific language
   */
  private generateCodeSampleForLanguage(
    language: string,
    request: ExampleRequest
  ): CodeSample | null {
    switch (language) {
      case 'curl':
        return this.generateCurlSample(request);
      case 'javascript':
        return this.generateJavaScriptSample(request);
      case 'python':
        return this.generatePythonSample(request);
      case 'java':
        return this.generateJavaSample(request);
      default:
        return null;
    }
  }

  /**
   * Generate curl sample
   */
  private generateCurlSample(request: ExampleRequest): CodeSample {
    let curl = `curl -X ${request.method}`;
    
    if (request.headers) {
      for (const [key, value] of Object.entries(request.headers)) {
        curl += ` \\\n  -H "${key}: ${value}"`;
      }
    }

    if (request.body) {
      curl += ` \\\n  -d '${JSON.stringify(request.body, null, 2)}'`;
    }

    const queryString = request.query ? 
      '?' + new URLSearchParams(request.query).toString() : '';

    curl += ` \\\n  "${process.env.API_BASE_URL || 'http://localhost:3000'}/api${request.endpoint}${queryString}"`;

    return {
      language: 'curl',
      code: curl,
      description: 'cURL example'
    };
  }

  /**
   * Generate JavaScript sample
   */
  private generateJavaScriptSample(request: ExampleRequest): CodeSample {
    const js = `
const response = await fetch('${process.env.API_BASE_URL || 'http://localhost:3000'}/api${request.endpoint}', {
  method: '${request.method}',
  headers: ${JSON.stringify(request.headers, null, 4)},${request.body ? `
  body: JSON.stringify(${JSON.stringify(request.body, null, 4)})` : ''}
});

const data = await response.json();
console.log(data);
    `.trim();

    return {
      language: 'javascript',
      code: js,
      description: 'JavaScript fetch example'
    };
  }

  /**
   * Generate Python sample
   */
  private generatePythonSample(request: ExampleRequest): CodeSample {
    const python = `
import requests

url = "${process.env.API_BASE_URL || 'http://localhost:3000'}/api${request.endpoint}"
headers = ${JSON.stringify(request.headers, null, 4).replace(/"/g, "'")}${request.body ? `
data = ${JSON.stringify(request.body, null, 4).replace(/"/g, "'")}

response = requests.${request.method.toLowerCase()}(url, headers=headers, json=data)` : `

response = requests.${request.method.toLowerCase()}(url, headers=headers)`}
print(response.json())
    `.trim();

    return {
      language: 'python',
      code: python,
      description: 'Python requests example'
    };
  }

  /**
   * Generate Java sample
   */
  private generateJavaSample(request: ExampleRequest): CodeSample {
    const java = `
HttpClient client = HttpClient.newHttpClient();
HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
    .uri(URI.create("${process.env.API_BASE_URL || 'http://localhost:3000'}/api${request.endpoint}"))${Object.entries(request.headers || {}).map(([key, value]) => `
    .header("${key}", "${value}")`).join('')}${request.body ? `
    .${request.method.toUpperCase()}(HttpRequest.BodyPublishers.ofString("${JSON.stringify(request.body).replace(/"/g, '\\"')}"));` : `
    .${request.method.toUpperCase()}(HttpRequest.BodyPublishers.noBody());`}

HttpResponse<String> response = client.send(requestBuilder.build(), 
    HttpResponse.BodyHandlers.ofString());

System.out.println(response.body());
    `.trim();

    return {
      language: 'java',
      code: java,
      description: 'Java HttpClient example'
    };
  }

  /**
   * Generate Swagger UI HTML
   */
  private generateSwaggerUIHtml(spec: any, theme: 'light' | 'dark'): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>FieldSync API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: ${theme === 'dark' ? '#1a1a1a' : '#fafafa'}; }
    ${theme === 'dark' ? `
      .swagger-ui { filter: invert(1) hue-rotate(180deg); }
      .swagger-ui .microlight { filter: invert(1) hue-rotate(180deg); }
    ` : ''}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: 'data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(spec))}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.presets.standalone
      ],
      plugins: [
        SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: "StandaloneLayout"
    });
  </script>
</body>
</html>
    `;
  }

  /**
   * Convert specification to YAML
   */
  private convertToYaml(spec: any): string {
    // This would use a YAML library like js-yaml
    // For now, return JSON as placeholder
    return JSON.stringify(spec, null, 2);
  }

  /**
   * Check if documentation is cached and valid
   */
  private isDocumentationCached(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    return !!(expiry && Date.now() < expiry && this.documentationCache.has(cacheKey));
  }

  /**
   * Get popular endpoints (placeholder)
   */
  private getPopularEndpoints(): any[] {
    return [
      { endpoint: '/auth/login', requests: 1500 },
      { endpoint: '/tickets', requests: 1200 },
      { endpoint: '/users', requests: 800 }
    ];
  }

  /**
   * Get client distribution (placeholder)
   */
  private getClientDistribution(): any {
    return {
      mobile: 45,
      web: 35,
      api: 20
    };
  }
}

export default new ApiDocumentationService();