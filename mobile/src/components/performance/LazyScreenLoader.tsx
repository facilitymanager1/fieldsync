/**
 * Lazy Screen Loader Component
 * Optimized screen loading with performance monitoring and fallback handling
 */

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  InteractionManager,
  Dimensions,
} from 'react-native';
import { usePerformanceOptimization } from '../../hooks/usePerformanceOptimization';

interface LazyScreenLoaderProps {
  children: React.ReactNode;
  loadingText?: string;
  minLoadingTime?: number;
  enablePreloading?: boolean;
  screenName?: string;
}

interface LoadingFallbackProps {
  loadingText: string;
  isPreloading?: boolean;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({ 
  loadingText, 
  isPreloading = false 
}) => {
  const { width } = Dimensions.get('window');
  
  return (
    <View style={[styles.loadingContainer, { width }]}>
      <ActivityIndicator 
        size="large" 
        color="#007AFF" 
        style={styles.spinner}
      />
      <Text style={styles.loadingText}>{loadingText}</Text>
      {isPreloading && (
        <Text style={styles.preloadingText}>Optimizing for performance...</Text>
      )}
    </View>
  );
};

export const LazyScreenLoader: React.FC<LazyScreenLoaderProps> = ({
  children,
  loadingText = 'Loading...',
  minLoadingTime = 100,
  enablePreloading = true,
  screenName = 'Screen',
}) => {
  const { measureRenderTime, measureInteractionTime, deviceCapabilities } = 
    usePerformanceOptimization();
  
  const [isReady, setIsReady] = useState(false);
  const [loadingStartTime] = useState(Date.now());

  const handleScreenReady = useCallback(() => {
    const loadingDuration = Date.now() - loadingStartTime;
    
    // Ensure minimum loading time for smooth UX
    const remainingTime = Math.max(0, minLoadingTime - loadingDuration);
    
    setTimeout(() => {
      setIsReady(true);
      
      // Performance tracking
      if (__DEV__) {
        console.log(`${screenName} loaded in ${loadingDuration + remainingTime}ms`);
      }
    }, remainingTime);
  }, [loadingStartTime, minLoadingTime, screenName]);

  useEffect(() => {
    const cleanup = measureRenderTime();
    
    if (enablePreloading) {
      // Use InteractionManager for smooth loading
      InteractionManager.runAfterInteractions(() => {
        handleScreenReady();
      });
    } else {
      handleScreenReady();
    }

    return cleanup;
  }, [handleScreenReady, measureRenderTime, enablePreloading]);

  // Measure interaction time when screen becomes ready
  useEffect(() => {
    if (isReady) {
      const cleanup = measureInteractionTime(`${screenName}_Ready`);
      return cleanup;
    }
  }, [isReady, measureInteractionTime, screenName]);

  if (!isReady) {
    return (
      <LoadingFallback 
        loadingText={loadingText}
        isPreloading={enablePreloading && deviceCapabilities.isHighEndDevice}
      />
    );
  }

  return (
    <Suspense 
      fallback={
        <LoadingFallback 
          loadingText={loadingText}
          isPreloading={false}
        />
      }
    >
      <View style={styles.screenContainer}>
        {children}
      </View>
    </Suspense>
  );
};

// Higher-order component for lazy screen loading
export const withLazyScreenLoader = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Partial<LazyScreenLoaderProps> = {}
) => {
  const LazyScreen: React.FC<P> = (props) => {
    return (
      <LazyScreenLoader 
        screenName={WrappedComponent.displayName || WrappedComponent.name}
        {...options}
      >
        <WrappedComponent {...props} />
      </LazyScreenLoader>
    );
  };

  LazyScreen.displayName = `withLazyScreenLoader(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return LazyScreen;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  screenContainer: {
    flex: 1,
  },
  spinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '500',
  },
  preloadingText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default LazyScreenLoader;