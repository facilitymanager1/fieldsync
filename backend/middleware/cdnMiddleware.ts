/**
 * CDN Middleware for Asset Optimization and Delivery
 * Provides intelligent asset serving, optimization, and CDN integration
 */

import { Request, Response, NextFunction } from 'express';
import { cdnService } from '../services/cdnService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';
import { redisService, CachePattern, CacheStrategy } from '../services/redisService';
import path from 'path';
import fs from 'fs/promises';

// Asset delivery options
interface AssetDeliveryOptions {
  enableOptimization: boolean;
  enableCaching: boolean;
  enableCompression: boolean;
  enableWebP: boolean;
  enableAVIF: boolean;
  maxAge: number;
  staleWhileRevalidate: number;
  quality: number;
  sizes: number[];
}

// Image transformation parameters
interface ImageTransform {
  width?: number;
  height?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

// Asset response metadata
interface AssetResponse {
  buffer: Buffer;
  mimeType: string;
  etag: string;
  lastModified: Date;
  size: number;
  optimized: boolean;
  cached: boolean;
}

/**
 * CDN Asset Delivery Middleware
 */
export class CDNMiddleware {
  private static defaultOptions: AssetDeliveryOptions = {
    enableOptimization: true,
    enableCaching: true,
    enableCompression: true,
    enableWebP: true,
    enableAVIF: false, // AVIF support may not be universal yet
    maxAge: 31536000, // 1 year
    staleWhileRevalidate: 86400, // 1 day
    quality: 85,
    sizes: [320, 640, 960, 1280, 1920]
  };

  /**
   * Static asset serving middleware with CDN optimization
   */
  static assetDelivery(options?: Partial<AssetDeliveryOptions>) {
    const config = { ...CDNMiddleware.defaultOptions, ...options };

    return async (req: Request, res: Response, next: NextFunction) => {
      const timer = monitoring.startTimer('cdn_asset_delivery_duration');

      try {
        // Only handle asset requests
        if (!CDNMiddleware.isAssetRequest(req.path)) {
          return next();
        }

        const assetPath = req.path;
        const transform = CDNMiddleware.parseTransformParams(req.query);
        const cacheKey = CDNMiddleware.generateCacheKey(assetPath, transform);

        // Check client capabilities
        const clientCapabilities = CDNMiddleware.detectClientCapabilities(req);

        // Try to get from cache first
        if (config.enableCaching) {
          const cached = await CDNMiddleware.getCachedAsset(cacheKey);
          if (cached) {
            CDNMiddleware.sendAssetResponse(res, cached, config, true);
            monitoring.incrementCounter('cdn_cache_hits_total', 1);
            timer();
            return;
          }
        }

        // Generate optimized asset
        const assetResponse = await CDNMiddleware.generateOptimizedAsset(
          assetPath,
          transform,
          clientCapabilities,
          config
        );

        if (!assetResponse) {
          monitoring.incrementCounter('cdn_asset_not_found_total', 1);
          timer();
          return res.status(404).send('Asset not found');
        }

        // Cache the optimized asset
        if (config.enableCaching) {
          await CDNMiddleware.cacheAsset(cacheKey, assetResponse);
        }

        // Send response
        CDNMiddleware.sendAssetResponse(res, assetResponse, config, false);

        monitoring.incrementCounter('cdn_assets_served_total', 1, {
          type: CDNMiddleware.getAssetType(assetPath),
          optimized: assetResponse.optimized.toString(),
          cached: 'false'
        });

        timer();

      } catch (error) {
        timer();
        loggingService.error('CDN asset delivery error', error, {
          path: req.path,
          query: req.query
        });

        monitoring.incrementCounter('cdn_delivery_errors_total', 1);
        
        // Fallback to next middleware
        next();
      }
    };
  }

