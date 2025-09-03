/**
 * Aadhaar Scanning Screen - Document Recognition and OCR
 * 
 * Features:
 * - Camera-based document scanning
 * - OCR text extraction
 * - Auto-detection of Aadhaar format
 * - Manual entry fallback
 * - Validation and verification
 * - Offline storage capability
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { login: { username: 'testuser' } },
  validateAadhaarNumber: (aadhaar: string) => {
    const cleaned = aadhaar.replace(/\s/g, '');
    return cleaned.length === 12 && /^\d+$/.test(cleaned);
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    aadhaar_scan_title: 'Aadhaar Document Scan',
    aadhaar_scan_subtitle: 'Scan your Aadhaar card for automatic data entry',
    scan_front: 'Scan Front Side',
    scan_back: 'Scan Back Side',
    manual_entry: 'Enter Manually',
    aadhaar_number: 'Aadhaar Number',
    aadhaar_placeholder: 'XXXX XXXX XXXX',
    full_name: 'Full Name',
    date_of_birth: 'Date of Birth',
    gender: 'Gender',
    address: 'Address',
    scanning: 'Scanning document...',
    extracting_text: 'Extracting text...',
    validating: 'Validating information...',
    scan_success: 'Document scanned successfully!',
    scan_failed: 'Scan failed. Please try again or enter manually.',
    invalid_aadhaar: 'Invalid Aadhaar number format',
    required_field: 'This field is required',
    position_document: 'Position document within the frame',
    hold_steady: 'Hold steady...',
    capture_front: 'Capture Front',
    capture_back: 'Capture Back',
    retake: 'Retake',
    continue: 'Continue',
    skip: 'Skip for Now',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    dd_mm_yyyy: 'DD/MM/YYYY',
    auto_detected: 'Auto-detected',
    manual_verified: 'Manually verified',
    scanning_tips: 'Scanning Tips:',
    tip_lighting: '• Use good lighting',
    tip_flat: '• Keep document flat',
    tip_focus: '• Ensure text is clear',
    tip_edges: '• Include all edges',
  };
  return texts[key] || key;
};

interface AadhaarData {
  number: string;
  name: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  address: string;
  frontImageBase64?: string;
  backImageBase64?: string;
  extractionMethod: 'auto' | 'manual';
  timestamp: string;
}

type ScanSide = 'front' | 'back' | null;

export default function AadhaarScanScreen() {
  const { goToNextStep, goToPreviousStep, language, userData, validateAadhaarNumber } = useOnboarding();
  
  const [scanMethod, setScanMethod] = useState<'scan' | 'manual'>('scan');
  const [currentSide, setCurrentSide] = useState<ScanSide>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [frontCaptured, setFrontCaptured] = useState(false);
  const [backCaptured, setBackCaptured] = useState(false);
  const [showTips, setShowTips] = useState(false);
  
  // Form data
  const [aadhaarData, setAadhaarData] = useState<AadhaarData>({
    number: '',
    name: '',
    dateOfBirth: '',
    gender: 'male',
    address: '',
    extractionMethod: 'manual',
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [extractedData, setExtractedData] = useState<Partial<AadhaarData> | null>(null);

  const { width } = Dimensions.get('window');

  useEffect(() => {
    // Load any saved data
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`aadhaar_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setAadhaarData(data);
      }
    } catch (error) {
      console.error('Failed to load saved Aadhaar data:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!aadhaarData.number.trim()) {
      newErrors.number = getLocalizedText('required_field', language);
    } else if (!validateAadhaarNumber(aadhaarData.number)) {
      newErrors.number = getLocalizedText('invalid_aadhaar', language);
    }

    if (!aadhaarData.name.trim()) {
      newErrors.name = getLocalizedText('required_field', language);
    }

    if (!aadhaarData.dateOfBirth.trim()) {
      newErrors.dateOfBirth = getLocalizedText('required_field', language);
    }

    if (!aadhaarData.address.trim()) {
      newErrors.address = getLocalizedText('required_field', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleScanDocument = async (side: ScanSide) => {
    if (!side) return;
    
    setCurrentSide(side);
    setIsScanning(true);
    setIsProcessing(false);

    try {
      // Simulate camera capture
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIsScanning(false);
      setIsProcessing(true);
      
      // Simulate OCR processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock extracted data
      const mockExtractedData: Partial<AadhaarData> = {
        number: side === 'front' ? '1234 5678 9012' : aadhaarData.number,
        name: side === 'front' ? 'John Doe' : aadhaarData.name,
        dateOfBirth: side === 'front' ? '01/01/1990' : aadhaarData.dateOfBirth,
        gender: side === 'front' ? 'male' : aadhaarData.gender,
        address: side === 'back' ? '123 Main Street, City, State - 123456' : aadhaarData.address,
      };

      setExtractedData(mockExtractedData);
      setAadhaarData(prev => ({
        ...prev,
        ...mockExtractedData,
        extractionMethod: 'auto',
        [`${side}ImageBase64`]: `data:image/jpeg;base64,mock_${side}_image_data`,
      }));

      if (side === 'front') {
        setFrontCaptured(true);
      } else {
        setBackCaptured(true);
      }

      Alert.alert(
        getLocalizedText('scan_success', language),
        `${side} side captured successfully`
      );

    } catch (error) {
      console.error('Document scan error:', error);
      Alert.alert(
        getLocalizedText('scan_failed', language),
        'Please try again or enter information manually'
      );
    } finally {
      setIsScanning(false);
      setIsProcessing(false);
      setCurrentSide(null);
    }
  };

  const handleManualEntry = () => {
    setScanMethod('manual');
    setAadhaarData(prev => ({ ...prev, extractionMethod: 'manual' }));
  };

  const handleInputChange = (field: keyof AadhaarData, value: string) => {
    setAadhaarData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const formatAadhaarNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: AadhaarData = {
      ...aadhaarData,
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to local storage
      await AsyncStorage.setItem(
        `aadhaar_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ aadhaarData: finalData });
    } catch (error) {
      console.error('Failed to save Aadhaar data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Aadhaar Verification?',
      'Aadhaar verification is required for statutory compliance. You can complete this later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            aadhaarData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderScanInterface = () => (
    <View style={styles.scanContainer}>
      <View style={styles.scanMethodSelector}>
        <TouchableOpacity
          style={[styles.methodButton, styles.scanMethodActive]}
          onPress={() => setScanMethod('scan')}
        >
          <Text style={[styles.methodButtonText, styles.methodButtonTextActive]}>
            📷 {getLocalizedText('scan_front', language)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.methodButton}
          onPress={handleManualEntry}
        >
          <Text style={styles.methodButtonText}>
            ✏️ {getLocalizedText('manual_entry', language)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera Preview Area */}
      <View style={styles.cameraPreview}>
        {isScanning || isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.processingText}>
              {isScanning 
                ? getLocalizedText('scanning', language)
                : isProcessing 
                ? getLocalizedText('extracting_text', language)
                : getLocalizedText('validating', language)
              }
            </Text>
          </View>
        ) : (
          <View style={styles.documentFrame}>
            <View style={styles.frameGuide}>
              <Text style={styles.frameGuideText}>
                {getLocalizedText('position_document', language)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Scan Controls */}
      <View style={styles.scanControls}>
        <View style={styles.sideButtons}>
          <TouchableOpacity
            style={[
              styles.sideButton,
              frontCaptured && styles.sideButtonCaptured,
              (isScanning || isProcessing) && styles.buttonDisabled
            ]}
            onPress={() => handleScanDocument('front')}
            disabled={isScanning || isProcessing}
          >
            <Text style={styles.sideButtonText}>
              {frontCaptured ? '✅' : '📄'} {getLocalizedText('scan_front', language)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sideButton,
              backCaptured && styles.sideButtonCaptured,
              (isScanning || isProcessing) && styles.buttonDisabled
            ]}
            onPress={() => handleScanDocument('back')}
            disabled={isScanning || isProcessing}
          >
            <Text style={styles.sideButtonText}>
              {backCaptured ? '✅' : '📄'} {getLocalizedText('scan_back', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tips Toggle */}
        <TouchableOpacity
          style={styles.tipsToggle}
          onPress={() => setShowTips(!showTips)}
        >
          <Text style={styles.tipsToggleText}>
            {getLocalizedText('scanning_tips', language)} {showTips ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showTips && (
          <View style={styles.tipsContainer}>
            <Text style={styles.tipText}>
              {getLocalizedText('tip_lighting', language)}
            </Text>
            <Text style={styles.tipText}>
              {getLocalizedText('tip_flat', language)}
            </Text>
            <Text style={styles.tipText}>
              {getLocalizedText('tip_focus', language)}
            </Text>
            <Text style={styles.tipText}>
              {getLocalizedText('tip_edges', language)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderManualEntry = () => (
    <ScrollView style={styles.manualContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.formContainer}>
        <View style={styles.scanMethodSelector}>
          <TouchableOpacity
            style={styles.methodButton}
            onPress={() => setScanMethod('scan')}
          >
            <Text style={styles.methodButtonText}>
              📷 Scan Document
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.methodButton, styles.scanMethodActive]}
            onPress={() => setScanMethod('manual')}
          >
            <Text style={[styles.methodButtonText, styles.methodButtonTextActive]}>
              ✏️ {getLocalizedText('manual_entry', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Aadhaar Number */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('aadhaar_number', language)} *
          </Text>
          <TextInput
            style={[styles.textInput, errors.number ? styles.inputError : null]}
            value={formatAadhaarNumber(aadhaarData.number)}
            onChangeText={(text) => handleInputChange('number', text.replace(/\s/g, ''))}
            placeholder={getLocalizedText('aadhaar_placeholder', language)}
            keyboardType="numeric"
            maxLength={14} // Including spaces
          />
          {errors.number && (
            <Text style={styles.errorText}>{errors.number}</Text>
          )}
        </View>

        {/* Full Name */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('full_name', language)} *
          </Text>
          <TextInput
            style={[styles.textInput, errors.name ? styles.inputError : null]}
            value={aadhaarData.name}
            onChangeText={(text) => handleInputChange('name', text)}
            placeholder="Enter full name as on Aadhaar"
            autoCapitalize="words"
          />
          {errors.name && (
            <Text style={styles.errorText}>{errors.name}</Text>
          )}
        </View>

        {/* Date of Birth */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('date_of_birth', language)} *
          </Text>
          <TextInput
            style={[styles.textInput, errors.dateOfBirth ? styles.inputError : null]}
            value={aadhaarData.dateOfBirth}
            onChangeText={(text) => handleInputChange('dateOfBirth', text)}
            placeholder={getLocalizedText('dd_mm_yyyy', language)}
            keyboardType="numeric"
          />
          {errors.dateOfBirth && (
            <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
          )}
        </View>

        {/* Gender */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('gender', language)} *
          </Text>
          <View style={styles.genderContainer}>
            {(['male', 'female', 'other'] as const).map((gender) => (
              <TouchableOpacity
                key={gender}
                style={[
                  styles.genderButton,
                  aadhaarData.gender === gender && styles.genderButtonActive
                ]}
                onPress={() => handleInputChange('gender', gender)}
              >
                <Text style={[
                  styles.genderButtonText,
                  aadhaarData.gender === gender && styles.genderButtonTextActive
                ]}>
                  {getLocalizedText(gender, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('address', language)} *
          </Text>
          <TextInput
            style={[styles.textAreaInput, errors.address ? styles.inputError : null]}
            value={aadhaarData.address}
            onChangeText={(text) => handleInputChange('address', text)}
            placeholder="Enter address as on Aadhaar"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {errors.address && (
            <Text style={styles.errorText}>{errors.address}</Text>
          )}
        </View>

        {extractedData && (
          <View style={styles.autoDetectedBadge}>
            <Text style={styles.autoDetectedText}>
              {getLocalizedText('auto_detected', language)}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('aadhaar_scan_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('aadhaar_scan_subtitle', language)}
        </Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {scanMethod === 'scan' ? renderScanInterface() : renderManualEntry()}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>
            {getLocalizedText('skip', language)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!aadhaarData.number || !aadhaarData.name) && styles.buttonDisabled
          ]}
          onPress={handleContinue}
          disabled={!aadhaarData.number || !aadhaarData.name}
        >
          <Text style={styles.continueButtonText}>
            {getLocalizedText('continue', language)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  scanContainer: {
    flex: 1,
  },
  scanMethodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  scanMethodActive: {
    backgroundColor: '#2196F3',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#757575',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  cameraPreview: {
    flex: 1,
    margin: 24,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  documentFrame: {
    width: width * 0.8,
    height: width * 0.5,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameGuide: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    padding: 16,
    borderRadius: 8,
  },
  frameGuideText: {
    color: '#2196F3',
    fontSize: 16,
    textAlign: 'center',
  },
  scanControls: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sideButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sideButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  sideButtonCaptured: {
    backgroundColor: '#C8E6C9',
    borderColor: '#4CAF50',
  },
  sideButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  tipsToggle: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  tipsToggleText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  tipsContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
    marginBottom: 4,
  },
  manualContainer: {
    flex: 1,
  },
  formContainer: {
    padding: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 80,
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  genderButtonText: {
    fontSize: 14,
    color: '#757575',
  },
  genderButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  autoDetectedBadge: {
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  autoDetectedText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#757575',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  continueButton: {
    flex: 2,
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
