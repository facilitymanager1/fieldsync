/**
 * Face Capture Screen - Biometric Face Recognition Setup
 * 
 * Features:
 * - Real-time camera preview
 * - Face detection guidance
 * - Multiple capture attempts (up to 3)
 * - Quality validation
 * - Offline storage capability
 * - Multi-language support
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { login: { username: 'testuser' } },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    face_capture_title: 'Face Recognition Setup',
    face_capture_subtitle: 'Position your face within the frame for biometric setup',
    face_capture_instructions: 'Please look directly at the camera and keep your face within the oval frame',
    capturing: 'Capturing...',
    retake: 'Retake',
    continue: 'Continue',
    skip: 'Skip for Now',
    face_detected: 'Face detected - Hold still',
    face_not_detected: 'No face detected',
    face_too_close: 'Move camera away',
    face_too_far: 'Move camera closer',
    face_not_centered: 'Center your face',
    capture_success: 'Face captured successfully!',
    capture_failed: 'Capture failed. Please try again.',
    quality_check: 'Checking image quality...',
    quality_good: 'Good quality image',
    quality_poor: 'Poor quality - please retake',
    attempts_remaining: 'Attempts remaining',
    max_attempts_reached: 'Maximum attempts reached',
    permission_required: 'Camera permission required',
    permission_denied: 'Camera access denied',
    enable_camera: 'Enable Camera',
    face_capture_tips: 'Tips for better capture:',
    tip_lighting: '• Use good lighting',
    tip_position: '• Keep face centered',
    tip_stable: '• Hold device steady',
    tip_glasses: '• Remove glasses if possible',
  };
  return texts[key] || key;
};

interface FaceCaptureData {
  imageBase64: string;
  timestamp: string;
  quality: number;
  attempts: number;
  deviceInfo: {
    platform: string;
    width: number;
    height: number;
  };
}

export default function FaceCaptureScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureAttempts, setCaptureAttempts] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [facePosition, setFacePosition] = useState<'centered' | 'too_close' | 'too_far' | 'not_centered'>('not_centered');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageQuality, setImageQuality] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTips, setShowTips] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { width, height } = Dimensions.get('window');
  
  const MAX_ATTEMPTS = 3;
  const MIN_QUALITY_SCORE = 0.7;

  useEffect(() => {
    // Start pulse animation for face detection frame
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    if (faceDetected) {
      startPulse();
    } else {
      pulseAnim.setValue(1);
    }
  }, [faceDetected, pulseAnim]);

  useEffect(() => {
    initializeCamera();
  }, []);

  const initializeCamera = async () => {
    try {
      // Simulate camera initialization
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsCameraReady(true);
      
      // Start face detection simulation
      startFaceDetectionSimulation();
    } catch (error) {
      console.error('Camera initialization failed:', error);
      Alert.alert(
        getLocalizedText('permission_required', language),
        getLocalizedText('permission_denied', language),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: getLocalizedText('enable_camera', language), onPress: initializeCamera },
        ]
      );
    }
  };

  const startFaceDetectionSimulation = () => {
    // Simulate face detection with random states
    const interval = setInterval(() => {
      const states = ['centered', 'too_close', 'too_far', 'not_centered'] as const;
      const randomState = states[Math.floor(Math.random() * states.length)];
      const detected = Math.random() > 0.3; // 70% chance of face detection
      
      setFaceDetected(detected);
      setFacePosition(randomState);
    }, 2000);

    return () => clearInterval(interval);
  };

  const handleCapture = async () => {
    if (!faceDetected || facePosition !== 'centered') {
      Alert.alert(
        getLocalizedText('face_not_detected', language),
        getLocalizedText('face_capture_instructions', language)
      );
      return;
    }

    setIsCapturing(true);
    setIsProcessing(true);

    try {
      // Simulate image capture
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock base64 image data
      const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
      
      const newAttempts = captureAttempts + 1;
      setCaptureAttempts(newAttempts);
      
      // Simulate quality analysis
      const quality = Math.random() * 0.5 + 0.5; // Random quality between 0.5-1.0
      setImageQuality(quality);
      
      if (quality >= MIN_QUALITY_SCORE) {
        setCapturedImage(mockImageBase64);
        Alert.alert(
          getLocalizedText('capture_success', language),
          getLocalizedText('quality_good', language)
        );
      } else {
        Alert.alert(
          getLocalizedText('quality_poor', language),
          `${getLocalizedText('attempts_remaining', language)}: ${MAX_ATTEMPTS - newAttempts}`
        );
        
        if (newAttempts >= MAX_ATTEMPTS) {
          Alert.alert(
            getLocalizedText('max_attempts_reached', language),
            'You can skip this step and set up face recognition later.',
            [
              { text: getLocalizedText('skip', language), onPress: handleSkip },
              { text: getLocalizedText('retake', language), onPress: handleRetake },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Face capture error:', error);
      Alert.alert(
        getLocalizedText('capture_failed', language),
        'Please try again'
      );
    } finally {
      setIsCapturing(false);
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setImageQuality(0);
    setCaptureAttempts(0);
  };

  const handleSkip = async () => {
    Alert.alert(
      'Skip Face Setup?',
      'You can set up face recognition later in settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => {
            goToNextStep({ 
              faceCapture: { 
                skipped: true, 
                timestamp: new Date().toISOString() 
              } 
            });
          }
        },
      ]
    );
  };

  const handleContinue = async () => {
    if (!capturedImage) return;

    const faceCaptureData: FaceCaptureData = {
      imageBase64: capturedImage,
      timestamp: new Date().toISOString(),
      quality: imageQuality,
      attempts: captureAttempts,
      deviceInfo: {
        platform: Platform.OS,
        width,
        height,
      },
    };

    try {
      // Save to local storage for offline capability
      await AsyncStorage.setItem(
        `face_capture_${userData?.login?.username}`,
        JSON.stringify(faceCaptureData)
      );

      goToNextStep({ faceCapture: faceCaptureData });
    } catch (error) {
      console.error('Failed to save face capture data:', error);
      Alert.alert('Error', 'Failed to save face data. Please try again.');
    }
  };

  const getFaceStatusText = () => {
    if (!faceDetected) {
      return getLocalizedText('face_not_detected', language);
    }
    
    switch (facePosition) {
      case 'centered':
        return getLocalizedText('face_detected', language);
      case 'too_close':
        return getLocalizedText('face_too_close', language);
      case 'too_far':
        return getLocalizedText('face_too_far', language);
      case 'not_centered':
        return getLocalizedText('face_not_centered', language);
      default:
        return getLocalizedText('face_not_detected', language);
    }
  };

  const getFaceStatusColor = () => {
    if (!faceDetected) return '#F44336';
    return facePosition === 'centered' ? '#4CAF50' : '#FF9800';
  };

  const renderTips = () => (
    <View style={styles.tipsContainer}>
      <Text style={styles.tipsTitle}>
        {getLocalizedText('face_capture_tips', language)}
      </Text>
      <Text style={styles.tipText}>
        {getLocalizedText('tip_lighting', language)}
      </Text>
      <Text style={styles.tipText}>
        {getLocalizedText('tip_position', language)}
      </Text>
      <Text style={styles.tipText}>
        {getLocalizedText('tip_stable', language)}
      </Text>
      <Text style={styles.tipText}>
        {getLocalizedText('tip_glasses', language)}
      </Text>
    </View>
  );

  const renderCameraPreview = () => (
    <View style={styles.cameraContainer}>
      {!isCameraReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      ) : (
        <View style={styles.cameraPreview}>
          {/* Simulated camera preview */}
          <View style={styles.mockCameraView}>
            <Text style={styles.mockCameraText}>📹 Camera Preview</Text>
          </View>
          
          {/* Face detection overlay */}
          <Animated.View 
            style={[
              styles.faceDetectionFrame,
              { 
                transform: [{ scale: pulseAnim }],
                borderColor: getFaceStatusColor(),
              }
            ]}
          />
          
          {/* Face status indicator */}
          <View style={[styles.statusIndicator, { backgroundColor: getFaceStatusColor() }]}>
            <Text style={styles.statusText}>
              {getFaceStatusText()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderCapturedImage = () => (
    <View style={styles.capturedImageContainer}>
      <View style={styles.imagePreview}>
        <Text style={styles.imagePreviewText}>✅ Face Captured</Text>
        <Text style={styles.qualityText}>
          Quality: {Math.round(imageQuality * 100)}%
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('face_capture_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('face_capture_subtitle', language)}
        </Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {!capturedImage ? renderCameraPreview() : renderCapturedImage()}
        
        {/* Instructions */}
        <Text style={styles.instructions}>
          {getLocalizedText('face_capture_instructions', language)}
        </Text>

        {/* Tips Toggle */}
        <TouchableOpacity
          style={styles.tipsToggle}
          onPress={() => setShowTips(!showTips)}
        >
          <Text style={styles.tipsToggleText}>
            {showTips ? 'Hide Tips' : 'Show Tips'} {showTips ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showTips && renderTips()}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!capturedImage ? (
          <View style={styles.captureActions}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                (!faceDetected || facePosition !== 'centered' || isCapturing) && styles.buttonDisabled
              ]}
              onPress={handleCapture}
              disabled={!faceDetected || facePosition !== 'centered' || isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.captureButtonText}>
                  📸 {isProcessing ? getLocalizedText('quality_check', language) : 'Capture'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>
                  {getLocalizedText('skip', language)}
                </Text>
              </TouchableOpacity>
              
              {captureAttempts > 0 && (
                <Text style={styles.attemptsText}>
                  {getLocalizedText('attempts_remaining', language)}: {MAX_ATTEMPTS - captureAttempts}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.reviewActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeButtonText}>
                {getLocalizedText('retake', language)}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>
                {getLocalizedText('continue', language)}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  cameraPreview: {
    flex: 1,
    position: 'relative',
  },
  mockCameraView: {
    flex: 1,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockCameraText: {
    color: '#fff',
    fontSize: 18,
  },
  faceDetectionFrame: {
    position: 'absolute',
    top: '25%',
    left: '20%',
    width: width * 0.6,
    height: width * 0.75,
    borderWidth: 3,
    borderRadius: width * 0.3,
    borderStyle: 'dashed',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  capturedImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  imagePreview: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    margin: 24,
  },
  imagePreviewText: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  qualityText: {
    color: '#fff',
    fontSize: 16,
  },
  instructions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  tipsToggle: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tipsToggleText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  tipsContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    marginHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  tipsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    color: '#E0E0E0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  actions: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  captureActions: {
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: '#2196F3',
    borderRadius: 50,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  secondaryActions: {
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    color: '#757575',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  attemptsText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 8,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 16,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#757575',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
