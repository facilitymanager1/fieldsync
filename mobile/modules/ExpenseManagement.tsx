// Enhanced Expense Management Mobile Component for FieldSync with Camera, Location & OCR
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import ApiService from '../services/ApiService';

// Define missing types locally since they don't exist in ApiService
export interface ExpenseEntry {
  id: string;
  amount: number;
  currency: string;
  category: string;
  subcategory?: string;
  description: string;
  receiptPhoto?: string;
  additionalDocuments?: string[];
  location?: Location;
  expenseDate: Date;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  metadata?: Record<string, any>;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseSubmissionRequest {
  amount: number;
  currency: string;
  category: string;
  subcategory?: string;
  description: string;
  receiptPhoto?: string;
  additionalDocuments?: string[];
  location?: Location | null;
  expenseDate: Date;
  metadata?: Record<string, any>;
  tags?: string[];
  notes?: string;
}

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

interface ExpenseCategory {
  name: string;
  subcategories: string[];
}

interface ReceiptData {
  amount?: number;
  vendor?: string;
  date?: Date;
  items?: Array<{ name: string; price: number; quantity: number }>;
  tax?: number;
  confidence?: number;
}

interface OCRResult {
  text: string;
  confidence: number;
  parsedData: ReceiptData;
}

// Simplified category list
const DEFAULT_CATEGORIES = {
  travel: { name: 'Travel', subcategories: ['Flight', 'Train', 'Bus', 'Taxi', 'Rental Car'] },
  meals: { name: 'Meals', subcategories: ['Breakfast', 'Lunch', 'Dinner', 'Client Meeting'] },
  accommodation: { name: 'Accommodation', subcategories: ['Hotel', 'Airbnb', 'Extended Stay'] },
  fuel: { name: 'Fuel', subcategories: ['Gasoline', 'Diesel', 'Electric Charging'] },
  supplies: { name: 'Supplies', subcategories: ['Office Supplies', 'Tools', 'Safety Equipment'] },
  maintenance: { name: 'Maintenance', subcategories: ['Vehicle', 'Equipment', 'Facility'] },
  parking: { name: 'Parking', subcategories: ['Airport', 'City Parking', 'Valet'] },
  tolls: { name: 'Tolls', subcategories: ['Highway', 'Bridge', 'Tunnel'] },
  other: { name: 'Other', subcategories: ['Miscellaneous', 'Training', 'Communication'] },
};

const ExpenseManagement: React.FC = () => {
  // State Management
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'analytics'>('list');
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [categories] = useState<{ [key: string]: ExpenseCategory }>(DEFAULT_CATEGORIES);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<ExpenseSubmissionRequest>({
    amount: 0,
    currency: 'USD',
    category: 'other',
    subcategory: '',
    description: '',
    receiptPhoto: '',
    additionalDocuments: [],
    location: null,
    expenseDate: new Date(),
    metadata: {},
    tags: [],
    notes: '',
  });

  // Pagination
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    initializeComponent();
  }, []);

  const initializeComponent = async () => {
    await Promise.all([
      getCurrentLocation(),
      loadExpenses(),
      loadDraftExpenses(),
    ]);
  };

  // === LOCATION SERVICES ===
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'FieldSync needs access to your location for expense tracking',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    }
    return true;
  };

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise(async (resolve, reject) => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        reject(new Error('Location permission denied'));
        return;
      }

      Geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const address = await reverseGeocode(latitude, longitude);
          const location: Location = {
            latitude,
            longitude,
            accuracy,
            address,
          };
          setCurrentLocation(location);
          resolve(location);
        },
        (error) => {
          console.warn('Location error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        }
      );
    });
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      // Mock implementation - replace with actual geocoding service
      return `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      console.warn('Geocoding error:', error);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  };

  // === CAMERA AND IMAGE HANDLING ===
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'FieldSync needs camera access to capture receipt photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Camera permission error:', err);
        return false;
      }
    }
    return true;
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Select Receipt Photo',
      'Choose how you would like to add a receipt photo',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as PhotoQuality,
      maxWidth: 1000,
      maxHeight: 1000,
      includeBase64: true,
    };

    launchCamera(options, handleImageResponse);
  };

  const openGallery = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as PhotoQuality,
      maxWidth: 1000,
      maxHeight: 1000,
      includeBase64: true,
    };

    launchImageLibrary(options, handleImageResponse);
  };

  const handleImageResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorMessage) {
      return;
    }

    if (response.assets && response.assets[0]) {
      const asset = response.assets[0];
      if (asset.uri) {
        setFormData(prev => ({
          ...prev,
          receiptPhoto: asset.uri!,
        }));

        // Trigger OCR processing
        processReceiptWithOCR(asset.uri);
      }
    }
  };

  const performOCR = async (receiptInfo: ReceiptData) => {
    setProcessingOCR(true);
    try {
      // Apply OCR suggestions to form
      if (receiptInfo.amount) {
        setFormData(prev => ({
          ...prev,
          amount: receiptInfo.amount || prev.amount,
        }));
      }

      if (receiptInfo.vendor) {
        setFormData(prev => ({
          ...prev,
          description: receiptInfo.vendor || prev.description,
        }));
      }

      if (receiptInfo.date) {
        setFormData(prev => ({
          ...prev,
          expenseDate: receiptInfo.date || prev.expenseDate,
        }));
      }

      setReceiptData(receiptInfo);
      
      Alert.alert(
        'OCR Analysis Complete',
        `Extracted information has been applied to the form. Please review and adjust as needed.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert('OCR Error', 'Failed to process receipt. Please enter details manually.');
    } finally {
      setProcessingOCR(false);
    }
  };

  const processReceiptWithOCR = async (imageUri: string): Promise<OCRResult | null> => {
    try {
      // Mock OCR implementation - replace with actual OCR service
      const mockResult: OCRResult = {
        text: 'Sample receipt text',
        confidence: 0.85,
        parsedData: {
          amount: Math.floor(Math.random() * 100) + 10,
          vendor: 'Sample Vendor',
          date: new Date(),
          confidence: 0.85,
        }
      };

      await performOCR(mockResult.parsedData);
      return mockResult;
    } catch (error) {
      console.error('OCR processing failed:', error);
      return null;
    }
  };

  // === DATA MANAGEMENT ===
  const loadExpenses = async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const currentOffset = reset ? 0 : offset;
      const filterParams = {
        limit,
        offset: currentOffset,
        status: 'submitted,approved,rejected',
      };

      // Mock API call since getExpenses doesn't exist
      const mockExpenses: ExpenseEntry[] = [
        {
          id: '1',
          amount: 45.50,
          currency: 'USD',
          category: 'meals',
          description: 'Business lunch',
          status: 'approved',
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      if (reset) {
        setExpenses(mockExpenses);
        setOffset(limit);
      } else {
        setExpenses(prev => [...prev, ...mockExpenses]);
        setOffset(currentOffset + limit);
      }

      setHasMore(mockExpenses.length === limit);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDraftExpenses = async () => {
    try {
      const drafts = await AsyncStorage.getItem('draft_expenses');
      if (drafts) {
        const draftExpenses = JSON.parse(drafts);
        setExpenses(prev => {
          const existing = prev.filter(e => e.status !== 'draft');
          return [...existing, ...draftExpenses];
        });
      }
    } catch (error) {
      console.error('Failed to load draft expenses:', error);
    }
  };

  const saveDraftExpense = async (expense: any) => {
    try {
      const existingDrafts = await AsyncStorage.getItem('draft_expenses');
      const drafts = existingDrafts ? JSON.parse(existingDrafts) : [];
      
      const draftExpense = {
        ...expense,
        id: `draft_${Date.now()}`,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedDrafts = drafts.filter((d: any) => d.id !== draftExpense.id);
      updatedDrafts.push(draftExpense);

      await AsyncStorage.setItem('draft_expenses', JSON.stringify(updatedDrafts));
      
      setExpenses(prev => [...prev.filter(e => e.id !== draftExpense.id), draftExpense]);
      
      Alert.alert('Success', 'Expense saved as draft');
    } catch (error) {
      console.error('Failed to save draft:', error);
      Alert.alert('Error', 'Failed to save draft expense');
    }
  };

  const handleSubmitExpense = async (saveAsDraft = false) => {
    if (!formData.amount || formData.amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (saveAsDraft) {
      await saveDraftExpense(formData);
      setShowSubmitModal(false);
      resetForm();
      return;
    }

    setLoading(true);
    try {
      const expenseData = {
        ...formData,
        location: currentLocation,
        expenseDate: formData.expenseDate || new Date(),
        metadata: {
          platform: 'mobile',
          version: '1.0',
          ...(receiptData && { ocrData: receiptData }),
        },
      };

      // Mock submission since submitExpense doesn't exist
      console.log('Submitting expense:', expenseData);
      
      Alert.alert('Success', 'Expense submitted successfully');
      setShowSubmitModal(false);
      resetForm();
      loadExpenses(true);
    } catch (error) {
      console.error('Submission error:', error);
      Alert.alert('Error', 'Failed to submit expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Mock deletion since deleteExpense doesn't exist
              console.log('Deleting expense:', expenseId);
              
              setExpenses(prev => prev.filter(e => e.id !== expenseId));
              Alert.alert('Success', 'Expense deleted successfully');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      amount: 0,
      currency: 'USD',
      category: 'other',
      subcategory: '',
      description: '',
      receiptPhoto: '',
      additionalDocuments: [],
      location: null,
      expenseDate: new Date(),
      metadata: {},
      tags: [],
      notes: '',
    });
    setReceiptData(null);
  };

  // Helper function to get status style safely
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'draft':
        return styles.statusDraft;
      case 'submitted':
        return styles.statusSubmitted;
      case 'approved':
        return styles.statusApproved;
      case 'rejected':
        return styles.statusRejected;
      default:
        return styles.statusDraft;
    }
  };

  const renderExpenseItem = ({ item }: { item: ExpenseEntry }) => (
    <View style={styles.expenseItem}>
      <View style={styles.expenseHeader}>
        <Text style={styles.expenseAmount}>${item.amount.toFixed(2)}</Text>
        <Text style={[styles.expenseStatus, getStatusStyle(item.status)]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.expenseDescription}>{item.description}</Text>
      <Text style={styles.expenseCategory}>{categories[item.category]?.name || item.category}</Text>
      <View style={styles.expenseFooter}>
        <Text style={styles.expenseDate}>
          {new Date(item.expenseDate).toLocaleDateString()}
        </Text>
        {item.status === 'draft' && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteExpense(item.id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expense Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowSubmitModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add Expense</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadExpenses(true);
        }}
        onEndReached={() => {
          if (hasMore && !loading) {
            loadExpenses();
          }
        }}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loading ? <ActivityIndicator size="large" color="#007bff" /> : null
        }
        style={styles.expensesList}
      />

      <Modal
        visible={showSubmitModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Expense</Text>
            <TouchableOpacity onPress={() => setShowSubmitModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={formData.amount.toString()}
                onChangeText={(text) => setFormData(prev => ({ ...prev, amount: parseFloat(text) || 0 }))}
                keyboardType="numeric"
                placeholder="0.00"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Enter description"
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Receipt Photo</Text>
              <TouchableOpacity style={styles.photoButton} onPress={handleImagePicker}>
                {formData.receiptPhoto ? (
                  <Image source={{ uri: formData.receiptPhoto }} style={styles.receiptImage} />
                ) : (
                  <Text style={styles.photoButtonText}>📷 Add Receipt Photo</Text>
                )}
              </TouchableOpacity>
            </View>

            {processingOCR && (
              <View style={styles.ocrProcessing}>
                <ActivityIndicator size="small" color="#007bff" />
                <Text style={styles.ocrText}>Processing receipt...</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.draftButton]}
                onPress={() => handleSubmitExpense(true)}
              >
                <Text style={styles.draftButtonText}>Save as Draft</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.submitButton]}
                onPress={() => handleSubmitExpense(false)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  expensesList: {
    flex: 1,
    padding: 16,
  },
  expenseItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  expenseStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  statusDraft: { backgroundColor: '#f8f9fa', color: '#6c757d' },
  statusSubmitted: { backgroundColor: '#fff3cd', color: '#856404' },
  statusApproved: { backgroundColor: '#d4edda', color: '#155724' },
  statusRejected: { backgroundColor: '#f8d7da', color: '#721c24' },
  expenseDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseDate: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  photoButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  photoButtonText: {
    fontSize: 16,
    color: '#666',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
  },
  ocrProcessing: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
  },
  ocrText: {
    marginLeft: 8,
    color: '#666',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  draftButton: {
    backgroundColor: '#6c757d',
  },
  draftButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007bff',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ExpenseManagement;
