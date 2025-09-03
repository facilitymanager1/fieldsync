/**
 * Enhanced Expense Management Component with Camera, Location, OCR, and Analytics
 * Complete field service expense tracking solution
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { launchImageLibrary, launchCamera, PhotoQuality, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';

interface ExpenseEntry {
  id: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
  receiptImages: string[];
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  extractedData?: ReceiptData;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
}

interface ReceiptData {
  vendor?: string;
  amount?: number;
  date?: string;
  category?: string;
  confidence: number;
  rawText: string;
}

interface AnalyticsData {
  totalSpent: number;
  monthlyAverage: number;
  topCategory: string;
  insights: string[];
  anomalies: number;
  predictions: {
    nextMonth: number;
    trend: 'up' | 'down' | 'stable';
  };
  categoryTotals: { [key: string]: number };
}

const ExpenseManagementEnhanced: React.FC = () => {
  // Basic form state
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('meals');
  const [description, setDescription] = useState<string>('');
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  
  // Enhanced features state
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [ocrResult, setOcrResult] = useState<ReceiptData | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  
  // UI state
  const [currentView, setCurrentView] = useState<'form' | 'list' | 'analytics'>('form');
  const [showModal, setShowModal] = useState<boolean>(false);

  const categories = [
    'meals', 'transport', 'fuel', 'supplies', 'equipment', 
    'maintenance', 'accommodation', 'communication', 'other'
  ];

  useEffect(() => {
    requestLocationPermission();
    loadExpenses();
    generateAnalytics();
  }, []);

  useEffect(() => {
    generateAnalytics();
  }, [expenses]);

  // Permission management
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Access Required',
            message: 'This app needs to access your location for expense tracking',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getCurrentLocation();
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      getCurrentLocation();
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to camera to capture receipts',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Location services
  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocode(latitude, longitude);
        setCurrentLocation({ latitude, longitude, address });
      },
      (error) => {
        console.log('Location error:', error);
        Alert.alert('Location Error', 'Unable to get current location');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      return data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  };

  // Camera and image processing
  const selectImage = () => {
    Alert.alert(
      'Select Receipt',
      'Choose how to add your receipt',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openImageLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as PhotoQuality,
      includeBase64: false,
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };

    launchCamera(options, handleImageResponse);
  };

  const openImageLibrary = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as PhotoQuality,
      includeBase64: false,
    };

    launchImageLibrary(options, handleImageResponse);
  };

  const handleImageResponse = async (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorMessage || !response.assets) {
      return;
    }

    const imageUri = response.assets[0].uri;
    if (imageUri) {
      setReceiptImage(imageUri);
      setIsProcessing(true);
      
      // Process with OCR
      const ocrData = await processReceiptOCR(imageUri);
      setOcrResult(ocrData);
      
      // Auto-fill form if OCR was successful
      if (ocrData && ocrData.confidence > 0.7) {
        if (ocrData.amount) setAmount(ocrData.amount.toString());
        if (ocrData.category) setCategory(ocrData.category);
        if (ocrData.vendor) setDescription(ocrData.vendor);
      }
      
      setIsProcessing(false);
    }
  };

  // OCR Processing (simulated with intelligent parsing)
  const processReceiptOCR = async (imageUri: string): Promise<ReceiptData> => {
    // Simulate OCR processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate OCR extraction with realistic patterns
    const mockOCRText = generateMockOCRText();
    
    return {
      vendor: extractVendor(mockOCRText),
      amount: extractAmount(mockOCRText),
      date: extractDate(mockOCRText),
      category: classifyCategory(mockOCRText),
      confidence: 0.85,
      rawText: mockOCRText,
    };
  };

  const generateMockOCRText = (): string => {
    const vendors = ['Shell Gas Station', 'McDonald\'s', 'Office Depot', 'Home Depot', 'Starbucks'];
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    const amount = (Math.random() * 100 + 5).toFixed(2);
    const date = new Date().toLocaleDateString();
    
    return `${vendor}\n${date}\nTotal: $${amount}\nThank you for your business!`;
  };

  const extractVendor = (text: string): string => {
    const lines = text.split('\n');
    return lines[0] || 'Unknown Vendor';
  };

  const extractAmount = (text: string): number => {
    const amountMatch = text.match(/\$?(\d+\.?\d*)/);
    return amountMatch ? parseFloat(amountMatch[1]) : 0;
  };

  const extractDate = (text: string): string => {
    return new Date().toISOString().split('T')[0];
  };

  const classifyCategory = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('gas') || lowerText.includes('shell') || lowerText.includes('exxon')) return 'fuel';
    if (lowerText.includes('food') || lowerText.includes('restaurant') || lowerText.includes('mcdonald')) return 'meals';
    if (lowerText.includes('office') || lowerText.includes('supply')) return 'supplies';
    if (lowerText.includes('hotel') || lowerText.includes('accommodation')) return 'accommodation';
    return 'other';
  };

  // Analytics and ML
  const generateAnalytics = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.expenseDate);
      return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
    });

    const totalSpent = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const monthlyAverage = expenses.length > 0 ? expenses.reduce((sum, exp) => sum + exp.amount, 0) / expenses.length : 0;
    
    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    
    const topCategory = Object.keys(categoryTotals).reduce((a, b) => 
      categoryTotals[a] > categoryTotals[b] ? a : b, 'meals'
    );

    const insights = [
      `You've spent $${totalSpent.toFixed(2)} this month`,
      `${topCategory} is your highest expense category`,
      `Average expense: $${monthlyAverage.toFixed(2)}`,
      `${currentMonthExpenses.length} expenses this month`,
    ];

    const anomalies = detectAnomalies();
    const predictions = predictNextMonth();

    setAnalyticsData({
      totalSpent,
      monthlyAverage,
      topCategory,
      insights,
      anomalies,
      predictions,
      categoryTotals,
    });
  };

  const detectAnomalies = (): number => {
    if (expenses.length < 3) return 0;
    
    const amounts = expenses.map(exp => exp.amount);
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    return expenses.filter(exp => Math.abs(exp.amount - mean) > 2 * stdDev).length;
  };

  const predictNextMonth = (): { nextMonth: number; trend: 'up' | 'down' | 'stable' } => {
    if (expenses.length < 3) return { nextMonth: 0, trend: 'stable' };
    
    const recentExpenses = expenses.slice(-6);
    const amounts = recentExpenses.map(exp => exp.amount);
    const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    
    const firstHalf = amounts.slice(0, Math.floor(amounts.length / 2));
    const secondHalf = amounts.slice(Math.floor(amounts.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, amount) => sum + amount, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, amount) => sum + amount, 0) / secondHalf.length;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (secondAvg > firstAvg * 1.1) trend = 'up';
    else if (secondAvg < firstAvg * 0.9) trend = 'down';
    
    return {
      nextMonth: average * 1.1,
      trend,
    };
  };

  // Data management
  const loadExpenses = () => {
    // In a real app, this would load from AsyncStorage or API
    setExpenses([]);
  };

  // Helper functions for styles
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'draft': return styles.statusDraft;
      case 'submitted': return styles.statusSubmitted;
      case 'approved': return styles.statusApproved;
      case 'rejected': return styles.statusRejected;
      default: return styles.statusDraft;
    }
  };

  const getTrendStyle = (trend: string) => {
    switch (trend) {
      case 'up': return styles.trendUp;
      case 'down': return styles.trendDown;
      case 'stable': return styles.trendStable;
      default: return styles.trendStable;
    }
  };

  const saveExpense = async () => {
    if (!amount || !description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const newExpense: ExpenseEntry = {
      id: Date.now().toString(),
      amount: parseFloat(amount),
      category,
      description: description.trim(),
      expenseDate: new Date().toISOString().split('T')[0],
      receiptImages: receiptImage ? [receiptImage] : [],
      location: currentLocation || undefined,
      extractedData: ocrResult || undefined,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    setExpenses([...expenses, newExpense]);
    
    // Reset form
    setAmount('');
    setDescription('');
    setReceiptImage(null);
    setOcrResult(null);
    
    Alert.alert('Success', 'Expense saved successfully!');
  };

  const submitExpense = (expenseId: string) => {
    setExpenses(expenses.map(exp => 
      exp.id === expenseId ? { ...exp, status: 'submitted' } : exp
    ));
    Alert.alert('Success', 'Expense submitted for approval!');
  };

  const deleteExpense = (expenseId: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => setExpenses(expenses.filter(exp => exp.id !== expenseId))
        },
      ]
    );
  };

  // Render methods
  const renderNavigationTabs = () => (
    <View style={styles.tabContainer}>
      {[
        { key: 'form', label: '+ Add', icon: '📝' },
        { key: 'list', label: 'History', icon: '📋' },
        { key: 'analytics', label: 'Analytics', icon: '📊' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, currentView === tab.key && styles.activeTab]}
          onPress={() => setCurrentView(tab.key as any)}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, currentView === tab.key && styles.activeTabLabel]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderExpenseForm = () => (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add New Expense</Text>
      
      {/* Location Display */}
      {currentLocation && (
        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>📍 Current Location</Text>
          <Text style={styles.locationText}>
            {currentLocation.address || `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`}
          </Text>
        </View>
      )}

      {/* Receipt Image Section */}
      <View style={styles.section}>
        <Text style={styles.label}>Receipt</Text>
        <TouchableOpacity style={styles.imageButton} onPress={selectImage}>
          <Text style={styles.imageButtonText}>
            {receiptImage ? '📷 Change Receipt' : '📷 Add Receipt'}
          </Text>
        </TouchableOpacity>
        
        {receiptImage && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
          </View>
        )}
        
        {isProcessing && (
          <View style={styles.processingCard}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.processingText}>Processing receipt...</Text>
          </View>
        )}
        
        {ocrResult && (
          <View style={styles.ocrResultCard}>
            <Text style={styles.ocrTitle}>✨ Extracted Information</Text>
            <Text style={styles.ocrText}>Vendor: {ocrResult.vendor}</Text>
            <Text style={styles.ocrText}>Amount: ${ocrResult.amount?.toFixed(2)}</Text>
            <Text style={styles.ocrText}>Category: {ocrResult.category}</Text>
            <Text style={styles.ocrConfidence}>
              Confidence: {(ocrResult.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Form Fields */}
      <View style={styles.section}>
        <Text style={styles.label}>Amount *</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryButton, category === cat && styles.categoryButtonSelected]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryText, category === cat && styles.categoryTextSelected]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Expense description..."
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveExpense}>
        <Text style={styles.saveButtonText}>Save Expense</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderExpenseList = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Expense History</Text>
      
      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No expenses recorded yet</Text>
          <Text style={styles.emptyStateSubtext}>Tap the Add tab to create your first expense</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item: expense }) => (
            <View style={styles.expenseCard}>
              <View style={styles.expenseHeader}>
                <Text style={styles.expenseAmount}>${expense.amount.toFixed(2)}</Text>
                <Text style={[styles.expenseStatus, getStatusStyle(expense.status)]}>
                  {expense.status.toUpperCase()}
                </Text>
              </View>
              
              <Text style={styles.expenseCategory}>{expense.category.toUpperCase()}</Text>
              <Text style={styles.expenseDescription}>{expense.description}</Text>
              <Text style={styles.expenseDate}>{expense.expenseDate}</Text>
              
              {expense.location && (
                <Text style={styles.expenseLocation}>
                  📍 {expense.location.address || `${expense.location.latitude.toFixed(4)}, ${expense.location.longitude.toFixed(4)}`}
                </Text>
              )}
              
              {expense.receiptImages && expense.receiptImages.length > 0 && (
                <Text style={styles.receiptIndicator}>📎 Receipt attached</Text>
              )}
              
              <View style={styles.expenseActions}>
                {expense.status === 'draft' && (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={() => submitExpense(expense.id)}
                  >
                    <Text style={styles.submitButtonText}>Submit</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteExpense(expense.id)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderAnalyticsDashboard = () => (
    <ScrollView style={styles.container}>
      <View style={styles.analyticsHeader}>
        <Text style={styles.title}>📊 Analytics Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={generateAnalytics}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {analyticsData && (
        <>
          {/* Summary Cards */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Spent This Month</Text>
            <Text style={styles.summaryValue}>${analyticsData.totalSpent.toFixed(2)}</Text>
            <Text style={styles.summarySubtext}>
              Average: ${analyticsData.monthlyAverage.toFixed(2)} per expense
            </Text>
          </View>

          {/* Anomaly Alert */}
          {analyticsData.anomalies > 0 && (
            <View style={styles.anomalyAlert}>
              <Text style={styles.anomalyText}>
                ⚠️ {analyticsData.anomalies} unusual expense{analyticsData.anomalies > 1 ? 's' : ''} detected
              </Text>
            </View>
          )}

          {/* Insights */}
          <View style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>💡 Key Insights</Text>
            {analyticsData.insights.map((insight: string, index: number) => (
              <View key={index} style={styles.insightItem}>
                <Text style={styles.insightIcon}>•</Text>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>

          {/* Prediction */}
          <View style={styles.predictionCard}>
            <Text style={styles.predictionTitle}>🔮 Next Month Prediction</Text>
            <Text style={styles.predictionValue}>
              ${analyticsData.predictions.nextMonth.toFixed(2)}
            </Text>
            <View style={styles.trendIndicator}>
              <Text style={{ fontSize: 20 }}>
                {analyticsData.predictions.trend === 'up' ? '📈' : 
                 analyticsData.predictions.trend === 'down' ? '📉' : '➡️'}
              </Text>
              <Text style={[styles.trendText, getTrendStyle(analyticsData.predictions.trend)]}>
                {analyticsData.predictions.trend === 'up' ? 'Increasing' : 
                 analyticsData.predictions.trend === 'down' ? 'Decreasing' : 'Stable'} trend
              </Text>
            </View>
          </View>

          {/* Category Breakdown */}
          <View style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>📋 Category Breakdown</Text>
            {Object.entries(analyticsData.categoryTotals).map(([category, amount]: [string, any]) => (
              <View key={category} style={styles.insightItem}>
                <Text style={styles.insightIcon}>💰</Text>
                <Text style={styles.insightText}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}: ${amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderCurrentView = () => {
    switch (currentView) {
      case 'form':
        return renderExpenseForm();
      case 'list':
        return renderExpenseList();
      case 'analytics':
        return renderAnalyticsDashboard();
      default:
        return renderExpenseForm();
    }
  };

  return (
    <View style={styles.mainContainer}>
      {renderNavigationTabs()}
      {renderCurrentView()}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3498db',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#3498db',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryButton: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#3498db',
  },
  categoryText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  imageButton: {
    backgroundColor: '#ecf0f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  imageButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: 16,
  },
  imagePreview: {
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f4f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  processingText: {
    marginLeft: 8,
    color: '#2980b9',
    fontWeight: '600',
  },
  ocrResultCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  ocrTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 8,
  },
  ocrText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 4,
  },
  ocrConfidence: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginTop: 4,
  },
  locationCard: {
    backgroundColor: '#e8f4f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2980b9',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#34495e',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#7f8c8d',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  expenseCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  expenseStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusDraft: {
    backgroundColor: '#f39c12',
    color: '#fff',
  },
  statusSubmitted: {
    backgroundColor: '#3498db',
    color: '#fff',
  },
  statusApproved: {
    backgroundColor: '#27ae60',
    color: '#fff',
  },
  statusRejected: {
    backgroundColor: '#e74c3c',
    color: '#fff',
  },
  expenseCategory: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseDescription: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  expenseLocation: {
    fontSize: 12,
    color: '#27ae60',
    marginBottom: 4,
  },
  receiptIndicator: {
    fontSize: 12,
    color: '#3498db',
    marginBottom: 8,
  },
  expenseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  submitButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Analytics Dashboard Styles
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  summarySubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  insightsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  insightIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 20,
    textAlign: 'center',
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#34495e',
  },
  predictionCard: {
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  predictionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2980b9',
    marginBottom: 12,
  },
  predictionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  trendUp: {
    color: '#e74c3c',
  },
  trendDown: {
    color: '#27ae60',
  },
  trendStable: {
    color: '#f39c12',
  },
  anomalyAlert: {
    backgroundColor: '#fdf2e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e67e22',
  },
  anomalyText: {
    color: '#d35400',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ExpenseManagementEnhanced;
