/**
 * Comprehensive Telemetry Service
 * OpenTelemetry implementation with distributed tracing, metrics, and logging
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { trace, metrics, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { randomBytes } from 'crypto';

interface TelemetryConfig {
  serviceName: string;
  environment: string;
  version: string;
  jaegerEndpoint?: string;
  otlpEndpoint?: string;
  prometheusPort?: number;
  enableConsoleExporter?: boolean;
  enableDistributedTracing?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  sampleRate?: number;
}

interface TraceContext {
  traceId: string;
  spanId: string;
  correlationId: string;
  userId?: string;
  operation: string;
  metadata?: Record<string, any>;
}

interface BusinessMetric {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp?: Date;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  errorType?: string;
  metadata?: Record<string, any>;
}

class TelemetryService {
  private sdk: NodeSDK;
  private tracer: any;
  private meter: any;
  private config: TelemetryConfig;
  private contextManager: AsyncHooksContextManager;
  private counters: Map<string, any> = new Map();
  private histograms: Map<string, any> = new Map();
  private gauges: Map<string, any> = new Map();

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.contextManager = new AsyncHooksContextManager();
    this.initializeSDK();
    this.initializeInstruments();
  }

  private initializeSDK(): void {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.version,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
    });

    // Configure trace exporters
    const traceExporters = [];
    
    if (this.config.jaegerEndpoint) {
      traceExporters.push(new JaegerExporter({
        endpoint: this.config.jaegerEndpoint,
      }));
    }

    if (this.config.otlpEndpoint) {
      traceExporters.push(new OTLPTraceExporter({
        url: `${this.config.otlpEndpoint}/v1/traces`,
      }));
    }

    // Configure metric exporters
    const metricReaders = [];
    
    if (this.config.prometheusPort) {
      metricReaders.push(new PrometheusExporter({
        port: this.config.prometheusPort,
      }));
    }

    if (this.config.otlpEndpoint) {
      metricReaders.push(new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${this.config.otlpEndpoint}/v1/metrics`,
        }),
        exportIntervalMillis: 30000, // Export every 30 seconds
      }));
    }

    this.sdk = new NodeSDK({
      resource,
      traceExporter: traceExporters.length > 0 ? traceExporters[0] : undefined,
      metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable file system instrumentation for performance
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
          requestHook: (span, info) => {
            span.setAttributes({
              'http.route': info.route,
              'user.id': info.req.user?.id || 'anonymous',
            });
          },
        },
        '@opentelemetry/instrumentation-mongodb': {
          enabled: true,
          enhancedDatabaseReporting: true,
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
        },
      })],
      contextManager: this.contextManager,
    });

    this.sdk.start();
    
    this.tracer = trace.getTracer(this.config.serviceName, this.config.version);
    this.meter = metrics.getMeter(this.config.serviceName, this.config.version);
  }

  private initializeInstruments(): void {
    // HTTP request metrics
    this.counters.set('http_requests_total', this.meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    }));

    this.histograms.set('http_request_duration', this.meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP request duration in seconds',
      unit: 's',
    }));

    // Business metrics
    this.counters.set('business_operations_total', this.meter.createCounter('business_operations_total', {
      description: 'Total number of business operations',
    }));

    this.histograms.set('business_operation_duration', this.meter.createHistogram('business_operation_duration_seconds', {
      description: 'Business operation duration in seconds',
      unit: 's',
    }));

    // Database metrics
    this.counters.set('database_queries_total', this.meter.createCounter('database_queries_total', {
      description: 'Total number of database queries',
    }));

    this.histograms.set('database_query_duration', this.meter.createHistogram('database_query_duration_seconds', {
      description: 'Database query duration in seconds',
      unit: 's',
    }));

    // Application metrics
    this.gauges.set('active_users', this.meter.createUpDownCounter('active_users_total', {
      description: 'Number of active users',
    }));

    this.gauges.set('memory_usage', this.meter.createUpDownCounter('memory_usage_bytes', {
      description: 'Application memory usage in bytes',
      unit: 'bytes',
    }));
  }

  /**
   * Create a new trace span with automatic instrumentation
   */
  public async traceOperation<T>(
    operationName: string,
    operation: (span: any) => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
      userId?: string;
    }
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: {
        'operation.name': operationName,
        'user.id': options?.userId || 'unknown',
        ...options?.attributes,
      },
    });

    const correlationId = this.generateCorrelationId();
    span.setAttributes({ 'correlation.id': correlationId });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return await operation(span);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      
      span.setAttributes({
        'error.type': error.constructor.name,
        'error.message': error.message,
        'error.stack': error.stack,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record business metrics with automatic correlation
   */
  public recordBusinessMetric(metric: BusinessMetric): void {
    const activeSpan = trace.getActiveSpan();
    const correlationId = activeSpan?.getAttribute('correlation.id') as string || this.generateCorrelationId();

    const tags = {
      ...metric.tags,
      'correlation.id': correlationId,
      'service.name': this.config.serviceName,
    };

    // Record to OpenTelemetry
    if (this.counters.has('business_operations_total')) {
      this.counters.get('business_operations_total').add(metric.value, tags);
    }

    // Add custom attributes to active span
    if (activeSpan) {
      activeSpan.setAttributes({
        [`metric.${metric.name}.value`]: metric.value,
        [`metric.${metric.name}.unit`]: metric.unit,
      });
    }
  }

  /**
   * Record performance metrics for operations
   */
  public recordPerformanceMetric(metric: PerformanceMetric): void {
    const activeSpan = trace.getActiveSpan();
    const correlationId = activeSpan?.getAttribute('correlation.id') as string || this.generateCorrelationId();

    const tags = {
      'operation': metric.operation,
      'success': metric.success.toString(),
      'correlation.id': correlationId,
      ...(metric.errorType && { 'error.type': metric.errorType }),
    };

    // Record duration histogram
    if (this.histograms.has('business_operation_duration')) {
      this.histograms.get('business_operation_duration').record(metric.duration / 1000, tags);
    }

    // Record operation counter
    if (this.counters.has('business_operations_total')) {
      this.counters.get('business_operations_total').add(1, tags);
    }
  }

  /**
   * Record HTTP request metrics
   */
  public recordHttpMetric(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    const tags = {
      'method': method,
      'route': route,
      'status_code': statusCode.toString(),
      'status_class': `${Math.floor(statusCode / 100)}xx`,
      'user.id': userId || 'anonymous',
    };

    this.counters.get('http_requests_total').add(1, tags);
    this.histograms.get('http_request_duration').record(duration / 1000, tags);
  }

  /**
   * Record database query metrics
   */
  public recordDatabaseMetric(
    operation: string,
    collection: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void {
    const tags = {
      'operation': operation,
      'collection': collection,
      'success': success.toString(),
      ...(errorType && { 'error.type': errorType }),
    };

    this.counters.get('database_queries_total').add(1, tags);
    this.histograms.get('database_query_duration').record(duration / 1000, tags);
  }

  /**
   * Update gauge metrics for system state
   */
  public updateGaugeMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (this.gauges.has(name)) {
      this.gauges.get(name).add(value, tags);
    }
  }

  /**
   * Get current trace context for correlation
   */
  public getCurrentTraceContext(): TraceContext | null {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) return null;

    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      correlationId: activeSpan.getAttribute('correlation.id') as string || this.generateCorrelationId(),
      userId: activeSpan.getAttribute('user.id') as string,
      operation: activeSpan.getAttribute('operation.name') as string || 'unknown',
      metadata: {
        traceFlags: spanContext.traceFlags,
        isRemote: spanContext.isRemote,
      },
    };
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `fs_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Collect system metrics
   */
  public collectSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.updateGaugeMetric('memory_usage', memoryUsage.heapUsed, { type: 'heap_used' });
    this.updateGaugeMetric('memory_usage', memoryUsage.heapTotal, { type: 'heap_total' });
    this.updateGaugeMetric('memory_usage', memoryUsage.rss, { type: 'rss' });
    this.updateGaugeMetric('memory_usage', memoryUsage.external, { type: 'external' });

    // Event loop lag
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      this.histograms.get('business_operation_duration')?.record(lag / 1000, { 
        operation: 'event_loop_lag',
        type: 'system_metric'
      });
    });
  }

  /**
   * Create middleware for Express.js integration
   */
  public createExpressMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
      
      // Add correlation ID to request
      req.correlationId = correlationId;
      res.setHeader('x-correlation-id', correlationId);

      // Start span for the request
      const span = this.tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.route': req.route?.path || req.path,
          'correlation.id': correlationId,
          'user.id': req.user?.id || 'anonymous',
          'user.agent': req.headers['user-agent'],
          'http.request_content_length': req.headers['content-length'],
        },
      });

      // Track response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_content_length': res.getHeader('content-length'),
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();

        // Record HTTP metrics
        this.recordHttpMetric(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration,
          req.user?.id
        );
      });

      // Continue with context
      context.with(trace.setSpan(context.active(), span), () => {
        next();
      });
    };
  }

  /**
   * Create database middleware for MongoDB operations
   */
  public createDatabaseMiddleware() {
    return {
      pre: (operation: string, collection: string) => {
        const startTime = Date.now();
        const span = this.tracer.startSpan(`db.${operation}`, {
          kind: SpanKind.CLIENT,
          attributes: {
            'db.system': 'mongodb',
            'db.operation': operation,
            'db.collection.name': collection,
            'db.name': 'fieldsync',
          },
        });

        return { span, startTime };
      },
      post: (context: any, error?: Error) => {
        const duration = Date.now() - context.startTime;
        
        if (error) {
          context.span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          context.span.setAttributes({
            'error.type': error.constructor.name,
            'error.message': error.message,
          });
        } else {
          context.span.setStatus({ code: SpanStatusCode.OK });
        }

        context.span.end();

        // Record database metrics
        this.recordDatabaseMetric(
          context.span.getAttribute('db.operation') as string,
          context.span.getAttribute('db.collection.name') as string,
          duration,
          !error,
          error?.constructor.name
        );
      },
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    try {
      await this.sdk.shutdown();
      console.log('Telemetry service shut down gracefully');
    } catch (error) {
      console.error('Error shutting down telemetry service:', error);
    }
  }
}

// Default configuration
const defaultConfig: TelemetryConfig = {
  serviceName: 'fieldsync-backend',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '1.0.0',
  jaegerEndpoint: process.env.JAEGER_ENDPOINT,
  otlpEndpoint: process.env.OTLP_ENDPOINT,
  prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090'),
  enableDistributedTracing: process.env.ENABLE_TRACING !== 'false',
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  enableLogging: process.env.ENABLE_LOGGING !== 'false',
  sampleRate: parseFloat(process.env.TRACE_SAMPLE_RATE || '1.0'),
};

// Export singleton instance
export const telemetryService = new TelemetryService(defaultConfig);

// Export types and classes
export { TelemetryService, TelemetryConfig, TraceContext, BusinessMetric, PerformanceMetric };