/**
 * Business Cache Service
 * Specialized caching service for business data like sites, tickets, shifts, and analytics
 */

import cacheService from './cacheService';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';

// Business cache keys
const CACHE_KEYS = {
  SITE_DATA: 'site:',
  TICKET_DATA: 'ticket:',
  SHIFT_DATA: 'shift:',
  GEOFENCE_DATA: 'geofence:site:',
  ANALYTICS_REPORTS: 'analytics:report:',
  ANALYTICS_METRICS: 'analytics:metrics:',
  SLA_TRACKER: 'sla:tracker:',
  SLA_TEMPLATE: 'sla:template:',
  CLIENT_DATA: 'client:',
  STAFF_DATA: 'staff:',
  SYSTEM_CONFIG: 'config:',
  API_RESPONSE: 'api:response:',
  DASHBOARD_DATA: 'dashboard:',
  SCHEDULE_DATA: 'schedule:',
} as const;

// Business data TTL values (in seconds)
const TTL = {
  SITE_DATA: 3600,          // 1 hour
  TICKET_DATA: 900,         // 15 minutes
  SHIFT_DATA: 300,          // 5 minutes
  GEOFENCE_DATA: 7200,      // 2 hours
  ANALYTICS_REPORTS: 1800,  // 30 minutes
  ANALYTICS_METRICS: 600,   // 10 minutes
  SLA_TRACKER: 300,         // 5 minutes
  SLA_TEMPLATE: 86400,      // 24 hours
  CLIENT_DATA: 3600,        // 1 hour
  STAFF_DATA: 1800,         // 30 minutes
  SYSTEM_CONFIG: 86400,     // 24 hours
  API_RESPONSE: 600,        // 10 minutes
  DASHBOARD_DATA: 300,      // 5 minutes
  SCHEDULE_DATA: 1800,      // 30 minutes
} as const;

interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compression?: boolean;
}

/**
 * Business Cache Service for managing business-related data
 */
export class BusinessCacheService {

  /**
   * Generic method to cache business data
   */
  private async cacheData(
    keyPrefix: string,
    id: string,
    data: any,
    ttl: number,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const timer = monitoring.startTimer('business_cache_set_duration');
      const cacheKey = `${keyPrefix}${id}`;
      const success = await cacheService.set(cacheKey, data, options?.ttl || ttl);
      timer();

      if (success) {
        monitoring.incrementCounter('business_cache_operations_total', 1, {
          operation: 'set',
          type: keyPrefix.replace(':', ''),
          status: 'success'
        });
        loggingService.debug('Business data cached', { keyPrefix, id });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache business data', error, { keyPrefix, id });
      monitoring.incrementCounter('business_cache_operations_total', 1, {
        operation: 'set',
        type: keyPrefix.replace(':', ''),
        status: 'error'
      });
      return false;
    }
  }

  /**
   * Generic method to get business data from cache
   */
  private async getCachedData<T>(keyPrefix: string, id: string): Promise<T | null> {
    try {
      const timer = monitoring.startTimer('business_cache_get_duration');
      const cacheKey = `${keyPrefix}${id}`;
      const data = await cacheService.get<T>(cacheKey);
      timer();

      monitoring.incrementCounter('business_cache_operations_total', 1, {
        operation: 'get',
        type: keyPrefix.replace(':', ''),
        status: data ? 'hit' : 'miss'
      });

      return data;
    } catch (error) {
      loggingService.error('Failed to get cached business data', error, { keyPrefix, id });
      monitoring.incrementCounter('business_cache_operations_total', 1, {
        operation: 'get',
        type: keyPrefix.replace(':', ''),
        status: 'error'
      });
      return null;
    }
  }

