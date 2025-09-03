/**
 * Document Upload Screen - Document collection and verification
 * 
 * Features:
 * - Required document checklist
 * - Camera capture and gallery selection
 * - Document quality validation
 * - Multiple document types support
 * - Upload progress tracking
 * - Document verification status
 * - OCR text extraction preview
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import UI components
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '1234-5678-9012'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    documents_title: 'Document Upload',
    documents_subtitle: 'Please upload the required documents for verification',
    required_documents: 'Required Documents',
    optional_documents: 'Optional Documents',
    upload_instructions: 'Upload Instructions',
    photo_guidelines: 'Photo Guidelines',
    document_status: 'Status',
    
    // Document types
    pan_card: 'PAN Card',
    aadhaar_card: 'Aadhaar Card',
    passport: 'Passport',
    driving_license: 'Driving License',
    voter_id: 'Voter ID',
    bank_passbook: 'Bank Passbook',
    cancelled_cheque: 'Cancelled Cheque',
    salary_slip: 'Latest Salary Slip',
    experience_letter: 'Experience Letter',
    education_certificate: 'Education Certificate',
    professional_certificate: 'Professional Certificate',
    profile_photo: 'Profile Photo',
    signature: 'Signature',
    
    // Actions
    capture_photo: 'Capture Photo',
    choose_gallery: 'Choose from Gallery',
    retake_photo: 'Retake Photo',
    upload_document: 'Upload Document',
    verify_document: 'Verify Document',
    continue: 'Continue',
    skip_optional: 'Skip Optional Documents',
    
    // Status
    not_uploaded: 'Not Uploaded',
    uploaded: 'Uploaded',
    verifying: 'Verifying...',
    verified: 'Verified',
    rejected: 'Rejected',
    pending: 'Pending Review',
    
    // Guidelines
    clear_photo: '• Take a clear, well-lit photo',
    all_corners: '• Ensure all corners are visible',
    no_blur: '• Avoid blur and shadows',
    readable_text: '• Text should be clearly readable',
    original_document: '• Use original document only',
    flat_surface: '• Place on a flat surface',
    
    // Validation messages
    required_document: 'This document is required',
    invalid_document: 'Document validation failed',
    poor_quality: 'Photo quality is poor, please retake',
    document_verified: 'Document verified successfully',
    verification_failed: 'Document verification failed',
    upload_failed: 'Upload failed, please try again',
    
    // Permissions
    camera_permission: 'Camera Permission Required',
    camera_permission_message: 'Please allow camera access to capture documents',
    storage_permission: 'Storage Permission Required',
    storage_permission_message: 'Please allow storage access to save documents',
    
    // OCR Results
    extracted_info: 'Extracted Information',
    pan_number: 'PAN Number',
    aadhaar_number: 'Aadhaar Number',
    license_number: 'License Number',
    name_on_document: 'Name on Document',
    date_of_birth: 'Date of Birth',
    address_on_document: 'Address on Document',
    confirm_info: 'Please confirm the extracted information',
  };
  return texts[key] || key;
};

interface DocumentItem {
  id: string;
  type: string;
  name: string;
  required: boolean;
  uri?: string;
  status: 'not_uploaded' | 'uploaded' | 'verifying' | 'verified' | 'rejected' | 'pending';
  extractedData?: { [key: string]: string };
  uploadProgress?: number;
  rejectionReason?: string;
}

interface DocumentUploadData {
  documents: DocumentItem[];
  allRequiredUploaded: boolean;
  timestamp: string;
}

const REQUIRED_DOCUMENTS = [
  { id: 'pan_card', type: 'identity', name: 'pan_card', required: true },
  { id: 'aadhaar_card', type: 'identity', name: 'aadhaar_card', required: true },
  { id: 'bank_passbook', type: 'bank', name: 'bank_passbook', required: true },
  { id: 'profile_photo', type: 'photo', name: 'profile_photo', required: true },
];

const OPTIONAL_DOCUMENTS = [
  { id: 'passport', type: 'identity', name: 'passport', required: false },
  { id: 'driving_license', type: 'identity', name: 'driving_license', required: false },
  { id: 'salary_slip', type: 'employment', name: 'salary_slip', required: false },
  { id: 'experience_letter', type: 'employment', name: 'experience_letter', required: false },
  { id: 'education_certificate', type: 'education', name: 'education_certificate', required: false },
  { id: 'signature', type: 'misc', name: 'signature', required: false },
];

export default function DocumentUploadScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [documentsData, setDocumentsData] = useState<DocumentUploadData>({
    documents: [],
    allRequiredUploaded: false,
    timestamp: '',
  });
  
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [extractedData, setExtractedData] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    initializeDocuments();
    loadSavedData();
  }, []);

  useEffect(() => {
    checkAllRequiredUploaded();
  }, [documentsData.documents]);

  const initializeDocuments = () => {
    const allDocuments = [...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS].map(doc => ({
      ...doc,
      status: 'not_uploaded' as const,
    }));

    setDocumentsData(prev => ({
      ...prev,
      documents: allDocuments,
    }));
  };

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`documents_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setDocumentsData(data);
      }
    } catch (error) {
      console.error('Failed to load saved documents data:', error);
    }
  };

  const checkAllRequiredUploaded = () => {
    const requiredDocs = documentsData.documents.filter(doc => doc.required);
    const uploadedRequired = requiredDocs.filter(doc => 
      doc.status === 'uploaded' || doc.status === 'verified' || doc.status === 'pending'
    );
    
    setDocumentsData(prev => ({
      ...prev,
      allRequiredUploaded: uploadedRequired.length === requiredDocs.length,
    }));
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: getLocalizedText('camera_permission', language),
            message: getLocalizedText('camera_permission_message', language),
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const openImagePicker = async (document: DocumentItem) => {
    setSelectedDocument(document);
    setShowImagePicker(true);
  };

  const capturePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        getLocalizedText('camera_permission', language),
        getLocalizedText('camera_permission_message', language)
      );
      return;
    }

    // Simulate camera capture
    setShowImagePicker(false);
    
    if (selectedDocument) {
      const mockImageUri = `file://documents/${selectedDocument.id}_${Date.now()}.jpg`;
      await uploadDocument(selectedDocument, mockImageUri);
    }
  };

  const chooseFromGallery = async () => {
    // Simulate gallery selection
    setShowImagePicker(false);
    
    if (selectedDocument) {
      const mockImageUri = `file://gallery/${selectedDocument.id}_${Date.now()}.jpg`;
      await uploadDocument(selectedDocument, mockImageUri);
    }
  };

  const uploadDocument = async (document: DocumentItem, uri: string) => {
    // Update document status to uploading
    updateDocumentStatus(document.id, 'verifying', uri);

    try {
      // Simulate upload and OCR processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mock OCR extraction based on document type
      const mockExtractedData = getMockExtractedData(document.type);
      
      if (mockExtractedData && Object.keys(mockExtractedData).length > 0) {
        setExtractedData(mockExtractedData);
        setSelectedDocument(document);
        setShowOCRModal(true);
      }

      // Update document with verification result
      updateDocumentStatus(document.id, 'verified', uri, mockExtractedData);
      
    } catch (error) {
      console.error('Upload failed:', error);
      updateDocumentStatus(document.id, 'rejected', uri, undefined, 'Upload failed');
      Alert.alert('Upload Failed', getLocalizedText('upload_failed', language));
    }
  };

  const getMockExtractedData = (documentType: string): { [key: string]: string } => {
    switch (documentType) {
      case 'pan_card':
        return {
          pan_number: userData?.personalData?.panNumber || 'ABCDE1234F',
          name_on_document: 'JOHN DOE',
          date_of_birth: '01/01/1990',
        };
      case 'aadhaar_card':
        return {
          aadhaar_number: userData?.personalData?.aadhaarNumber || '1234-5678-9012',
          name_on_document: 'John Doe',
          date_of_birth: '01/01/1990',
          address_on_document: '123 Main Street, City, State - 123456',
        };
      case 'driving_license':
        return {
          license_number: 'DL1420110012345',
          name_on_document: 'John Doe',
          date_of_birth: '01/01/1990',
          address_on_document: '123 Main Street, City, State - 123456',
        };
      default:
        return {};
    }
  };

  const updateDocumentStatus = (
    documentId: string, 
    status: DocumentItem['status'], 
    uri?: string,
    extractedData?: { [key: string]: string },
    rejectionReason?: string
  ) => {
    setDocumentsData(prev => ({
      ...prev,
      documents: prev.documents.map(doc => 
        doc.id === documentId 
          ? { 
              ...doc, 
              status, 
              uri, 
              extractedData,
              rejectionReason 
            }
          : doc
      ),
    }));
  };

  const confirmExtractedData = () => {
    if (selectedDocument) {
      updateDocumentStatus(
        selectedDocument.id, 
        'verified', 
        selectedDocument.uri, 
        extractedData
      );
    }
    setShowOCRModal(false);
    setSelectedDocument(null);
    setExtractedData({});
  };

  const handleContinue = async () => {
    if (!documentsData.allRequiredUploaded) {
      Alert.alert('Required Documents', 'Please upload all required documents before continuing.');
      return;
    }

    const finalData: DocumentUploadData = {
      ...documentsData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `documents_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ documentsData: finalData });
    } catch (error) {
      console.error('Failed to save documents data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkipOptional = () => {
    Alert.alert(
      'Skip Optional Documents?',
      'Optional documents can help with faster verification and better job opportunities.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: handleContinue },
      ]
    );
  };

  const getStatusColor = (status: DocumentItem['status']): string => {
    switch (status) {
      case 'not_uploaded': return '#9E9E9E';
      case 'uploaded': return '#2196F3';
      case 'verifying': return '#FF9800';
      case 'verified': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: DocumentItem['status']): string => {
    switch (status) {
      case 'not_uploaded': return '📄';
      case 'uploaded': return '📤';
      case 'verifying': return '🔄';
      case 'verified': return '✅';
      case 'rejected': return '❌';
      case 'pending': return '⏳';
      default: return '📄';
    }
  };

  const renderDocumentItem = (document: DocumentItem) => (
    <View key={document.id} style={styles.documentItem}>
      <View style={styles.documentInfo}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentName}>
            {getLocalizedText(document.name, language)}
            {document.required && <Text style={styles.requiredMark}> *</Text>}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(document.status) }]}>
            <Text style={styles.statusIcon}>{getStatusIcon(document.status)}</Text>
            <Text style={styles.statusText}>
              {getLocalizedText(document.status, language)}
            </Text>
          </View>
        </View>

        {document.uri && (
          <View style={styles.documentPreview}>
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewText}>Document Preview</Text>
            </View>
          </View>
        )}

        {document.rejectionReason && (
          <Text style={styles.rejectionReason}>{document.rejectionReason}</Text>
        )}
      </View>

      <View style={styles.documentActions}>
        {document.status === 'not_uploaded' || document.status === 'rejected' ? (
          <Button
            title={getLocalizedText('upload_document', language)}
            onPress={() => openImagePicker(document)}
            variant="outline"
            size="small"
          />
        ) : document.status === 'uploaded' || document.status === 'pending' ? (
          <Button
            title={getLocalizedText('retake_photo', language)}
            onPress={() => openImagePicker(document)}
            variant="text"
            size="small"
          />
        ) : (
          <View style={styles.verifiedContainer}>
            <Text style={styles.verifiedText}>✓ {getLocalizedText('verified', language)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderGuidelines = () => (
    <Card title={getLocalizedText('photo_guidelines', language)} variant="outlined" margin={8}>
      <View style={styles.guidelinesList}>
        <Text style={styles.guidelineItem}>{getLocalizedText('clear_photo', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('all_corners', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('no_blur', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('readable_text', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('original_document', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('flat_surface', language)}</Text>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('documents_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('documents_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Guidelines */}
        {renderGuidelines()}

        {/* Required Documents */}
        <Card title={getLocalizedText('required_documents', language)} variant="outlined" margin={8}>
          {documentsData.documents
            .filter(doc => doc.required)
            .map(renderDocumentItem)}
        </Card>

        {/* Optional Documents */}
        <Card title={getLocalizedText('optional_documents', language)} variant="outlined" margin={8}>
          {documentsData.documents
            .filter(doc => !doc.required)
            .map(renderDocumentItem)}
        </Card>
        
        <View style={styles.spacer} />
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.imagePickerModal}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('upload_document', language)}
            </Text>
            
            <Button
              title={getLocalizedText('capture_photo', language)}
              onPress={capturePhoto}
              variant="primary"
              size="large"
              icon={<Text style={styles.buttonIcon}>📷</Text>}
              fullWidth
            />
            
            <Button
              title={getLocalizedText('choose_gallery', language)}
              onPress={chooseFromGallery}
              variant="outline"
              size="large"
              icon={<Text style={styles.buttonIcon}>🖼️</Text>}
              fullWidth
            />
            
            <Button
              title="Cancel"
              onPress={() => setShowImagePicker(false)}
              variant="text"
              size="medium"
              fullWidth
            />
          </View>
        </View>
      </Modal>

      {/* OCR Results Modal */}
      <Modal
        visible={showOCRModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOCRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ocrModal}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('extracted_info', language)}
            </Text>
            
            <Text style={styles.modalSubtitle}>
              {getLocalizedText('confirm_info', language)}
            </Text>

            <View style={styles.extractedDataContainer}>
              {Object.entries(extractedData).map(([key, value]) => (
                <View key={key} style={styles.extractedDataItem}>
                  <Text style={styles.extractedDataLabel}>
                    {getLocalizedText(key, language)}:
                  </Text>
                  <Text style={styles.extractedDataValue}>{value}</Text>
                </View>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Confirm"
                onPress={confirmExtractedData}
                variant="primary"
                size="medium"
              />
              
              <Button
                title="Retake"
                onPress={() => {
                  setShowOCRModal(false);
                  if (selectedDocument) {
                    openImagePicker(selectedDocument);
                  }
                }}
                variant="outline"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Actions */}
      <View style={styles.actions}>
        {!documentsData.allRequiredUploaded ? (
          <Text style={styles.actionHint}>
            Upload required documents to continue
          </Text>
        ) : (
          <>
            <Button
              title={getLocalizedText('skip_optional', language)}
              onPress={handleSkipOptional}
              variant="text"
              size="medium"
            />
            
            <Button
              title={getLocalizedText('continue', language)}
              onPress={handleContinue}
              variant="primary"
              size="medium"
            />
          </>
        )}
      </View>
    </View>
  );
}

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
    paddingHorizontal: 8,
  },
  guidelinesList: {
    paddingVertical: 8,
  },
  guidelineItem: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 6,
    lineHeight: 20,
  },
  documentItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    flex: 1,
  },
  requiredMark: {
    color: '#F44336',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  documentPreview: {
    marginVertical: 8,
  },
  previewPlaceholder: {
    height: 60,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  previewText: {
    fontSize: 14,
    color: '#757575',
  },
  rejectionReason: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  documentActions: {
    justifyContent: 'center',
  },
  verifiedContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  ocrModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonIcon: {
    fontSize: 18,
  },
  extractedDataContainer: {
    marginBottom: 24,
  },
  extractedDataItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  extractedDataLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    width: 120,
  },
  extractedDataValue: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  spacer: {
    height: 100,
  },
  actions: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionHint: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
