/**
 * Address Details Screen - Current and permanent address collection
 * 
 * Features:
 * - Current address form
 * - Permanent address form (with same as current option)
 * - Address validation and formatting
 * - PIN code-based city/state auto-fill
 * - Address proof upload capability
 * - GPS location capture option
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import UI components
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';

// Import types
import type { TextInputHandler, Address, NavigationProp, RouteProp } from '../../../types/common';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    aadhaarData: { address: '123 Main Street, City, State - 123456' }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    address_title: 'Address Details',
    address_subtitle: 'Please provide your current and permanent addresses',
    current_address: 'Current Address',
    permanent_address: 'Permanent Address',
    same_as_current: 'Same as Current Address',
    address_line_1: 'Address Line 1',
    address_line_2: 'Address Line 2 (Optional)',
    landmark: 'Landmark (Optional)',
    city: 'City',
    state: 'State',
    pincode: 'PIN Code',
    country: 'Country',
    address_proof: 'Address Proof',
    upload_proof: 'Upload Address Proof',
    use_current_location: 'Use Current Location',
    continue: 'Continue',
    skip: 'Skip for Now',
    required_field: 'This field is required',
    invalid_pincode: 'Please enter a valid 6-digit PIN code',
    location_permission: 'Location permission required',
    fetching_location: 'Getting current location...',
    location_error: 'Unable to get location',
    auto_filled: 'Auto-filled from Aadhaar',
    
    // Placeholder texts
    enter_address_line_1: 'House/Flat No, Street Name',
    enter_address_line_2: 'Area, Colony',
    enter_landmark: 'Near landmark',
    enter_city: 'Enter city name',
    enter_state: 'Enter state name',
    enter_pincode: '123456',
    
    // Address proof types
    electricity_bill: 'Electricity Bill',
    gas_bill: 'Gas Bill',
    bank_statement: 'Bank Statement',
    rental_agreement: 'Rental Agreement',
    property_tax: 'Property Tax Receipt',
    voter_id: 'Voter ID',
    driving_license: 'Driving License',
    passport: 'Passport',
  };
  return texts[key] || key;
};

interface AddressData {
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface AddressDetailsData {
  currentAddress: AddressData;
  permanentAddress: AddressData;
  sameAsCurrent: boolean;
  addressProofType: string;
  addressProofUri?: string;
  timestamp: string;
}

const ADDRESS_PROOF_TYPES = [
  'electricity_bill', 'gas_bill', 'bank_statement', 'rental_agreement',
  'property_tax', 'voter_id', 'driving_license', 'passport'
];

// Mock PIN code database
const PIN_CODE_DATA: { [key: string]: { city: string; state: string } } = {
  '560001': { city: 'Bangalore', state: 'Karnataka' },
  '560002': { city: 'Bangalore', state: 'Karnataka' },
  '560100': { city: 'Bangalore', state: 'Karnataka' },
  '400001': { city: 'Mumbai', state: 'Maharashtra' },
  '110001': { city: 'New Delhi', state: 'Delhi' },
  '600001': { city: 'Chennai', state: 'Tamil Nadu' },
  '700001': { city: 'Kolkata', state: 'West Bengal' },
  '500001': { city: 'Hyderabad', state: 'Telangana' },
};

export default function AddressDetailsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [addressData, setAddressData] = useState<AddressDetailsData>({
    currentAddress: {
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    permanentAddress: {
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    sameAsCurrent: false,
    addressProofType: '',
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showProofTypePicker, setShowProofTypePicker] = useState(false);

  useEffect(() => {
    loadSavedData();
    prefillFromAadhaar();
  }, []);

  useEffect(() => {
    // Auto-copy current address to permanent when toggle is enabled
    if (addressData.sameAsCurrent) {
      setAddressData(prev => ({
        ...prev,
        permanentAddress: { ...prev.currentAddress },
      }));
    }
  }, [addressData.sameAsCurrent, addressData.currentAddress]);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`address_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setAddressData(data);
      }
    } catch (error) {
      console.error('Failed to load saved address data:', error);
    }
  };

  const prefillFromAadhaar = () => {
    if (userData?.aadhaarData?.address) {
      // Parse Aadhaar address and try to auto-fill
      const aadhaarAddress = userData.aadhaarData.address;
      // This is a simplified parsing - in real implementation, use proper address parsing
      setAddressData(prev => ({
        ...prev,
        currentAddress: {
          ...prev.currentAddress,
          addressLine1: aadhaarAddress.split(',')[0] || '',
        },
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate current address
    if (!addressData.currentAddress.addressLine1.trim()) {
      newErrors.currentAddressLine1 = getLocalizedText('required_field', language);
    }
    if (!addressData.currentAddress.city.trim()) {
      newErrors.currentCity = getLocalizedText('required_field', language);
    }
    if (!addressData.currentAddress.state.trim()) {
      newErrors.currentState = getLocalizedText('required_field', language);
    }
    if (!addressData.currentAddress.pincode.trim()) {
      newErrors.currentPincode = getLocalizedText('required_field', language);
    } else if (!/^\d{6}$/.test(addressData.currentAddress.pincode)) {
      newErrors.currentPincode = getLocalizedText('invalid_pincode', language);
    }

    // Validate permanent address (if different from current)
    if (!addressData.sameAsCurrent) {
      if (!addressData.permanentAddress.addressLine1.trim()) {
        newErrors.permanentAddressLine1 = getLocalizedText('required_field', language);
      }
      if (!addressData.permanentAddress.city.trim()) {
        newErrors.permanentCity = getLocalizedText('required_field', language);
      }
      if (!addressData.permanentAddress.state.trim()) {
        newErrors.permanentState = getLocalizedText('required_field', language);
      }
      if (!addressData.permanentAddress.pincode.trim()) {
        newErrors.permanentPincode = getLocalizedText('required_field', language);
      } else if (!/^\d{6}$/.test(addressData.permanentAddress.pincode)) {
        newErrors.permanentPincode = getLocalizedText('invalid_pincode', language);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddressChange = (
    type: 'currentAddress' | 'permanentAddress',
    field: keyof AddressData,
    value: string
  ) => {
    setAddressData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));

    // Clear error when user starts typing
    const errorKey = `${type}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }

    // Auto-fill city and state based on PIN code
    if (field === 'pincode' && value.length === 6) {
      const locationData = PIN_CODE_DATA[value];
      if (locationData) {
        setAddressData(prev => ({
          ...prev,
          [type]: {
            ...prev[type],
            city: locationData.city,
            state: locationData.state,
          },
        }));
      }
    }
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    
    try {
      // Simulate getting current location
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock location data
      const mockLocation = {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Electronic City, Bangalore, Karnataka',
      };

      setAddressData(prev => ({
        ...prev,
        currentAddress: {
          ...prev.currentAddress,
          addressLine1: mockLocation.address,
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560100',
          latitude: mockLocation.latitude,
          longitude: mockLocation.longitude,
        },
      }));

      Alert.alert('Success', 'Location captured successfully!');
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(
        getLocalizedText('location_error', language),
        'Please enter address manually or check location permissions.'
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: AddressDetailsData = {
      ...addressData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `address_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ addressData: finalData });
    } catch (error) {
      console.error('Failed to save address data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Address Details?',
      'Address details are required for statutory compliance and service delivery.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            addressData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderAddressForm = (
    type: 'currentAddress' | 'permanentAddress',
    title: string,
    disabled: boolean = false
  ) => {
    const address = addressData[type];
    const errorPrefix = type === 'currentAddress' ? 'current' : 'permanent';

    return (
      <Card title={title} variant="outlined" margin={8}>
        {/* Address Line 1 */}
        <Input
          label={getLocalizedText('address_line_1', language)}
          value={address.addressLine1}
          onChangeText={(text: string) => handleAddressChange(type, 'addressLine1', text)}
          error={errors[`${errorPrefix}AddressLine1`]}
          required
          placeholder={getLocalizedText('enter_address_line_1', language)}
          editable={!disabled}
        />

        {/* Address Line 2 */}
        <Input
          label={getLocalizedText('address_line_2', language)}
          value={address.addressLine2}
          onChangeText={(text: string) => handleAddressChange(type, 'addressLine2', text)}
          placeholder={getLocalizedText('enter_address_line_2', language)}
          editable={!disabled}
        />

        {/* Landmark */}
        <Input
          label={getLocalizedText('landmark', language)}
          value={address.landmark}
          onChangeText={(text: string) => handleAddressChange(type, 'landmark', text)}
          placeholder={getLocalizedText('enter_landmark', language)}
          editable={!disabled}
        />

        {/* PIN Code */}
        <Input
          label={getLocalizedText('pincode', language)}
          value={address.pincode}
          onChangeText={(text: string) => handleAddressChange(type, 'pincode', text)}
          error={errors[`${errorPrefix}Pincode`]}
          required
          placeholder={getLocalizedText('enter_pincode', language)}
          keyboardType="numeric"
          maxLength={6}
          editable={!disabled}
        />

        {/* City */}
        <Input
          label={getLocalizedText('city', language)}
          value={address.city}
          onChangeText={(text: string) => handleAddressChange(type, 'city', text)}
          error={errors[`${errorPrefix}City`]}
          required
          placeholder={getLocalizedText('enter_city', language)}
          editable={!disabled}
        />

        {/* State */}
        <Input
          label={getLocalizedText('state', language)}
          value={address.state}
          onChangeText={(text: string) => handleAddressChange(type, 'state', text)}
          error={errors[`${errorPrefix}State`]}
          required
          placeholder={getLocalizedText('enter_state', language)}
          editable={!disabled}
        />

        {/* Country */}
        <Input
          label={getLocalizedText('country', language)}
          value={address.country}
          onChangeText={(text: string) => handleAddressChange(type, 'country', text)}
          required
          editable={!disabled}
        />

        {/* Current Location Button (only for current address) */}
        {type === 'currentAddress' && !disabled && (
          <View style={styles.locationButtonContainer}>
            <Button
              title={isGettingLocation ? getLocalizedText('fetching_location', language) : getLocalizedText('use_current_location', language)}
              onPress={getCurrentLocation}
              variant="outline"
              size="small"
              loading={isGettingLocation}
              icon={<Text style={styles.locationIcon}>📍</Text>}
            />
          </View>
        )}
      </Card>
    );
  };

  const renderAddressProofSection = () => (
    <Card title={getLocalizedText('address_proof', language)} variant="outlined" margin={8}>
      {/* Address Proof Type */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('address_proof', language)}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowProofTypePicker(!showProofTypePicker)}
        >
          <Text style={[styles.pickerButtonText, !addressData.addressProofType && styles.placeholderText]}>
            {addressData.addressProofType 
              ? getLocalizedText(addressData.addressProofType, language)
              : 'Select address proof type'
            }
          </Text>
          <Text style={styles.pickerArrow}>{showProofTypePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showProofTypePicker && (
          <View style={styles.pickerContainer}>
            {ADDRESS_PROOF_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.pickerOption,
                  addressData.addressProofType === type && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  setAddressData(prev => ({ ...prev, addressProofType: type }));
                  setShowProofTypePicker(false);
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  addressData.addressProofType === type && styles.pickerOptionTextSelected
                ]}>
                  {getLocalizedText(type, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Upload Button */}
      <Button
        title={getLocalizedText('upload_proof', language)}
        onPress={() => Alert.alert('Upload', 'Document upload functionality will be implemented')}
        variant="outline"
        size="medium"
        icon={<Text style={styles.uploadIcon}>📄</Text>}
      />
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('address_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('address_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Address */}
        {renderAddressForm(
          'currentAddress',
          getLocalizedText('current_address', language)
        )}

        {/* Same as Current Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleLabel}>
              {getLocalizedText('same_as_current', language)}
            </Text>
            <Switch
              value={addressData.sameAsCurrent}
              onValueChange={(value) => setAddressData(prev => ({ ...prev, sameAsCurrent: value }))}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={addressData.sameAsCurrent ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Permanent Address */}
        {renderAddressForm(
          'permanentAddress',
          getLocalizedText('permanent_address', language),
          addressData.sameAsCurrent
        )}

        {/* Address Proof */}
        {renderAddressProofSection()}
        
        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={getLocalizedText('skip', language)}
          onPress={handleSkip}
          variant="text"
          size="medium"
        />
        
        <Button
          title={getLocalizedText('continue', language)}
          onPress={handleContinue}
          variant="primary"
          size="medium"
          disabled={!addressData.currentAddress.addressLine1 || !addressData.currentAddress.city}
        />
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
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  toggleContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 8,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
  },
  locationButtonContainer: {
    marginTop: 12,
  },
  locationIcon: {
    fontSize: 16,
  },
  uploadIcon: {
    fontSize: 16,
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
  },
  placeholderText: {
    color: '#999',
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
  spacer: {
    height: 100,
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
});
