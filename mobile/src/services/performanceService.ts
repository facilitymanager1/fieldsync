/**
 * Advanced Performance Monitoring and Optimization Service
 * Provides comprehensive mobile app performance tracking and optimization
 */

import { InteractionManager, Dimensions, PixelRatio, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MobilePerformanceMetrics {
  // Rendering metrics
  renderingMetrics: {
    averageRenderTime: number;
    slowRenderCount: number;
    frameDrop: number;
    frameRate: number;
  };
  
  // Memory metrics
  memoryMetrics: {
    currentUsage: number;
    peakUsage: number;
    averageUsage: number;
    gcCount: number;
  };
  
  // Network metrics
  networkMetrics: {
    requestCount: number;
    averageLatency: number;
    failureRate: number;
    cacheHitRate: number;
  };
  
  // User interaction metrics
  interactionMetrics: {
    averageResponseTime: number;
    slowInteractionCount: number;
    touchStartToResponse: number;
    navigationTransitionTime: number;
  };
  
  // App lifecycle metrics
  lifecycleMetrics: {
    coldStartTime: number;
    warmStartTime: number;
    backgroundTime: number;
    crashCount: number;
  };
  
  // Bundle metrics
  bundleMetrics: {
    bundleSize: number;
    assetSize: number;
    cacheSize: number;
    unusedAssets: string[];
  };
}

export interface DeviceCapabilities {
  performance: 'low' | 'medium' | 'high';
  ram: number; // Estimated in MB
  cores: number; // Estimated CPU cores
  screenDensity: 'ldpi' | 'mdpi' | 'hdpi' | 'xhdpi' | 'xxhdpi' | 'xxxhdpi';
  screenSize: 'small' | 'medium' | 'large' | 'xlarge';
  isTablet: boolean;
  osVersion: string;
  batteryOptimizationEnabled: boolean;
}

export interface OptimizationStrategy {
  imageCompression: {
    enabled: boolean;
    quality: number;
    maxWidth: number;
    maxHeight: number;
  };
  
  lazyLoading: {
    enabled: boolean;
    preloadDistance: number;
    placeholderDelay: number;
  };
  
  caching: {
    enabled: boolean;
    maxSize: number; // MB
    ttl: number; // seconds
    compressionEnabled: boolean;
  };
  
  animations: {
    enabled: boolean;
    useNativeDriver: boolean;
    reduceMotion: boolean;
    maxConcurrent: number;
  };
  
  networking: {
    requestBatching: boolean;
    maxRetries: number;
    timeoutMs: number;
    compressionEnabled: boolean;
  };
}

class PerformanceService {
  private metrics: MobilePerformanceMetrics;
  private startTime: number;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private frameRateHistory: number[] = [];
  private memoryHistory: number[] = [];
  private renderTimes: number[] = [];
  private interactionTimes: Map<string, number> = new Map();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private optimizationStrategy: OptimizationStrategy;
  private performanceObserver: any = null;

  constructor() {
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.optimizationStrategy = this.getDefaultOptimizationStrategy();
    this.initializePerformanceMonitoring();
  }

  private initializeMetrics(): MobilePerformanceMetrics {
    return {
      renderingMetrics: {
        averageRenderTime: 0,
        slowRenderCount: 0,
        frameDrop: 0,
        frameRate: 60
      },
      memoryMetrics: {
        currentUsage: 0,
        peakUsage: 0,
        averageUsage: 0,
        gcCount: 0
      },
      networkMetrics: {
        requestCount: 0,
        averageLatency: 0,
        failureRate: 0,
        cacheHitRate: 0
      },
      interactionMetrics: {
        averageResponseTime: 0,
        slowInteractionCount: 0,
        touchStartToResponse: 0,
        navigationTransitionTime: 0
      },
      lifecycleMetrics: {
        coldStartTime: 0,
        warmStartTime: 0,
        backgroundTime: 0,
        crashCount: 0
      },
      bundleMetrics: {
        bundleSize: 0,
        assetSize: 0,
        cacheSize: 0,
        unusedAssets: []
      }
    };
  }

  private getDefaultOptimizationStrategy(): OptimizationStrategy {
    return {
      imageCompression: {
        enabled: true,
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024
      },
      lazyLoading: {
        enabled: true,
        preloadDistance: 500,
        placeholderDelay: 300
      },
      caching: {
        enabled: true,
        maxSize: 100, // 100MB
        ttl: 3600, // 1 hour
        compressionEnabled: true
      },
      animations: {
        enabled: true,
        useNativeDriver: true,
        reduceMotion: false,
        maxConcurrent: 3
      },
      networking: {
        requestBatching: true,
        maxRetries: 3,
        timeoutMs: 10000,
        compressionEnabled: true
      }
    };
  }

  /**
   * Initialize comprehensive performance monitoring
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    // Device capability assessment
    this.deviceCapabilities = await this.assessDeviceCapabilities();
    
    // Adapt strategy based on device capabilities
    this.adaptOptimizationStrategy();
    
    // Start performance monitoring
    this.startFrameRateMonitoring();
    this.startMemoryMonitoring();
    this.initializeNavigationMonitoring();
    
    // Load historical performance data
    await this.loadPerformanceHistory();
  }

  /**
   * Assess device capabilities for optimization
   */
  private async assessDeviceCapabilities(): Promise<DeviceCapabilities> {
    const { width, height } = Dimensions.get('window');
    const pixelRatio = PixelRatio.get();
    const screenSize = width * height;
    const totalPixels = screenSize * pixelRatio;
    
    // Performance classification based on screen resolution and device characteristics
    let performance: 'low' | 'medium' | 'high' = 'medium';
    let ram = 2048; // Default estimate
    let cores = 4; // Default estimate
    
    // Rough device capability estimation
    if (totalPixels > 4000000) {
      performance = 'high';
      ram = 6144;
      cores = 8;
    } else if (totalPixels > 2000000) {
      performance = 'medium';
      ram = 4096;
      cores = 6;
    } else {
      performance = 'low';
      ram = 2048;
      cores = 4;
    }
    
    // Screen density classification
    let screenDensity: DeviceCapabilities['screenDensity'] = 'mdpi';
    if (pixelRatio >= 4) screenDensity = 'xxxhdpi';
    else if (pixelRatio >= 3) screenDensity = 'xxhdpi';
    else if (pixelRatio >= 2) screenDensity = 'xhdpi';
    else if (pixelRatio >= 1.5) screenDensity = 'hdpi';
    else if (pixelRatio >= 1) screenDensity = 'mdpi';
    else screenDensity = 'ldpi';
    
    // Screen size classification
    let screenSizeCategory: DeviceCapabilities['screenSize'] = 'medium';
    const smallestDimension = Math.min(width, height);
    if (smallestDimension >= 900) screenSizeCategory = 'xlarge';
    else if (smallestDimension >= 600) screenSizeCategory = 'large';
    else if (smallestDimension >= 480) screenSizeCategory = 'medium';
    else screenSizeCategory = 'small';

    return {
      performance,
      ram,
      cores,
      screenDensity,
      screenSize: screenSizeCategory,
      isTablet: smallestDimension >= 600,
      osVersion: Platform.Version.toString(),
      batteryOptimizationEnabled: false // Would need native module to detect
    };
  }

  /**
   * Adapt optimization strategy based on device capabilities
   */
  private adaptOptimizationStrategy(): void {
    if (!this.deviceCapabilities) return;

    const { performance, isTablet } = this.deviceCapabilities;
    
    switch (performance) {
      case 'low':
        // Aggressive optimization for low-end devices
        this.optimizationStrategy.imageCompression.quality = 0.6;
        this.optimizationStrategy.imageCompression.maxWidth = 800;
        this.optimizationStrategy.imageCompression.maxHeight = 800;
        this.optimizationStrategy.animations.maxConcurrent = 1;
        this.optimizationStrategy.lazyLoading.preloadDistance = 300;
        this.optimizationStrategy.caching.maxSize = 50;
        break;
        
      case 'medium':
        // Balanced optimization
        this.optimizationStrategy.imageCompression.quality = 0.75;
        this.optimizationStrategy.imageCompression.maxWidth = 1024;
        this.optimizationStrategy.animations.maxConcurrent = 2;
        this.optimizationStrategy.caching.maxSize = 75;
        break;
        
      case 'high':
        // Light optimization for high-end devices
        this.optimizationStrategy.imageCompression.quality = 0.9;
        this.optimizationStrategy.imageCompression.maxWidth = isTablet ? 2048 : 1440;
        this.optimizationStrategy.animations.maxConcurrent = 4;
        this.optimizationStrategy.caching.maxSize = 150;
        break;
    }
  }

  /**
   * Start frame rate monitoring
   */
  private startFrameRateMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFrameRate = () => {
      const currentTime = performance.now();
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        const fps = frameCount;
        this.frameRateHistory.push(fps);
        
        if (this.frameRateHistory.length > 60) {
          this.frameRateHistory.shift();
        }
        
        this.metrics.renderingMetrics.frameRate = fps;
        
        if (fps < 45) {
          this.metrics.renderingMetrics.frameDrop++;
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFrameRate);
    };
    
    requestAnimationFrame(measureFrameRate);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    const monitorMemory = () => {
      if ((global as any).performance?.memory) {
        const memInfo = (global as any).performance.memory;
        const currentUsage = memInfo.usedJSHeapSize / 1048576; // MB
        
        this.memoryHistory.push(currentUsage);
        if (this.memoryHistory.length > 100) {
          this.memoryHistory.shift();
        }
        
        this.metrics.memoryMetrics.currentUsage = currentUsage;
        this.metrics.memoryMetrics.peakUsage = Math.max(
          this.metrics.memoryMetrics.peakUsage,
          currentUsage
        );
        this.metrics.memoryMetrics.averageUsage = 
          this.memoryHistory.reduce((sum, val) => sum + val, 0) / this.memoryHistory.length;
        
        // Trigger memory warning if usage is high
        if (currentUsage > this.deviceCapabilities!.ram * 0.8) {
          this.handleMemoryWarning();
        }
      }
    };
    
    setInterval(monitorMemory, 5000); // Check every 5 seconds
  }

  /**
   * Initialize navigation performance monitoring
   */
  private initializeNavigationMonitoring(): void {
    // This would typically integrate with React Navigation
    // For now, we provide the measurement utilities
  }

  /**
   * Handle memory warning by clearing caches
   */
  private handleMemoryWarning(): void {
    console.warn('High memory usage detected, clearing caches');
    
    // Clear image cache
    this.clearImageCache();
    
    // Clear data cache
    this.clearDataCache();
    
    // Suggest garbage collection
    if (__DEV__ && (global as any).gc) {
      (global as any).gc();
      this.metrics.memoryMetrics.gcCount++;
    }
  }

  /**
   * Measure render performance
   */
  measureRenderPerformance(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      this.renderTimes.push(renderTime);
      if (this.renderTimes.length > 100) {
        this.renderTimes.shift();
      }
      
      this.metrics.renderingMetrics.averageRenderTime = 
        this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
      
      if (renderTime > 16) { // Slower than 60fps
        this.metrics.renderingMetrics.slowRenderCount++;
        console.warn(`Slow render detected for ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  }

  /**
   * Measure interaction performance
   */
  measureInteractionPerformance(interactionName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const interactionTime = endTime - startTime;
      
      this.interactionTimes.set(interactionName, interactionTime);
      
      const avgInteractionTime = Array.from(this.interactionTimes.values())
        .reduce((sum, time) => sum + time, 0) / this.interactionTimes.size;
      
      this.metrics.interactionMetrics.averageResponseTime = avgInteractionTime;
      
      if (interactionTime > 100) {
        this.metrics.interactionMetrics.slowInteractionCount++;
        console.warn(`Slow interaction: ${interactionName} took ${interactionTime.toFixed(2)}ms`);
      }
    };
  }

  /**
   * Optimize image for current device
   */
  optimizeImageForDevice(imageUri: string, targetWidth?: number, targetHeight?: number): string {
    if (!this.optimizationStrategy.imageCompression.enabled) {
      return imageUri;
    }
    
    const { quality, maxWidth, maxHeight } = this.optimizationStrategy.imageCompression;
    const pixelRatio = PixelRatio.get();
    
    // Calculate optimal dimensions
    const optimalWidth = targetWidth ? 
      Math.min(targetWidth * pixelRatio, maxWidth) : 
      maxWidth;
    const optimalHeight = targetHeight ? 
      Math.min(targetHeight * pixelRatio, maxHeight) : 
      maxHeight;
    
    // Add optimization parameters to image URL
    const separator = imageUri.includes('?') ? '&' : '?';
    return `${imageUri}${separator}w=${optimalWidth}&h=${optimalHeight}&q=${Math.round(quality * 100)}`;
  }

  /**
   * Create optimized lazy loading component
   */
  createOptimizedLazyComponent<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: {
      preload?: boolean;
      placeholder?: React.ComponentType;
      errorBoundary?: React.ComponentType<{ error: Error }>;
    } = {}
  ) {
    const { preload = false, placeholder, errorBoundary } = options;
    
    return React.lazy(() => {
      if (preload) {
        // Preload component after interactions are done
        InteractionManager.runAfterInteractions(() => {
          importFn();
        });
      }
      
      return new Promise<{ default: T }>((resolve, reject) => {
        InteractionManager.runAfterInteractions(() => {
          importFn()
            .then(resolve)
            .catch(reject);
        });
      });
    });
  }

  /**
   * Batch network requests for better performance
   */
  batchNetworkRequests<T>(requests: (() => Promise<T>)[]): Promise<T[]> {
    if (!this.optimizationStrategy.networking.requestBatching) {
      return Promise.all(requests.map(req => req()));
    }
    
    // Simple batching - execute in chunks
    const chunkSize = 3;
    const chunks: (() => Promise<T>)[][] = [];
    
    for (let i = 0; i < requests.length; i += chunkSize) {
      chunks.push(requests.slice(i, i + chunkSize));
    }
    
    return chunks.reduce(
      (promise, chunk) => promise.then(results => 
        Promise.all(chunk.map(req => req())).then(chunkResults => [...results, ...chunkResults])
      ),
      Promise.resolve([] as T[])
    );
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics;
    
    // Render performance recommendations
    if (metrics.renderingMetrics.averageRenderTime > 16) {
      recommendations.push('Consider using React.memo() or useMemo() for expensive components');
    }
    
    if (metrics.renderingMetrics.frameRate < 50) {
      recommendations.push('Frame rate is low - optimize animations and reduce UI complexity');
    }
    
    // Memory recommendations
    if (metrics.memoryMetrics.currentUsage > 100) {
      recommendations.push('Memory usage is high - implement proper cleanup in useEffect');
    }
    
    // Interaction recommendations  
    if (metrics.interactionMetrics.averageResponseTime > 100) {
      recommendations.push('User interactions are slow - optimize touch handlers');
    }
    
    // Network recommendations
    if (metrics.networkMetrics.failureRate > 0.05) {
      recommendations.push('Network failure rate is high - implement better retry logic');
    }
    
    if (metrics.networkMetrics.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate - review caching strategy');
    }
    
    return recommendations;
  }

  /**
   * Export performance data
   */
  exportPerformanceData(): {
    metrics: MobilePerformanceMetrics;
    deviceInfo: DeviceCapabilities;
    recommendations: string[];
    timestamp: number;
  } {
    return {
      metrics: { ...this.metrics },
      deviceInfo: { ...this.deviceCapabilities! },
      recommendations: this.getPerformanceRecommendations(),
      timestamp: Date.now()
    };
  }

  /**
   * Clear image cache
   */
  private clearImageCache(): void {
    // Implementation would depend on image caching library used
    console.log('Clearing image cache to free memory');
  }

  /**
   * Clear data cache
   */
  private clearDataCache(): void {
    // Clear AsyncStorage cache if needed
    AsyncStorage.getAllKeys().then(keys => {
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      AsyncStorage.multiRemove(cacheKeys);
    });
  }

  /**
   * Load performance history from storage
   */
  private async loadPerformanceHistory(): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem('performance_history');
      if (historyData) {
        const history = JSON.parse(historyData);
        // Use historical data to improve optimization
        this.analyzeHistoricalPerformance(history);
      }
    } catch (error) {
      console.warn('Failed to load performance history:', error);
    }
  }

  /**
   * Save performance history
   */
  async savePerformanceHistory(): Promise<void> {
    try {
      const performanceData = this.exportPerformanceData();
      await AsyncStorage.setItem('performance_history', JSON.stringify(performanceData));
    } catch (error) {
      console.warn('Failed to save performance history:', error);
    }
  }

  /**
   * Analyze historical performance data
   */
  private analyzeHistoricalPerformance(history: any): void {
    // Implement analysis logic to improve optimization strategies
    console.log('Analyzing historical performance data for optimization');
  }

  /**
   * Get current metrics
   */
  getMetrics(): MobilePerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities ? { ...this.deviceCapabilities } : null;
  }

  /**
   * Get optimization strategy
   */
  getOptimizationStrategy(): OptimizationStrategy {
    return { ...this.optimizationStrategy };
  }

  /**
   * Update optimization strategy
   */
  updateOptimizationStrategy(updates: Partial<OptimizationStrategy>): void {
    this.optimizationStrategy = { ...this.optimizationStrategy, ...updates };
  }
}

// Export singleton instance
export const performanceService = new PerformanceService();

export default performanceService;