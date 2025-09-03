// Advanced Gesture System for FieldSync Mobile
// Comprehensive gesture handling with haptic feedback and accessibility

import React, { useRef, useCallback, useState } from 'react';
import {
  PanGestureHandler,
  TapGestureHandler,
  LongPressGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  FlingGestureHandler,
  State,
  Directions,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Dimensions, Vibration, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface GestureConfig {
  enableHapticFeedback: boolean;
  enableSwipeGestures: boolean;
  enablePinchZoom: boolean;
  enableRotation: boolean;
  swipeThreshold: number;
  longPressDelay: number;
  doubleTapDelay: number;
  flingVelocityThreshold: number;
}

export interface GestureCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinchStart?: () => void;
  onPinchEnd?: (scale: number) => void;
  onRotationStart?: () => void;
  onRotationEnd?: (rotation: number) => void;
  onFling?: (direction: 'left' | 'right' | 'up' | 'down', velocity: number) => void;
}

export const useAdvancedGestures = (
  config: Partial<GestureConfig> = {},
  callbacks: GestureCallbacks = {}
) => {
  const defaultConfig: GestureConfig = {
    enableHapticFeedback: true,
    enableSwipeGestures: true,
    enablePinchZoom: true,
    enableRotation: true,
    swipeThreshold: 50,
    longPressDelay: 500,
    doubleTapDelay: 300,
    flingVelocityThreshold: 1000,
    ...config,
  };

  // Animated values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  // State management
  const [isInteracting, setIsInteracting] = useState(false);
  const lastTapTime = useRef(0);
  const tapCount = useRef(0);

  // Haptic feedback utility
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!defaultConfig.enableHapticFeedback) return;
    
    if (Platform.OS === 'ios') {
      const HapticFeedback = require('react-native-haptic-feedback').default;
      const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
      
      switch (type) {
        case 'light':
          HapticFeedback.trigger('impactLight', options);
          break;
        case 'medium':
          HapticFeedback.trigger('impactMedium', options);
          break;
        case 'heavy':
          HapticFeedback.trigger('impactHeavy', options);
          break;
      }
    } else {
      // Android vibration fallback
      const duration = type === 'light' ? 10 : type === 'medium' ? 20 : 50;
      Vibration.vibrate(duration);
    }
  }, [defaultConfig.enableHapticFeedback]);

  // Pan gesture handler
  const panGestureHandler = useCallback(() => {
    // Simplified pan gesture implementation
    console.log('Pan gesture');
  }, []);
    onStart: () => {
      runOnJS(setIsInteracting)(true);
      runOnJS(triggerHaptic)('light');
    },
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onEnd: (event) => {
      runOnJS(setIsInteracting)(false);
      
      // Check for swipe gestures
      if (defaultConfig.enableSwipeGestures) {
        const { translationX, translationY, velocityX, velocityY } = event;
        const threshold = defaultConfig.swipeThreshold;
        
        if (Math.abs(translationX) > threshold || Math.abs(translationY) > threshold) {
          if (Math.abs(translationX) > Math.abs(translationY)) {
            // Horizontal swipe
            if (translationX > 0) {
              runOnJS(callbacks.onSwipeRight || (() => {}))();
              runOnJS(triggerHaptic)('medium');
            } else {
              runOnJS(callbacks.onSwipeLeft || (() => {}))();
              runOnJS(triggerHaptic)('medium');
            }
          } else {
            // Vertical swipe
            if (translationY > 0) {
              runOnJS(callbacks.onSwipeDown || (() => {}))();
              runOnJS(triggerHaptic)('medium');
            } else {
              runOnJS(callbacks.onSwipeUp || (() => {}))();
              runOnJS(triggerHaptic)('medium');
            }
          }
        }
      }
      
      // Reset position with spring animation
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    },
  });

  // Tap gesture handler with double tap detection
  const tapGestureHandler = useAnimatedGestureHandler({
    onEnd: () => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTapTime.current;
      
      if (timeDiff < defaultConfig.doubleTapDelay) {
        tapCount.current += 1;
        
        if (tapCount.current === 2) {
          // Double tap detected
          runOnJS(callbacks.onDoubleTap || (() => {}))();
          runOnJS(triggerHaptic)('heavy');
          tapCount.current = 0;
        }
      } else {
        tapCount.current = 1;
        
        // Single tap with delay to check for double tap
        setTimeout(() => {
          if (tapCount.current === 1) {
            runOnJS(callbacks.onTap || (() => {}))();
            runOnJS(triggerHaptic)('light');
          }
          tapCount.current = 0;
        }, defaultConfig.doubleTapDelay);
      }
      
      lastTapTime.current = currentTime;
    },
  });

  // Long press gesture handler
  const longPressGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      opacity.value = withTiming(0.7, { duration: 150 });
    },
    onEnd: (event) => {
      opacity.value = withTiming(1, { duration: 150 });
      
      if (event.state === State.ACTIVE) {
        runOnJS(callbacks.onLongPress || (() => {}))();
        runOnJS(triggerHaptic)('heavy');
      }
    },
  });

  // Pinch gesture handler
  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      runOnJS(callbacks.onPinchStart || (() => {}))();
      runOnJS(triggerHaptic)('light');
    },
    onActive: (event) => {
      if (defaultConfig.enablePinchZoom) {
        scale.value = Math.max(0.5, Math.min(3, event.scale));
      }
    },
    onEnd: () => {
      const finalScale = scale.value;
      runOnJS(callbacks.onPinchEnd || (() => {}))(finalScale);
      
      // Reset to normal scale if too small or too large
      if (finalScale < 0.8 || finalScale > 2.5) {
        scale.value = withSpring(1);
      }
    },
  });

  // Rotation gesture handler
  const rotationGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      runOnJS(callbacks.onRotationStart || (() => {}))();
      runOnJS(triggerHaptic)('light');
    },
    onActive: (event) => {
      if (defaultConfig.enableRotation) {
        rotation.value = event.rotation;
      }
    },
    onEnd: () => {
      const finalRotation = rotation.value;
      runOnJS(callbacks.onRotationEnd || (() => {}))(finalRotation);
      
      // Snap to nearest 90 degrees if close enough
      const snapThreshold = 0.2; // radians
      const quarterTurn = Math.PI / 2;
      const nearestQuarter = Math.round(finalRotation / quarterTurn) * quarterTurn;
      
      if (Math.abs(finalRotation - nearestQuarter) < snapThreshold) {
        rotation.value = withSpring(nearestQuarter);
        runOnJS(triggerHaptic)('medium');
      }
    },
  });

  // Fling gesture handler
  const flingGestureHandler = useAnimatedGestureHandler({
    onEnd: (event) => {
      const { velocityX, velocityY } = event;
      const threshold = defaultConfig.flingVelocityThreshold;
      
      if (Math.abs(velocityX) > threshold || Math.abs(velocityY) > threshold) {
        let direction: 'left' | 'right' | 'up' | 'down';
        let velocity: number;
        
        if (Math.abs(velocityX) > Math.abs(velocityY)) {
          direction = velocityX > 0 ? 'right' : 'left';
          velocity = Math.abs(velocityX);
        } else {
          direction = velocityY > 0 ? 'down' : 'up';
          velocity = Math.abs(velocityY);
        }
        
        runOnJS(callbacks.onFling || (() => {}))(direction, velocity);
        runOnJS(triggerHaptic)('heavy');
      }
    },
  });

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}rad` },
      ],
      opacity: opacity.value,
    };
  });

  // Gesture reset function
  const resetGestures = useCallback(() => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    scale.value = withSpring(1);
    rotation.value = withSpring(0);
    opacity.value = withTiming(1);
  }, [translateX, translateY, scale, rotation, opacity]);

  // Gesture state values for external use
  const gestureValues = {
    translateX,
    translateY,
    scale,
    rotation,
    opacity,
    isInteracting,
  };

  return {
    // Gesture handlers
    panGestureHandler,
    tapGestureHandler,
    longPressGestureHandler,
    pinchGestureHandler,
    rotationGestureHandler,
    flingGestureHandler,
    
    // Animated style
    animatedStyle,
    
    // Utilities
    resetGestures,
    triggerHaptic,
    
    // State
    gestureValues,
    config: defaultConfig,
  };
};

// Pre-built gesture component wrapper
export interface GestureWrapperProps {
  children: React.ReactNode;
  config?: Partial<GestureConfig>;
  callbacks?: GestureCallbacks;
  style?: any;
  enabledGestures?: ('pan' | 'tap' | 'longPress' | 'pinch' | 'rotation' | 'fling')[];
}

export const GestureWrapper: React.FC<GestureWrapperProps> = ({
  children,
  config,
  callbacks,
  style,
  enabledGestures = ['pan', 'tap', 'longPress'],
}) => {
  const {
    panGestureHandler,
    tapGestureHandler,
    longPressGestureHandler,
    pinchGestureHandler,
    rotationGestureHandler,
    flingGestureHandler,
    animatedStyle,
  } = useAdvancedGestures(config, callbacks);

  let gestureComponent = (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );

  // Wrap with enabled gestures
  if (enabledGestures.includes('fling')) {
    gestureComponent = (
      <FlingGestureHandler
        onGestureEvent={flingGestureHandler}
        direction={Directions.DOWN | Directions.UP | Directions.LEFT | Directions.RIGHT}
      >
        {gestureComponent}
      </FlingGestureHandler>
    );
  }

  if (enabledGestures.includes('rotation')) {
    gestureComponent = (
      <RotationGestureHandler onGestureEvent={rotationGestureHandler}>
        {gestureComponent}
      </RotationGestureHandler>
    );
  }

  if (enabledGestures.includes('pinch')) {
    gestureComponent = (
      <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
        {gestureComponent}
      </PinchGestureHandler>
    );
  }

  if (enabledGestures.includes('longPress')) {
    gestureComponent = (
      <LongPressGestureHandler
        onGestureEvent={longPressGestureHandler}
        minDurationMs={config?.longPressDelay || 500}
      >
        {gestureComponent}
      </LongPressGestureHandler>
    );
  }

  if (enabledGestures.includes('tap')) {
    gestureComponent = (
      <TapGestureHandler onGestureEvent={tapGestureHandler}>
        {gestureComponent}
      </TapGestureHandler>
    );
  }

  if (enabledGestures.includes('pan')) {
    gestureComponent = (
      <PanGestureHandler onGestureEvent={panGestureHandler}>
        {gestureComponent}
      </PanGestureHandler>
    );
  }

  return gestureComponent;
};

export default useAdvancedGestures;
