// Performance Optimization Hook for FieldSync Mobile
// Comprehensive performance monitoring and optimization

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { InteractionManager, Dimensions, PixelRatio } from 'react-native';

export interface PerformanceMetrics {
  renderTime: number;
  interactionTime: number;
  memoryUsage: number;
  bundleSize: number;
  frameDrop: number;
  navigationTime: number;
}

export interface OptimizationConfig {
  enableLazyLoading: boolean;
  enableMemoization: boolean;
  enableVirtualization: boolean;
  enableImageOptimization: boolean;
  enableAnimationOptimization: boolean;
  maxCacheSize: number;
  imageQuality: number;
}

export const usePerformanceOptimization = (config: Partial<OptimizationConfig> = {}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    interactionTime: 0,
    memoryUsage: 0,
    bundleSize: 0,
    frameDrop: 0,
    navigationTime: 0,
  });

  const [isOptimized, setIsOptimized] = useState(false);
  const renderStartTime = useRef<number>(0);
  const interactionStartTime = useRef<number>(0);
  const frameDropCounter = useRef<number>(0);

  const defaultConfig: OptimizationConfig = {
    enableLazyLoading: true,
    enableMemoization: true,
    enableVirtualization: true,
    enableImageOptimization: true,
    enableAnimationOptimization: true,
    maxCacheSize: 50,
    imageQuality: 0.8,
    ...config,
  };

  // Performance measurement utilities
  const measureRenderTime = useCallback(() => {
    renderStartTime.current = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - renderStartTime.current;
      
      setMetrics(prev => ({
        ...prev,
        renderTime: Math.round(renderTime * 100) / 100,
      }));
    };
  }, []);

  const measureInteractionTime = useCallback((interactionName: string) => {
    interactionStartTime.current = performance.now();
    
    return () => {
      const endTime = performance.now();
      const interactionTime = endTime - interactionStartTime.current;
      
      setMetrics(prev => ({
        ...prev,
        interactionTime: Math.round(interactionTime * 100) / 100,
      }));

      // Log slow interactions for debugging
      if (interactionTime > 100) {
        console.warn(`Slow interaction detected: ${interactionName} took ${interactionTime}ms`);
      }
    };
  }, []);

  // Memory monitoring
  const monitorMemoryUsage = useCallback(() => {
    if (__DEV__ && (global as any).performance?.memory) {
      const memory = (global as any).performance.memory;
      const usedMemory = memory.usedJSHeapSize / 1048576; // Convert to MB
      
      setMetrics(prev => ({
        ...prev,
        memoryUsage: Math.round(usedMemory * 100) / 100,
      }));

      // Warning for high memory usage
      if (usedMemory > 100) {
        console.warn(`High memory usage detected: ${usedMemory}MB`);
      }
    }
  }, []);

  // Frame drop detection
  const detectFrameDrops = useCallback(() => {
    let lastFrameTime = performance.now();
    
    const checkFrameRate = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastFrameTime;
      
      // Frame drop if delta time > 16.67ms (60fps threshold)
      if (deltaTime > 16.67) {
        frameDropCounter.current += 1;
        
        setMetrics(prev => ({
          ...prev,
          frameDrop: frameDropCounter.current,
        }));
      }
      
      lastFrameTime = currentTime;
      requestAnimationFrame(checkFrameRate);
    };
    
    requestAnimationFrame(checkFrameRate);
  }, []);

  // Device capability assessment
  const getDeviceCapabilities = useCallback(() => {
    const { width, height } = Dimensions.get('window');
    const pixelRatio = PixelRatio.get();
    const totalPixels = width * height * pixelRatio;
    
    return {
      screenSize: width * height,
      pixelDensity: pixelRatio,
      totalPixels,
      isHighEndDevice: totalPixels > 2000000, // Rough threshold
      isTablet: Math.min(width, height) > 600,
    };
  }, []);

  // Image optimization utility
  const optimizeImageUri = useCallback((uri: string, targetWidth?: number) => {
    if (!defaultConfig.enableImageOptimization) return uri;
    
    const capabilities = getDeviceCapabilities();
    const quality = capabilities.isHighEndDevice ? 
      defaultConfig.imageQuality : 
      Math.max(0.6, defaultConfig.imageQuality - 0.2);
    
    // Add image optimization parameters
    const separator = uri.includes('?') ? '&' : '?';
    let optimizedUri = `${uri}${separator}quality=${Math.round(quality * 100)}`;
    
    if (targetWidth) {
      const scaledWidth = Math.round(targetWidth * PixelRatio.get());
      optimizedUri += `&width=${scaledWidth}`;
    }
    
    return optimizedUri;
  }, [defaultConfig.enableImageOptimization, defaultConfig.imageQuality]);

  // Lazy component loader
  const createLazyComponent = useCallback(<T extends React.ComponentType<any>>(
    componentLoader: () => Promise<{ default: T }>,
    fallback?: React.ComponentType
  ) => {
    if (!defaultConfig.enableLazyLoading) {
      // Return immediate loader for development
      return React.lazy(componentLoader);
    }
    
    return React.lazy(() => {
      return new Promise<{ default: T }>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          componentLoader().then((module) => resolve(module));
        });
      });
    });
  }, [defaultConfig.enableLazyLoading]);

  // Debounced function utility for performance
  const createDebouncedCallback = useCallback(<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
  ) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    return useCallback((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay) as any;
    }, [callback, delay]) as T;
  }, []);

  // Throttled function utility
  const createThrottledCallback = useCallback(<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
  ) => {
    const lastCallTime = useRef<number>(0);
    
    return useCallback((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallTime.current >= delay) {
        lastCallTime.current = now;
        callback(...args);
      }
    }, [callback, delay]) as T;
  }, []);

  // Performance optimization recommendations
  const getOptimizationRecommendations = useCallback(() => {
    const recommendations: string[] = [];
    
    if (metrics.renderTime > 16) {
      recommendations.push('Consider using React.memo() for heavy components');
    }
    
    if (metrics.interactionTime > 100) {
      recommendations.push('Optimize touch handlers and reduce synchronous operations');
    }
    
    if (metrics.memoryUsage > 100) {
      recommendations.push('Implement proper cleanup in useEffect hooks');
    }
    
    if (metrics.frameDrop > 10) {
      recommendations.push('Reduce animation complexity or use native driver');
    }
    
    return recommendations;
  }, [metrics]);

  // Initialize performance monitoring
  useEffect(() => {
    if (__DEV__) {
      const cleanup = measureRenderTime();
      monitorMemoryUsage();
      detectFrameDrops();
      
      // Performance monitoring interval
      const interval = setInterval(() => {
        monitorMemoryUsage();
      }, 5000);
      
      setIsOptimized(true);
      
      return () => {
        cleanup();
        clearInterval(interval);
      };
    }
  }, [measureRenderTime, monitorMemoryUsage, detectFrameDrops]);

  return {
    metrics,
    isOptimized,
    config: defaultConfig,
    deviceCapabilities: getDeviceCapabilities(),
    measureRenderTime,
    measureInteractionTime,
    optimizeImageUri,
    createLazyComponent,
    createDebouncedCallback,
    createThrottledCallback,
    getOptimizationRecommendations,
  };
};

// HOC for performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) => {
  const PerformanceWrapper: React.FC<P> = (props) => {
    const { measureRenderTime, measureInteractionTime } = usePerformanceOptimization();
    
    useEffect(() => {
      const cleanup = measureRenderTime();
      return cleanup;
    }, [measureRenderTime]);
    
    return <WrappedComponent {...props} />;
  };
  
  PerformanceWrapper.displayName = `withPerformanceMonitoring(${componentName})`;
  
  return PerformanceWrapper;
};

export default usePerformanceOptimization;