  // Site Data Caching
  async setSiteData(siteId: string, siteData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.SITE_DATA, siteId, siteData, TTL.SITE_DATA, options);
  }

  async getSiteData(siteId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.SITE_DATA, siteId);
  }

  async deleteSiteData(siteId: string): Promise<boolean> {
    try {
      const success = await cacheService.del(`${CACHE_KEYS.SITE_DATA}${siteId}`);
      if (success) {
        loggingService.debug('Site data removed from cache', { siteId });
      }
      return success;
    } catch (error) {
      loggingService.error('Failed to delete site data', error, { siteId });
      return false;
    }
  }

  // Ticket Data Caching
  async setTicketData(ticketId: string, ticketData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.TICKET_DATA, ticketId, ticketData, TTL.TICKET_DATA, options);
  }

  async getTicketData(ticketId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.TICKET_DATA, ticketId);
  }

  async deleteTicketData(ticketId: string): Promise<boolean> {
    try {
      const success = await cacheService.del(`${CACHE_KEYS.TICKET_DATA}${ticketId}`);
      if (success) {
        loggingService.debug('Ticket data removed from cache', { ticketId });
      }
      return success;
    } catch (error) {
      loggingService.error('Failed to delete ticket data', error, { ticketId });
      return false;
    }
  }

  // Shift Data Caching
  async setShiftData(shiftId: string, shiftData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.SHIFT_DATA, shiftId, shiftData, TTL.SHIFT_DATA, options);
  }

  async getShiftData(shiftId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.SHIFT_DATA, shiftId);
  }

  async deleteShiftData(shiftId: string): Promise<boolean> {
    try {
      const success = await cacheService.del(`${CACHE_KEYS.SHIFT_DATA}${shiftId}`);
      if (success) {
        loggingService.debug('Shift data removed from cache', { shiftId });
      }
      return success;
    } catch (error) {
      loggingService.error('Failed to delete shift data', error, { shiftId });
      return false;
    }
  }

  // Geofence Data Caching
  async setGeofenceData(siteId: string, geofenceData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.GEOFENCE_DATA, siteId, geofenceData, TTL.GEOFENCE_DATA, options);
  }

  async getGeofenceData(siteId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.GEOFENCE_DATA, siteId);
  }

  // Analytics Caching
  async setAnalyticsReport(reportKey: string, reportData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.ANALYTICS_REPORTS, reportKey, reportData, TTL.ANALYTICS_REPORTS, options);
  }

  async getAnalyticsReport(reportKey: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.ANALYTICS_REPORTS, reportKey);
  }

  async setAnalyticsMetrics(metricsKey: string, metricsData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.ANALYTICS_METRICS, metricsKey, metricsData, TTL.ANALYTICS_METRICS, options);
  }

  async getAnalyticsMetrics(metricsKey: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.ANALYTICS_METRICS, metricsKey);
  }

  // SLA Data Caching
  async setSLATracker(trackerId: string, trackerData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.SLA_TRACKER, trackerId, trackerData, TTL.SLA_TRACKER, options);
  }

  async getSLATracker(trackerId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.SLA_TRACKER, trackerId);
  }

  async setSLATemplate(templateId: string, templateData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.SLA_TEMPLATE, templateId, templateData, TTL.SLA_TEMPLATE, options);
  }

  async getSLATemplate(templateId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.SLA_TEMPLATE, templateId);
  }

  // Client Data Caching
  async setClientData(clientId: string, clientData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.CLIENT_DATA, clientId, clientData, TTL.CLIENT_DATA, options);
  }

  async getClientData(clientId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.CLIENT_DATA, clientId);
  }

  // Staff Data Caching
  async setStaffData(staffId: string, staffData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.STAFF_DATA, staffId, staffData, TTL.STAFF_DATA, options);
  }

  async getStaffData(staffId: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.STAFF_DATA, staffId);
  }

  // System Configuration Caching
  async setSystemConfig(configKey: string, configData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.SYSTEM_CONFIG, configKey, configData, TTL.SYSTEM_CONFIG, options);
  }

  async getSystemConfig(configKey: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.SYSTEM_CONFIG, configKey);
  }

  // API Response Caching
  async setAPIResponse(endpoint: string, responseData: any, options?: CacheOptions): Promise<boolean> {
    const cacheKey = this.generateAPIKey(endpoint);
    return this.cacheData(CACHE_KEYS.API_RESPONSE, cacheKey, responseData, TTL.API_RESPONSE, options);
  }

  async getAPIResponse(endpoint: string): Promise<any | null> {
    const cacheKey = this.generateAPIKey(endpoint);
    return this.getCachedData(CACHE_KEYS.API_RESPONSE, cacheKey);
  }

  private generateAPIKey(endpoint: string): string {
    // Create a cache-safe key from endpoint
    return endpoint.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }

  // Dashboard Data Caching
  async setDashboardData(userId: string, dashboardType: string, data: any, options?: CacheOptions): Promise<boolean> {
    const dashboardKey = `${userId}:${dashboardType}`;
    return this.cacheData(CACHE_KEYS.DASHBOARD_DATA, dashboardKey, data, TTL.DASHBOARD_DATA, options);
  }

  async getDashboardData(userId: string, dashboardType: string): Promise<any | null> {
    const dashboardKey = `${userId}:${dashboardType}`;
    return this.getCachedData(CACHE_KEYS.DASHBOARD_DATA, dashboardKey);
  }

  // Schedule Data Caching
  async setScheduleData(scheduleKey: string, scheduleData: any, options?: CacheOptions): Promise<boolean> {
    return this.cacheData(CACHE_KEYS.SCHEDULE_DATA, scheduleKey, scheduleData, TTL.SCHEDULE_DATA, options);
  }

  async getScheduleData(scheduleKey: string): Promise<any | null> {
    return this.getCachedData(CACHE_KEYS.SCHEDULE_DATA, scheduleKey);
  }

  // Bulk Operations
  async setBulkData(dataMap: Record<string, { keyPrefix: string; data: any; ttl?: number }>): Promise<boolean[]> {
    try {
      const promises = Object.entries(dataMap).map(([id, { keyPrefix, data, ttl }]) => 
        this.cacheData(keyPrefix, id, data, ttl || TTL.API_RESPONSE)
      );

      const results = await Promise.allSettled(promises);
      return results.map(result => result.status === 'fulfilled' && result.value);
    } catch (error) {
      loggingService.error('Failed to set bulk data', error);
      return [];
    }
  }

  async getBulkData<T>(requests: Array<{ keyPrefix: string; id: string }>): Promise<(T | null)[]> {
    try {
      const promises = requests.map(({ keyPrefix, id }) => 
        this.getCachedData<T>(keyPrefix, id)
      );

      return await Promise.all(promises);
    } catch (error) {
      loggingService.error('Failed to get bulk data', error);
      return new Array(requests.length).fill(null);
    }
  }

  // Cache Invalidation
  async invalidateByType(type: keyof typeof CACHE_KEYS): Promise<boolean> {
    try {
      const pattern = `${CACHE_KEYS[type]}*`;
      const success = await cacheService.clear(pattern);

      if (success) {
        loggingService.info('Cache invalidated by type', { type, pattern });
        monitoring.incrementCounter('business_cache_invalidation_total', 1, {
          type: type.toLowerCase(),
          status: 'success'
        });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to invalidate cache by type', error, { type });
      monitoring.incrementCounter('business_cache_invalidation_total', 1, {
        type: type.toLowerCase(),
        status: 'error'
      });
      return false;
    }
  }

  async invalidateByPattern(pattern: string): Promise<boolean> {
    try {
      const success = await cacheService.clear(pattern);

      if (success) {
        loggingService.info('Cache invalidated by pattern', { pattern });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to invalidate cache by pattern', error, { pattern });
      return false;
    }
  }

  // Cache Warming
  async warmupSiteData(siteIds: string[], dataFetcher: (siteId: string) => Promise<any>): Promise<boolean> {
    try {
      const promises = siteIds.map(async (siteId) => {
        try {
          const data = await dataFetcher(siteId);
          return await this.setSiteData(siteId, data);
        } catch (error) {
          loggingService.error('Failed to warm up site data', error, { siteId });
          return false;
        }
      });

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      loggingService.info('Site data warmup completed', { 
        successCount, 
        totalCount: siteIds.length 
      });

      return successCount === siteIds.length;
    } catch (error) {
      loggingService.error('Failed to warm up site data', error);
      return false;
    }
  }

  // Cache Statistics
  async getBusinessCacheStats(): Promise<{
    hitRate: number;
    operations: Record<string, number>;
    sizes: Record<string, number>;
  }> {
    try {
      const metrics = await cacheService.getMetrics();
      
      return {
        hitRate: metrics.hitRate || 0,
        operations: {
          hits: metrics.hits || 0,
          misses: metrics.misses || 0,
          errors: metrics.errors || 0,
          total: metrics.totalOperations || 0
        },
        sizes: {} // This would require additional Redis commands to get size by pattern
      };
    } catch (error) {
      loggingService.error('Failed to get business cache stats', error);
      return {
        hitRate: 0,
        operations: { hits: 0, misses: 0, errors: 0, total: 0 },
        sizes: {}
      };
    }
  }

  // Cache Health Check
  async healthCheck(): Promise<{
    isHealthy: boolean;
    redis: boolean;
    fallback: boolean;
    metrics: any;
  }> {
    try {
      const health = await cacheService.healthCheck();
      
      return {
        isHealthy: health.redis || health.fallback,
        redis: health.redis,
        fallback: health.fallback,
        metrics: health.metrics
      };
    } catch (error) {
      loggingService.error('Business cache health check failed', error);
      return {
        isHealthy: false,
        redis: false,
        fallback: true,
        metrics: null
      };
    }
  }
}

// Export singleton instance
export const businessCacheService = new BusinessCacheService();
export default businessCacheService;