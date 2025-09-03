/**
 * Advanced Image Optimization Service for Mobile Performance
 * Provides intelligent image loading, caching, and optimization
 */

import { Image, PixelRatio, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { performanceService } from './performanceService';

export interface ImageOptimizationConfig {
  enableLazyLoading: boolean;
  enableProgressiveLoading: boolean;
  enableWebP: boolean;
  maxCacheSize: number; // MB
  compressionQuality: number;
  maxImageDimensions: {
    width: number;
    height: number;
  };
  placeholderConfig: {
    enabled: boolean;
    blurRadius: number;
    fadeInDuration: number;
  };
  networkOptimization: {
    enablePrefetch: boolean;
    maxConcurrentLoads: number;
    retryAttempts: number;
    timeout: number;
  };
}

export interface ImageMetrics {
  totalImages: number;
  cachedImages: number;
  loadTime: number;
  compressionRatio: number;
  cacheHitRate: number;
  averageImageSize: number;
  networkRequests: number;
  failedLoads: number;
}

export interface OptimizedImageProps {
  uri: string;
  width?: number;
  height?: number;
  quality?: number;
  priority?: 'low' | 'normal' | 'high';
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

class ImageOptimizationService {
  private static instance: ImageOptimizationService;
  private config: ImageOptimizationConfig;
  private imageCache: Map<string, any> = new Map();
  private loadingQueue: Map<string, Promise<any>> = new Map();
  private metrics: ImageMetrics;
  private preloadQueue: string[] = [];
  private concurrentLoads: number = 0;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.metrics = this.initializeMetrics();
    this.initializeCacheCleanup();
  }

  public static getInstance(): ImageOptimizationService {
    if (!ImageOptimizationService.instance) {
      ImageOptimizationService.instance = new ImageOptimizationService();
    }
    return ImageOptimizationService.instance;
  }

  private getDefaultConfig(): ImageOptimizationConfig {
    const deviceCapabilities = performanceService.getDeviceCapabilities();
    const isLowEndDevice = deviceCapabilities?.performance === 'low';
    
    return {
      enableLazyLoading: true,
      enableProgressiveLoading: !isLowEndDevice,
      enableWebP: true,
      maxCacheSize: isLowEndDevice ? 50 : 100, // MB
      compressionQuality: isLowEndDevice ? 0.6 : 0.8,
      maxImageDimensions: {
        width: isLowEndDevice ? 1024 : 2048,
        height: isLowEndDevice ? 1024 : 2048
      },
      placeholderConfig: {
        enabled: true,
        blurRadius: 2,
        fadeInDuration: 300
      },
      networkOptimization: {
        enablePrefetch: !isLowEndDevice,
        maxConcurrentLoads: isLowEndDevice ? 2 : 4,
        retryAttempts: 3,
        timeout: 10000
      }
    };
  }

  private initializeMetrics(): ImageMetrics {
    return {
      totalImages: 0,
      cachedImages: 0,
      loadTime: 0,
      compressionRatio: 0,
      cacheHitRate: 0,
      averageImageSize: 0,
      networkRequests: 0,
      failedLoads: 0
    };
  }

  /**
   * Optimize image URI based on device capabilities and requirements
   */
  optimizeImageUri(props: OptimizedImageProps): string {
    const { uri, width, height, quality, priority } = props;
    
    if (!uri || uri.startsWith('data:') || uri.startsWith('file:')) {
      return uri; // Don't optimize local or data URIs
    }

    const endMeasure = performanceService.measureRenderPerformance('image_uri_optimization');
    
    try {
      const pixelRatio = PixelRatio.get();
      const screenDimensions = Dimensions.get('window');
      
      // Calculate optimal dimensions
      const optimalWidth = this.calculateOptimalWidth(width, screenDimensions.width, pixelRatio);
      const optimalHeight = this.calculateOptimalHeight(height, screenDimensions.height, pixelRatio);
      
      // Apply quality based on priority and device capability
      const optimalQuality = this.calculateOptimalQuality(quality, priority);
      
      // Build optimized URL
      let optimizedUri = uri;
      const hasQuery = uri.includes('?');
      const separator = hasQuery ? '&' : '?';
      
      const params: string[] = [];
      
      if (optimalWidth) {
        params.push(`w=${optimalWidth}`);
      }
      
      if (optimalHeight) {
        params.push(`h=${optimalHeight}`);
      }
      
      params.push(`q=${Math.round(optimalQuality * 100)}`);
      
      // Add WebP support if available
      if (this.config.enableWebP) {
        params.push('f=webp');
      }
      
      // Add device pixel ratio info
      params.push(`dpr=${pixelRatio}`);
      
      if (params.length > 0) {
        optimizedUri = `${uri}${separator}${params.join('&')}`;
      }
      
      endMeasure();
      return optimizedUri;
      
    } catch (error) {
      endMeasure();
      console.warn('Image URI optimization failed:', error);
      return uri;
    }
  }

  /**
   * Load image with advanced optimization and caching
   */
  async loadOptimizedImage(props: OptimizedImageProps): Promise<any> {
    const optimizedUri = this.optimizeImageUri(props);
    const cacheKey = this.generateCacheKey(optimizedUri);
    
    // Check cache first
    if (this.imageCache.has(cacheKey)) {
      this.metrics.cacheHitRate = this.calculateCacheHitRate();
      return this.imageCache.get(cacheKey);
    }
    
    // Check if already loading
    if (this.loadingQueue.has(cacheKey)) {
      return this.loadingQueue.get(cacheKey);
    }
    
    // Create loading promise
    const loadPromise = this.loadImageWithMetrics(optimizedUri, props);
    this.loadingQueue.set(cacheKey, loadPromise);
    
    try {
      const result = await loadPromise;
      
      // Cache the result
      this.cacheImage(cacheKey, result);
      
      // Clean up loading queue
      this.loadingQueue.delete(cacheKey);
      
      return result;
      
    } catch (error) {
      this.loadingQueue.delete(cacheKey);
      this.metrics.failedLoads++;
      
      if (props.onError) {
        props.onError(error);
      }
      
      throw error;
    }
  }

  /**
   * Load image with performance metrics
   */
  private async loadImageWithMetrics(uri: string, props: OptimizedImageProps): Promise<any> {
    const startTime = performance.now();
    const endMeasureLoad = performanceService.measureInteractionPerformance('image_load');
    
    try {
      // Respect concurrent load limits
      await this.waitForLoadSlot();
      this.concurrentLoads++;
      
      // Perform the actual image load
      const result = await this.performImageLoad(uri, props);
      
      // Update metrics
      const loadTime = performance.now() - startTime;
      this.updateLoadMetrics(loadTime, result);
      
      endMeasureLoad();
      
      if (props.onLoad) {
        props.onLoad();
      }
      
      return result;
      
    } finally {
      this.concurrentLoads--;
    }
  }

  /**
   * Wait for available load slot
   */
  private async waitForLoadSlot(): Promise<void> {
    while (this.concurrentLoads >= this.config.networkOptimization.maxConcurrentLoads) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Perform actual image loading with retry logic
   */
  private async performImageLoad(uri: string, props: OptimizedImageProps): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.config.networkOptimization.retryAttempts; attempt++) {
      try {
        const result = await Promise.race([
          this.loadImageFromNetwork(uri),
          this.createTimeoutPromise(this.config.networkOptimization.timeout)
        ]);
        
        this.metrics.networkRequests++;
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.networkOptimization.retryAttempts - 1) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Load image from network
   */
  private loadImageFromNetwork(uri: string): Promise<any> {
    return new Promise((resolve, reject) => {
      Image.prefetch(uri)
        .then((result: any) => {
          resolve({
            uri,
            width: result.width || 0,
            height: result.height || 0,
            size: result.size || 0
          });
        })
        .catch(reject);
    });
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Image load timeout')), timeout);
    });
  }

  /**
   * Update loading metrics
   */
  private updateLoadMetrics(loadTime: number, result: any): void {
    this.metrics.totalImages++;
    this.metrics.loadTime = (this.metrics.loadTime * (this.metrics.totalImages - 1) + loadTime) / this.metrics.totalImages;
    
    if (result.size) {
      this.metrics.averageImageSize = (this.metrics.averageImageSize * (this.metrics.totalImages - 1) + result.size) / this.metrics.totalImages;
    }
  }

  /**
   * Cache image with size management
   */
  private cacheImage(cacheKey: string, imageData: any): void {
    // Check cache size before adding
    if (this.getCacheSize() + this.estimateImageSize(imageData) > this.config.maxCacheSize * 1024 * 1024) {
      this.cleanupCache();
    }
    
    this.imageCache.set(cacheKey, {
      ...imageData,
      cachedAt: Date.now(),
      accessCount: 1
    });
    
    this.metrics.cachedImages = this.imageCache.size;
  }

  /**
   * Cleanup cache using LRU strategy
   */
  private cleanupCache(): void {
    const cacheEntries = Array.from(this.imageCache.entries());
    
    // Sort by access count and cache time (LRU)
    cacheEntries.sort(([, a], [, b]) => {
      const scoreA = a.accessCount / (Date.now() - a.cachedAt);
      const scoreB = b.accessCount / (Date.now() - b.cachedAt);
      return scoreA - scoreB;
    });
    
    // Remove least recently used items (bottom 25%)
    const itemsToRemove = Math.floor(cacheEntries.length * 0.25);
    for (let i = 0; i < itemsToRemove; i++) {
      this.imageCache.delete(cacheEntries[i][0]);
    }
    
    console.log(`Cleaned up ${itemsToRemove} images from cache`);
  }

  /**
   * Estimate cache size
   */
  private getCacheSize(): number {
    return Array.from(this.imageCache.values())
      .reduce((total, item) => total + this.estimateImageSize(item), 0);
  }

  /**
   * Estimate individual image size
   */
  private estimateImageSize(imageData: any): number {
    // Rough estimate based on dimensions
    const { width = 100, height = 100 } = imageData;
    return width * height * 4; // 4 bytes per pixel (RGBA)
  }

  /**
   * Calculate optimal width
   */
  private calculateOptimalWidth(requestedWidth?: number, screenWidth?: number, pixelRatio: number = 1): number | null {
    if (!requestedWidth && !screenWidth) return null;
    
    const targetWidth = requestedWidth || screenWidth || 0;
    const scaledWidth = Math.round(targetWidth * pixelRatio);
    
    return Math.min(scaledWidth, this.config.maxImageDimensions.width);
  }

  /**
   * Calculate optimal height
   */
  private calculateOptimalHeight(requestedHeight?: number, screenHeight?: number, pixelRatio: number = 1): number | null {
    if (!requestedHeight && !screenHeight) return null;
    
    const targetHeight = requestedHeight || screenHeight || 0;
    const scaledHeight = Math.round(targetHeight * pixelRatio);
    
    return Math.min(scaledHeight, this.config.maxImageDimensions.height);
  }

  /**
   * Calculate optimal quality based on priority and device capability
   */
  private calculateOptimalQuality(requestedQuality?: number, priority?: string): number {
    let baseQuality = requestedQuality || this.config.compressionQuality;
    
    // Adjust based on priority
    switch (priority) {
      case 'high':
        baseQuality = Math.max(baseQuality, 0.9);
        break;
      case 'low':
        baseQuality = Math.min(baseQuality, 0.6);
        break;
      default:
        // Keep base quality
        break;
    }
    
    // Clamp between 0.1 and 1.0
    return Math.max(0.1, Math.min(1.0, baseQuality));
  }

  /**
   * Generate cache key for image
   */
  private generateCacheKey(uri: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < uri.length; i++) {
      const char = uri.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    if (this.metrics.totalImages === 0) return 0;
    return (this.metrics.totalImages - this.metrics.networkRequests) / this.metrics.totalImages;
  }

  /**
   * Preload images for better performance
   */
  async preloadImages(uris: string[], priority: 'low' | 'normal' | 'high' = 'low'): Promise<void> {
    if (!this.config.networkOptimization.enablePrefetch) return;
    
    const endMeasure = performanceService.measureInteractionPerformance('image_preload');
    
    try {
      const preloadPromises = uris.map(uri => 
        this.loadOptimizedImage({ 
          uri, 
          priority,
          quality: priority === 'low' ? 0.6 : undefined
        }).catch(error => {
          console.warn(`Failed to preload image: ${uri}`, error);
          return null;
        })
      );
      
      await Promise.all(preloadPromises);
      endMeasure();
      
    } catch (error) {
      endMeasure();
      console.error('Preload batch failed:', error);
    }
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    this.metrics.cachedImages = 0;
    console.log('Image cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalImages: number;
    memoryUsage: number;
  } {
    return {
      size: this.imageCache.size,
      maxSize: Math.floor(this.config.maxCacheSize),
      hitRate: this.calculateCacheHitRate(),
      totalImages: this.metrics.totalImages,
      memoryUsage: this.getCacheSize() / (1024 * 1024) // MB
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): ImageMetrics {
    return {
      ...this.metrics,
      cacheHitRate: this.calculateCacheHitRate(),
      compressionRatio: this.config.compressionQuality
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ImageOptimizationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): ImageOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Initialize periodic cache cleanup
   */
  private initializeCacheCleanup(): void {
    setInterval(() => {
      const cacheUsage = this.getCacheSize() / (1024 * 1024); // MB
      const threshold = this.config.maxCacheSize * 0.8; // 80% threshold
      
      if (cacheUsage > threshold) {
        console.log(`Cache usage ${cacheUsage.toFixed(2)}MB exceeds threshold, cleaning up...`);
        this.cleanupCache();
      }
    }, 60000); // Check every minute
  }

  /**
   * Generate placeholder for progressive loading
   */
  generatePlaceholder(width: number, height: number, quality: number = 0.1): string {
    if (!this.config.placeholderConfig.enabled) {
      return '';
    }
    
    // Generate a low-quality placeholder URI
    const placeholderWidth = Math.max(10, Math.floor(width * quality));
    const placeholderHeight = Math.max(10, Math.floor(height * quality));
    
    // Return data URI for solid color placeholder
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${placeholderWidth}" height="${placeholderHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
      </svg>
    `)}`;
  }

  /**
   * Check if image is cached
   */
  isCached(uri: string): boolean {
    const cacheKey = this.generateCacheKey(this.optimizeImageUri({ uri }));
    return this.imageCache.has(cacheKey);
  }

  /**
   * Remove specific image from cache
   */
  removeFromCache(uri: string): boolean {
    const cacheKey = this.generateCacheKey(this.optimizeImageUri({ uri }));
    return this.imageCache.delete(cacheKey);
  }

  /**
   * Get cache entry for image
   */
  getCacheEntry(uri: string): any | null {
    const cacheKey = this.generateCacheKey(this.optimizeImageUri({ uri }));
    return this.imageCache.get(cacheKey) || null;
  }
}

export const imageOptimizationService = ImageOptimizationService.getInstance();
export default imageOptimizationService;