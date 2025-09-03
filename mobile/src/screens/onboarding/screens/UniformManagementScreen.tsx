/**
 * Uniform Management Screen - Comprehensive uniform sizing and allocation
 * 
 * Features:
 * - Detailed uniform forms for Gents and Ladies
 * - Size collection for different garment types
 * - Measurement recording (shirt, pant, shoe sizes)
 * - Quantity and allocation tracking
 * - Status management (Pending, Allocated, Delivered)
 * - Different uniform categories based on role/designation
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
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    onboarding: { tempId: 'TMP001' },
    personalDetails: { 
      name: 'John Doe',
      gender: 'male',
      designation: 'Security Guard',
      department: 'Security'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    uniform_management_title: 'Uniform Management',
    uniform_management_subtitle: 'Complete uniform sizing and allocation details',
    temp_id: 'Temp Employee ID',
    employee_details: 'Employee Details',
    uniform_category: 'Uniform Category',
    gents_uniform: 'Gents Uniform',
    ladies_uniform: 'Ladies Uniform',
    shirt_details: 'Shirt Details',
    pant_details: 'Pant Details',
    shoe_details: 'Shoe Details',
    additional_items: 'Additional Items',
    shirt_size: 'Shirt Size',
    shirt_chest: 'Chest Size',
    shirt_length: 'Length',
    shirt_shoulder: 'Shoulder',
    pant_size: 'Pant Size',
    pant_waist: 'Waist Size',
    pant_length: 'Length',
    pant_hip: 'Hip Size',
    shoe_size: 'Shoe Size',
    shoe_type: 'Shoe Type',
    quantity: 'Quantity',
    allocation_date: 'Allocation Date',
    delivery_date: 'Delivery Date',
    status: 'Status',
    status_pending: 'Pending',
    status_allocated: 'Allocated',
    status_delivered: 'Delivered',
    status_returned: 'Returned',
    cap_hat: 'Cap/Hat',
    belt: 'Belt',
    tie: 'Tie',
    blazer: 'Blazer',
    jacket: 'Jacket',
    socks: 'Socks',
    safety_equipment: 'Safety Equipment',
    id_card: 'ID Card',
    name_badge: 'Name Badge',
    required_field: 'This field is required',
    invalid_number: 'Please enter a valid number',
    submit: 'Submit',
    cancel: 'Cancel',
    save_draft: 'Save Draft',
    inches: 'inches',
    size_s: 'S',
    size_m: 'M',
    size_l: 'L',
    size_xl: 'XL',
    size_xxl: 'XXL',
    size_custom: 'Custom',
    formal_shoes: 'Formal Shoes',
    safety_shoes: 'Safety Shoes',
    sports_shoes: 'Sports Shoes',
    boots: 'Boots',
    dd_mm_yyyy: 'DD/MM/YYYY',
    measurements: 'Measurements',
    allocation_details: 'Allocation Details',
  };
  return texts[key] || key;
};

const SHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'Custom'];
const PANT_SIZES = ['28', '30', '32', '34', '36', '38', '40', '42', 'Custom'];
const SHOE_SIZES = ['6', '7', '8', '9', '10', '11', '12', 'Custom'];
const SHOE_TYPES = ['Formal Shoes', 'Safety Shoes', 'Sports Shoes', 'Boots'];
const STATUS_OPTIONS = ['pending', 'allocated', 'delivered', 'returned'];

interface UniformItem {
  type: string;
  size: string;
  customSize?: string;
  measurements?: {
    chest?: string;
    length?: string;
    shoulder?: string;
    waist?: string;
    hip?: string;
  };
  quantity: number;
  allocationDate?: string;
  deliveryDate?: string;
  status: 'pending' | 'allocated' | 'delivered' | 'returned';
}

interface UniformManagementData {
  tempId: string;
  employeeDetails: {
    name: string;
    gender: 'male' | 'female';
    designation: string;
    department: string;
  };
  uniformCategory: 'gents' | 'ladies';
  uniformItems: {
    shirt: UniformItem;
    pant: UniformItem;
    shoes: UniformItem;
    additionalItems: UniformItem[];
  };
  overallStatus: 'pending' | 'partial' | 'complete';
  totalCost?: number;
  remarks?: string;
  timestamp: string;
}

const ADDITIONAL_ITEMS = [
  'Cap/Hat', 'Belt', 'Tie', 'Blazer', 'Jacket', 'Socks', 
  'Safety Equipment', 'ID Card', 'Name Badge'
];

export default function UniformManagementScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [uniformData, setUniformData] = useState<UniformManagementData>({
    tempId: userData?.onboarding?.tempId || '',
    employeeDetails: {
      name: userData?.personalDetails?.name || '',
      gender: (userData?.personalDetails?.gender as 'male' | 'female') || 'male',
      designation: userData?.personalDetails?.designation || '',
      department: userData?.personalDetails?.department || '',
    },
    uniformCategory: (userData?.personalDetails?.gender === 'female') ? 'ladies' : 'gents',
    uniformItems: {
      shirt: {
        type: 'Shirt',
        size: 'M',
        measurements: {},
        quantity: 2,
        status: 'pending',
      },
      pant: {
        type: 'Pant',
        size: '32',
        measurements: {},
        quantity: 2,
        status: 'pending',
      },
      shoes: {
        type: 'Shoes',
        size: '8',
        quantity: 1,
        status: 'pending',
      },
      additionalItems: [],
    },
    overallStatus: 'pending',
    totalCost: 0,
    remarks: '',
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSizePickers, setShowSizePickers] = useState<{ [key: string]: boolean }>({});
  const [showStatusPickers, setShowStatusPickers] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`uniform_management_${uniformData.tempId}`);
      if (saved) {
        const data = JSON.parse(saved);
        setUniformData(data);
      }
    } catch (error) {
      console.error('Failed to load saved uniform management data:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate basic measurements for custom sizes
    if (uniformData.uniformItems.shirt.size === 'Custom') {
      if (!uniformData.uniformItems.shirt.measurements?.chest) {
        newErrors.shirtChest = getLocalizedText('required_field', language);
      }
      if (!uniformData.uniformItems.shirt.measurements?.length) {
        newErrors.shirtLength = getLocalizedText('required_field', language);
      }
    }

    if (uniformData.uniformItems.pant.size === 'Custom') {
      if (!uniformData.uniformItems.pant.measurements?.waist) {
        newErrors.pantWaist = getLocalizedText('required_field', language);
      }
      if (!uniformData.uniformItems.pant.measurements?.length) {
        newErrors.pantLength = getLocalizedText('required_field', language);
      }
    }

    // Validate quantities
    if (uniformData.uniformItems.shirt.quantity < 1) {
      newErrors.shirtQuantity = 'Quantity must be at least 1';
    }

    if (uniformData.uniformItems.pant.quantity < 1) {
      newErrors.pantQuantity = 'Quantity must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleItemUpdate = (itemType: 'shirt' | 'pant' | 'shoes', field: string, value: any) => {
    setUniformData(prev => ({
      ...prev,
      uniformItems: {
        ...prev.uniformItems,
        [itemType]: {
          ...prev.uniformItems[itemType],
          [field]: value,
        }
      }
    }));

    // Clear errors
    const errorKey = `${itemType}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const handleMeasurementUpdate = (itemType: 'shirt' | 'pant', measurement: string, value: string) => {
    setUniformData(prev => ({
      ...prev,
      uniformItems: {
        ...prev.uniformItems,
        [itemType]: {
          ...prev.uniformItems[itemType],
          measurements: {
            ...prev.uniformItems[itemType].measurements,
            [measurement]: value,
          }
        }
      }
    }));

    // Clear errors
    const errorKey = `${itemType}${measurement.charAt(0).toUpperCase() + measurement.slice(1)}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addAdditionalItem = (itemType: string) => {
    const newItem: UniformItem = {
      type: itemType,
      size: 'M',
      quantity: 1,
      status: 'pending',
    };

    setUniformData(prev => ({
      ...prev,
      uniformItems: {
        ...prev.uniformItems,
        additionalItems: [...prev.uniformItems.additionalItems, newItem]
      }
    }));
  };

  const removeAdditionalItem = (index: number) => {
    setUniformData(prev => ({
      ...prev,
      uniformItems: {
        ...prev.uniformItems,
        additionalItems: prev.uniformItems.additionalItems.filter((_, i) => i !== index)
      }
    }));
  };

  const calculateOverallStatus = (): 'pending' | 'partial' | 'complete' => {
    const allItems = [
      uniformData.uniformItems.shirt,
      uniformData.uniformItems.pant,
      uniformData.uniformItems.shoes,
      ...uniformData.uniformItems.additionalItems
    ];

    const deliveredCount = allItems.filter(item => item.status === 'delivered').length;
    const totalCount = allItems.length;

    if (deliveredCount === 0) return 'pending';
    if (deliveredCount === totalCount) return 'complete';
    return 'partial';
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalData: UniformManagementData = {
      ...uniformData,
      overallStatus: calculateOverallStatus(),
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to local storage
      await AsyncStorage.setItem(
        `uniform_management_${uniformData.tempId}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ uniformManagement: finalData });
    } catch (error) {
      console.error('Failed to save uniform management data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSaveDraft = async () => {
    try {
      const draftData = {
        ...uniformData,
        timestamp: new Date().toISOString(),
      };

      await AsyncStorage.setItem(
        `uniform_management_${uniformData.tempId}`,
        JSON.stringify(draftData)
      );

      Alert.alert('Success', 'Draft saved successfully');
    } catch (error) {
      console.error('Failed to save draft:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  };

  const renderEmployeeDetailsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>
        {getLocalizedText('employee_details', language)}
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('temp_id', language)} *
        </Text>
        <TextInput
          style={styles.textInputDisabled}
          value={uniformData.tempId}
          editable={false}
        />
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name:</Text>
          <Text style={styles.infoValue}>{uniformData.employeeDetails.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Gender:</Text>
          <Text style={styles.infoValue}>{uniformData.employeeDetails.gender}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Designation:</Text>
          <Text style={styles.infoValue}>{uniformData.employeeDetails.designation}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Department:</Text>
          <Text style={styles.infoValue}>{uniformData.employeeDetails.department}</Text>
        </View>
      </View>
    </View>
  );

  const renderUniformItemSection = (itemType: 'shirt' | 'pant' | 'shoes', title: string, sizeOptions: string[]) => {
    const item = uniformData.uniformItems[itemType];
    const isCustomSize = item.size === 'Custom';
    
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>

        {/* Size Selection */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText(`${itemType}_size`, language)} *
          </Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowSizePickers(prev => ({ ...prev, [itemType]: !prev[itemType] }))}
          >
            <Text style={styles.pickerButtonText}>{item.size}</Text>
            <Text style={styles.pickerArrow}>{showSizePickers[itemType] ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showSizePickers[itemType] && (
            <View style={styles.pickerContainer}>
              {sizeOptions.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.pickerOption,
                    item.size === size && styles.pickerOptionSelected
                  ]}
                  onPress={() => {
                    handleItemUpdate(itemType, 'size', size);
                    setShowSizePickers(prev => ({ ...prev, [itemType]: false }));
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    item.size === size && styles.pickerOptionTextSelected
                  ]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Custom Measurements for Shirt */}
        {itemType === 'shirt' && isCustomSize && (
          <View style={styles.measurementsContainer}>
            <Text style={styles.measurementsTitle}>
              {getLocalizedText('measurements', language)}
            </Text>
            
            <View style={styles.measurementRow}>
              <View style={styles.measurementInput}>
                <Text style={styles.measurementLabel}>
                  {getLocalizedText('shirt_chest', language)} *
                </Text>
                <TextInput
                  style={[styles.textInput, errors.shirtChest ? styles.inputError : null]}
                  value={item.measurements?.chest || ''}
                  onChangeText={(text) => handleMeasurementUpdate('shirt', 'chest', text)}
                  placeholder="36"
                  keyboardType="numeric"
                />
                {errors.shirtChest && (
                  <Text style={styles.errorText}>{errors.shirtChest}</Text>
                )}
              </View>
              
              <View style={styles.measurementInput}>
                <Text style={styles.measurementLabel}>
                  {getLocalizedText('shirt_length', language)} *
                </Text>
                <TextInput
                  style={[styles.textInput, errors.shirtLength ? styles.inputError : null]}
                  value={item.measurements?.length || ''}
                  onChangeText={(text) => handleMeasurementUpdate('shirt', 'length', text)}
                  placeholder="28"
                  keyboardType="numeric"
                />
                {errors.shirtLength && (
                  <Text style={styles.errorText}>{errors.shirtLength}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Custom Measurements for Pant */}
        {itemType === 'pant' && isCustomSize && (
          <View style={styles.measurementsContainer}>
            <Text style={styles.measurementsTitle}>
              {getLocalizedText('measurements', language)}
            </Text>
            
            <View style={styles.measurementRow}>
              <View style={styles.measurementInput}>
                <Text style={styles.measurementLabel}>
                  {getLocalizedText('pant_waist', language)} *
                </Text>
                <TextInput
                  style={[styles.textInput, errors.pantWaist ? styles.inputError : null]}
                  value={item.measurements?.waist || ''}
                  onChangeText={(text) => handleMeasurementUpdate('pant', 'waist', text)}
                  placeholder="32"
                  keyboardType="numeric"
                />
                {errors.pantWaist && (
                  <Text style={styles.errorText}>{errors.pantWaist}</Text>
                )}
              </View>
              
              <View style={styles.measurementInput}>
                <Text style={styles.measurementLabel}>
                  {getLocalizedText('pant_length', language)} *
                </Text>
                <TextInput
                  style={[styles.textInput, errors.pantLength ? styles.inputError : null]}
                  value={item.measurements?.length || ''}
                  onChangeText={(text) => handleMeasurementUpdate('pant', 'length', text)}
                  placeholder="32"
                  keyboardType="numeric"
                />
                {errors.pantLength && (
                  <Text style={styles.errorText}>{errors.pantLength}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Quantity */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('quantity', language)} *
          </Text>
          <TextInput
            style={[styles.textInput, errors[`${itemType}Quantity`] ? styles.inputError : null]}
            value={item.quantity.toString()}
            onChangeText={(text) => handleItemUpdate(itemType, 'quantity', parseInt(text) || 0)}
            placeholder="1"
            keyboardType="numeric"
          />
          {errors[`${itemType}Quantity`] && (
            <Text style={styles.errorText}>{errors[`${itemType}Quantity`]}</Text>
          )}
        </View>

        {/* Status */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('status', language)} *
          </Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowStatusPickers(prev => ({ ...prev, [itemType]: !prev[itemType] }))}
          >
            <Text style={styles.pickerButtonText}>
              {getLocalizedText(`status_${item.status}`, language)}
            </Text>
            <Text style={styles.pickerArrow}>{showStatusPickers[itemType] ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showStatusPickers[itemType] && (
            <View style={styles.pickerContainer}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.pickerOption,
                    item.status === status && styles.pickerOptionSelected
                  ]}
                  onPress={() => {
                    handleItemUpdate(itemType, 'status', status);
                    setShowStatusPickers(prev => ({ ...prev, [itemType]: false }));
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    item.status === status && styles.pickerOptionTextSelected
                  ]}>
                    {getLocalizedText(`status_${status}`, language)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Allocation Dates */}
        {item.status !== 'pending' && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {getLocalizedText('allocation_date', language)}
              </Text>
              <TextInput
                style={styles.textInput}
                value={item.allocationDate || ''}
                onChangeText={(text) => handleItemUpdate(itemType, 'allocationDate', text)}
                placeholder={getLocalizedText('dd_mm_yyyy', language)}
              />
            </View>

            {item.status === 'delivered' && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  {getLocalizedText('delivery_date', language)}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={item.deliveryDate || ''}
                  onChangeText={(text) => handleItemUpdate(itemType, 'deliveryDate', text)}
                  placeholder={getLocalizedText('dd_mm_yyyy', language)}
                />
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderAdditionalItemsSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {getLocalizedText('additional_items', language)}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Alert.alert(
              'Select Item',
              'Choose additional uniform item',
              ADDITIONAL_ITEMS.map(item => ({
                text: item,
                onPress: () => addAdditionalItem(item)
              })).concat([{ text: 'Cancel', style: 'cancel' }])
            );
          }}
        >
          <Text style={styles.addButtonText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {uniformData.uniformItems.additionalItems.map((item, index) => (
        <View key={index} style={styles.additionalItemCard}>
          <View style={styles.additionalItemHeader}>
            <Text style={styles.additionalItemTitle}>{item.type}</Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeAdditionalItem(index)}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.additionalItemRow}>
            <View style={styles.additionalItemInput}>
              <Text style={styles.label}>Size</Text>
              <TextInput
                style={styles.textInput}
                value={item.size}
                onChangeText={(text) => {
                  const updatedItems = [...uniformData.uniformItems.additionalItems];
                  updatedItems[index].size = text;
                  setUniformData(prev => ({
                    ...prev,
                    uniformItems: { ...prev.uniformItems, additionalItems: updatedItems }
                  }));
                }}
                placeholder="Size"
              />
            </View>

            <View style={styles.additionalItemInput}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.textInput}
                value={item.quantity.toString()}
                onChangeText={(text) => {
                  const updatedItems = [...uniformData.uniformItems.additionalItems];
                  updatedItems[index].quantity = parseInt(text) || 0;
                  setUniformData(prev => ({
                    ...prev,
                    uniformItems: { ...prev.uniformItems, additionalItems: updatedItems }
                  }));
                }}
                placeholder="1"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('uniform_management_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('uniform_management_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderEmployeeDetailsSection()}
        {renderUniformItemSection('shirt', getLocalizedText('shirt_details', language), SHIRT_SIZES)}
        {renderUniformItemSection('pant', getLocalizedText('pant_details', language), PANT_SIZES)}
        {renderUniformItemSection('shoes', getLocalizedText('shoe_details', language), SHOE_SIZES)}
        {renderAdditionalItemsSection()}
        
        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={goToPreviousStep}>
          <Text style={styles.cancelButtonText}>
            {getLocalizedText('cancel', language)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.draftButton} onPress={handleSaveDraft}>
          <Text style={styles.draftButtonText}>
            {getLocalizedText('save_draft', language)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>
            {getLocalizedText('submit', language)}
          </Text>
        </TouchableOpacity>
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
  },
  sectionContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
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
  textInputDisabled: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
    color: '#757575',
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  infoGrid: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
    textAlign: 'right',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#212121',
    flex: 1,
  },
  pickerArrow: {
    fontSize: 14,
    color: '#757575',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 200,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#212121',
  },
  pickerOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '500',
  },
  measurementsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  measurementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  measurementRow: {
    flexDirection: 'row',
    gap: 16,
  },
  measurementInput: {
    flex: 1,
  },
  measurementLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  additionalItemCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  additionalItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  additionalItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  removeButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  additionalItemRow: {
    flexDirection: 'row',
    gap: 16,
  },
  additionalItemInput: {
    flex: 1,
  },
  spacer: {
    height: 100,
  },
  actions: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '500',
  },
  draftButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  draftButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});