  /**
   * Image optimization middleware
   */
  static imageOptimization(options?: {
    quality?: number;
    formats?: string[];
    sizes?: number[];
    enableWebP?: boolean;
    enableAVIF?: boolean;
  }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Only handle image requests
        if (!CDNMiddleware.isImageRequest(req.path)) {
          return next();
        }

        const transform = CDNMiddleware.parseTransformParams(req.query);
        const clientCapabilities = CDNMiddleware.detectClientCapabilities(req);

        // Auto-select best format based on client support
        if (!transform.format) {
          if (clientCapabilities.supportsAVIF && options?.enableAVIF) {
            transform.format = 'avif';
          } else if (clientCapabilities.supportsWebP && options?.enableWebP) {
            transform.format = 'webp';
          }
        }

        // Store transform params for next middleware
        (req as any).imageTransform = transform;
        (req as any).clientCapabilities = clientCapabilities;

        next();

      } catch (error) {
        loggingService.error('Image optimization middleware error', error);
        next();
      }
    };
  }

  /**
   * Asset versioning and cache busting middleware
   */
  static assetVersioning() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Extract version from path (e.g., /assets/v123456/image.jpg)
        const versionMatch = req.path.match(/\/v([a-f0-9]+)\//);
        if (versionMatch) {
          const version = versionMatch[1];
          const originalPath = req.path.replace(`/v${version}`, '');
          
          // Validate version against asset hash
          const isValidVersion = await CDNMiddleware.validateAssetVersion(originalPath, version);
          
          if (isValidVersion) {
            // Set long-term caching headers for versioned assets
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
            res.set('X-Asset-Version', version);
            
            // Rewrite path for processing
            req.url = originalPath;
            req.path = originalPath;
          } else {
            return res.status(404).send('Invalid asset version');
          }
        }

        next();

      } catch (error) {
        loggingService.error('Asset versioning middleware error', error);
        next();
      }
    };
  }

  /**
   * Critical resource preloading middleware
   */
  static criticalResourcePreloader(criticalAssets: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Only add preload headers for HTML responses
        if (req.path === '/' || req.path.endsWith('.html')) {
          const preloadLinks = cdnService.generatePreloadLinks(criticalAssets);
          
          if (preloadLinks.length > 0) {
            res.set('Link', preloadLinks.join(', '));
            monitoring.incrementCounter('cdn_preload_headers_sent_total', 1, {
              assetsCount: preloadLinks.length.toString()
            });
          }
        }

        next();

      } catch (error) {
        loggingService.error('Critical resource preloader error', error);
        next();
      }
    };
  }

  /**
   * CDN health check endpoint
   */
  static healthCheck() {
    return async (req: Request, res: Response) => {
      try {
        const health = await cdnService.healthCheck();
        const stats = await cdnService.getStats();

        res.status(health.status === 'healthy' ? 200 : 503).json({
          status: health.status,
          timestamp: new Date().toISOString(),
          cdn: {
            latency: health.latency,
            assetsCount: health.assetsCount,
            cacheHitRate: health.cacheHitRate,
            errors: health.errors
          },
          stats: {
            totalAssets: stats.totalAssets,
            optimizedAssets: stats.optimizedAssets,
            compressionRatio: stats.compressionRatio,
            bandwidthSaved: stats.bandwidth.saved
          }
        });

      } catch (error) {
        loggingService.error('CDN health check error', error);
        res.status(500).json({
          status: 'error',
          error: 'Health check failed'
        });
      }
    };
  }

  // Private helper methods

  private static isAssetRequest(path: string): boolean {
    const assetPatterns = [
      /^\/_next\/static\//,
      /^\/_next\/image\//,
      /^\/static\//,
      /^\/assets\//,
      /\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|woff|woff2|ttf|eot|ico)$/i
    ];

    return assetPatterns.some(pattern => pattern.test(path));
  }

  private static isImageRequest(path: string): boolean {
    return /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i.test(path);
  }

  private static parseTransformParams(query: any): ImageTransform {
    const transform: ImageTransform = {};

    if (query.w || query.width) {
      transform.width = parseInt(query.w || query.width);
    }
    
    if (query.h || query.height) {
      transform.height = parseInt(query.h || query.height);
    }
    
    if (query.f || query.format) {
      const format = (query.f || query.format).toLowerCase();
      if (['webp', 'avif', 'jpeg', 'png'].includes(format)) {
        transform.format = format as any;
      }
    }
    
    if (query.q || query.quality) {
      const quality = parseInt(query.q || query.quality);
      if (quality > 0 && quality <= 100) {
        transform.quality = quality;
      }
    }
    
    if (query.fit) {
      const fit = query.fit.toLowerCase();
      if (['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)) {
        transform.fit = fit as any;
      }
    }

    return transform;
  }

  private static detectClientCapabilities(req: Request): {
    supportsWebP: boolean;
    supportsAVIF: boolean;
    supportsHTTP2: boolean;
  } {
    const acceptHeader = req.get('Accept') || '';
    const userAgent = req.get('User-Agent') || '';

    return {
      supportsWebP: acceptHeader.includes('image/webp'),
      supportsAVIF: acceptHeader.includes('image/avif'),
      supportsHTTP2: req.httpVersion === '2.0'
    };
  }

  private static generateCacheKey(assetPath: string, transform: ImageTransform): string {
    const transformString = JSON.stringify(transform);
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(assetPath + transformString).digest('hex');
    return `cdn_asset:${hash}`;
  }

  private static async getCachedAsset(cacheKey: string): Promise<AssetResponse | null> {
    try {
      return await redisService.get<AssetResponse>(CachePattern.COMPUTED_DATA, cacheKey);
    } catch (error) {
      loggingService.warn('Failed to get cached asset', error, { cacheKey });
      return null;
    }
  }

  private static async cacheAsset(cacheKey: string, asset: AssetResponse): Promise<void> {
    try {
      await redisService.set(
        CachePattern.COMPUTED_DATA,
        cacheKey,
        {
          ...asset,
          buffer: asset.buffer.toString('base64') // Convert buffer to string for caching
        },
        {
          ttl: 3600, // 1 hour
          tags: ['cdn', 'assets'],
          strategy: CacheStrategy.WRITE_THROUGH
        }
      );
    } catch (error) {
      loggingService.warn('Failed to cache asset', error, { cacheKey });
    }
  }

  private static async generateOptimizedAsset(
    assetPath: string,
    transform: ImageTransform,
    clientCapabilities: any,
    config: AssetDeliveryOptions
  ): Promise<AssetResponse | null> {
    try {
      // Try to get CDN URL first
      const cdnUrl = cdnService.generateAssetUrl(assetPath, {
        width: transform.width,
        height: transform.height,
        format: transform.format,
        quality: transform.quality
      });

      // For this implementation, we'll simulate asset optimization
      // In production, this would integrate with actual image processing libraries
      
      const publicPath = path.join(process.cwd(), 'public', assetPath);
      
      try {
        const buffer = await fs.readFile(publicPath);
        const stats = await fs.stat(publicPath);
        
        return {
          buffer,
          mimeType: CDNMiddleware.getMimeType(assetPath),
          etag: CDNMiddleware.generateETag(buffer),
          lastModified: stats.mtime,
          size: buffer.length,
          optimized: config.enableOptimization,
          cached: false
        };
      } catch (fileError) {
        // File not found in public directory
        return null;
      }

    } catch (error) {
      loggingService.error('Failed to generate optimized asset', error, {
        assetPath,
        transform
      });
      return null;
    }
  }

  private static sendAssetResponse(
    res: Response,
    asset: AssetResponse,
    config: AssetDeliveryOptions,
    fromCache: boolean
  ): void {
    // Set cache headers
    res.set('Cache-Control', `public, max-age=${config.maxAge}`);
    if (config.staleWhileRevalidate > 0) {
      res.set('Cache-Control', 
        `public, max-age=${config.maxAge}, stale-while-revalidate=${config.staleWhileRevalidate}`
      );
    }

    // Set ETag and Last-Modified
    res.set('ETag', asset.etag);
    res.set('Last-Modified', asset.lastModified.toUTCString());

    // Set content headers
    res.set('Content-Type', asset.mimeType);
    res.set('Content-Length', asset.size.toString());

    // Set optimization headers
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.set('X-Optimized', asset.optimized.toString());
    res.set('Accept-Ranges', 'bytes');

    // Handle conditional requests
    const ifNoneMatch = res.req.get('If-None-Match');
    const ifModifiedSince = res.req.get('If-Modified-Since');

    if (ifNoneMatch === asset.etag) {
      return res.status(304).send();
    }

    if (ifModifiedSince) {
      const modifiedSince = new Date(ifModifiedSince);
      if (asset.lastModified <= modifiedSince) {
        return res.status(304).send();
      }
    }

    // Send the asset
    const buffer = typeof asset.buffer === 'string' 
      ? Buffer.from(asset.buffer, 'base64') 
      : asset.buffer;
    
    res.send(buffer);
  }

  private static getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  private static getAssetType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'].includes(ext)) {
      return 'image';
    } else if (ext === '.css') {
      return 'css';
    } else if (ext === '.js') {
      return 'javascript';
    } else if (['.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      return 'font';
    } else {
      return 'other';
    }
  }

  private static generateETag(buffer: Buffer): string {
    const crypto = require('crypto');
    return `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
  }

  private static async validateAssetVersion(assetPath: string, version: string): Promise<boolean> {
    try {
      // Check if the version matches the current asset hash
      const cachedAsset = await redisService.get<any>(
        CachePattern.COMPUTED_DATA,
        `cdn_asset:${assetPath}`
      );

      return cachedAsset?.hash === version;
    } catch (error) {
      return false;
    }
  }
}

// Export individual middleware functions
export const {
  assetDelivery,
  imageOptimization,
  assetVersioning,
  criticalResourcePreloader,
  healthCheck
} = CDNMiddleware;

export default CDNMiddleware;