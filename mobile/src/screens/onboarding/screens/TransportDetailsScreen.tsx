/**
 * Transport Details Screen - Vehicle and transportation information
 * 
 * Features:
 * - Vehicle information and documentation
 * - Transportation preferences and options
 * - Route planning and optimization
 * - Fuel and mileage tracking
 * - Driver license and permits
 * - Insurance and registration details
 * - Emergency roadside contacts
 * - Public transport preferences
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import UI components
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';

// Temporary mock implementations
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      firstName: 'John',
      lastName: 'Doe',
    },
    addressData: {
      currentAddress: {
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001'
      }
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    transport_title: 'Transport Details',
    transport_subtitle: 'Please provide your transportation information',
    
    // Sections
    vehicle_information: 'Vehicle Information',
    license_permits: 'License & Permits',
    insurance_registration: 'Insurance & Registration',
    transport_preferences: 'Transport Preferences',
    route_planning: 'Route Planning',
    fuel_tracking: 'Fuel & Mileage',
    emergency_contacts: 'Emergency Roadside Assistance',
    public_transport: 'Public Transport Options',
    
    // Vehicle Information
    own_vehicle: 'Own Vehicle',
    vehicle_type: 'Vehicle Type',
    vehicle_make: 'Make/Brand',
    vehicle_model: 'Model',
    vehicle_year: 'Year',
    vehicle_color: 'Color',
    registration_number: 'Registration Number',
    chassis_number: 'Chassis Number',
    engine_number: 'Engine Number',
    seating_capacity: 'Seating Capacity',
    
    // Vehicle Types
    two_wheeler: 'Two Wheeler (Bike/Scooter)',
    three_wheeler: 'Three Wheeler (Auto)',
    four_wheeler: 'Four Wheeler (Car)',
    commercial_vehicle: 'Commercial Vehicle',
    heavy_vehicle: 'Heavy Vehicle',
    
    // License & Permits
    driving_license: 'Driving License',
    license_number: 'License Number',
    license_type: 'License Type',
    license_issue_date: 'Issue Date',
    license_expiry_date: 'Expiry Date',
    license_issuing_authority: 'Issuing Authority',
    commercial_permit: 'Commercial Permit',
    permit_number: 'Permit Number',
    permit_validity: 'Permit Validity',
    international_permit: 'International Driving Permit',
    
    // License Types
    learners_license: "Learner's License",
    permanent_license: 'Permanent License',
    commercial_license: 'Commercial License',
    heavy_vehicle_license: 'Heavy Vehicle License',
    
    // Insurance & Registration
    vehicle_insurance: 'Vehicle Insurance',
    insurance_provider: 'Insurance Provider',
    policy_number: 'Policy Number',
    insurance_type: 'Insurance Type',
    insurance_expiry: 'Insurance Expiry',
    premium_amount: 'Premium Amount',
    registration_validity: 'Registration Validity',
    pollution_certificate: 'Pollution Under Control Certificate',
    puc_expiry: 'PUC Expiry Date',
    fitness_certificate: 'Fitness Certificate',
    fitness_expiry: 'Fitness Certificate Expiry',
    
    // Insurance Types
    third_party: 'Third Party',
    comprehensive: 'Comprehensive',
    zero_depreciation: 'Zero Depreciation',
    
    // Transport Preferences
    primary_transport: 'Primary Mode of Transport',
    backup_transport: 'Backup Transport Option',
    daily_commute_distance: 'Daily Commute Distance (km)',
    preferred_routes: 'Preferred Routes',
    avoid_toll_roads: 'Avoid Toll Roads',
    avoid_highways: 'Avoid Highways',
    prefer_shortest_route: 'Prefer Shortest Route',
    prefer_fastest_route: 'Prefer Fastest Route',
    
    // Transport Modes
    own_bike: 'Own Bike/Scooter',
    own_car: 'Own Car',
    company_vehicle: 'Company Vehicle',
    public_bus: 'Public Bus',
    metro_train: 'Metro/Train',
    auto_rickshaw: 'Auto Rickshaw',
    taxi_cab: 'Taxi/Cab',
    ride_sharing: 'Ride Sharing (Uber/Ola)',
    walking: 'Walking',
    cycling: 'Cycling',
    
    // Route Planning
    home_to_office_route: 'Home to Office Route',
    alternative_routes: 'Alternative Routes',
    traffic_timings: 'Traffic Timings',
    peak_hours: 'Peak Hours to Avoid',
    estimated_travel_time: 'Estimated Travel Time',
    route_landmarks: 'Route Landmarks',
    parking_availability: 'Parking Availability',
    parking_cost: 'Parking Cost (per day)',
    
    // Fuel & Mileage
    fuel_type: 'Fuel Type',
    fuel_efficiency: 'Fuel Efficiency (km/l)',
    monthly_fuel_budget: 'Monthly Fuel Budget',
    preferred_fuel_stations: 'Preferred Fuel Stations',
    fuel_card: 'Fuel Card',
    maintenance_schedule: 'Maintenance Schedule',
    last_service_date: 'Last Service Date',
    next_service_due: 'Next Service Due',
    service_center: 'Preferred Service Center',
    
    // Fuel Types
    petrol: 'Petrol',
    diesel: 'Diesel',
    cng: 'CNG',
    lpg: 'LPG',
    electric: 'Electric',
    hybrid: 'Hybrid',
    
    // Emergency Contacts
    roadside_assistance: 'Roadside Assistance',
    insurance_helpline: 'Insurance Helpline',
    emergency_contact_name: 'Emergency Contact Name',
    emergency_contact_phone: 'Emergency Contact Phone',
    emergency_contact_relation: 'Relationship',
    towing_service: 'Preferred Towing Service',
    mechanic_contact: 'Trusted Mechanic',
    
    // Public Transport
    bus_routes: 'Nearby Bus Routes',
    metro_stations: 'Nearest Metro Stations',
    train_stations: 'Nearest Train Stations',
    auto_stands: 'Auto Rickshaw Stands',
    taxi_services: 'Local Taxi Services',
    transport_pass: 'Transport Pass/Card',
    monthly_pass_cost: 'Monthly Pass Cost',
    
    // Additional Information
    vehicle_modifications: 'Vehicle Modifications',
    special_requirements: 'Special Requirements',
    accessibility_needs: 'Accessibility Needs',
    car_pooling: 'Car Pooling Interest',
    bike_pooling: 'Bike Pooling Interest',
    travel_allowance: 'Travel Allowance Applicable',
    
    // Actions
    add_vehicle: 'Add Vehicle',
    add_route: 'Add Route',
    add_contact: 'Add Emergency Contact',
    save_transport_details: 'Save Transport Details',
    continue: 'Continue',
    skip: 'Skip for Now',
    
    // Modals
    add_vehicle_info: 'Add Vehicle Information',
    add_route_info: 'Add Route Information',
    add_emergency_contact: 'Add Emergency Contact',
    vehicle_name: 'Vehicle Name/Identifier',
    route_name: 'Route Name',
    route_description: 'Route Description',
    distance: 'Distance (km)',
    travel_time: 'Travel Time (minutes)',
    contact_name: 'Contact Name',
    contact_phone: 'Contact Phone',
    contact_type: 'Contact Type',
    
    // Contact Types
    family_member: 'Family Member',
    friend: 'Friend',
    colleague: 'Colleague',
    mechanic: 'Mechanic',
    insurance_agent: 'Insurance Agent',
    towing_service_contact: 'Towing Service',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_registration: 'Please enter a valid registration number',
    invalid_license: 'Please enter a valid license number',
    invalid_phone: 'Please enter a valid phone number',
    invalid_distance: 'Please enter a valid distance',
    invalid_amount: 'Please enter a valid amount',
    
    // Placeholders
    enter_make: 'e.g., Honda, Maruti, TVS',
    enter_model: 'e.g., City, Swift, Jupiter',
    enter_year: 'e.g., 2020',
    enter_color: 'e.g., White, Black, Red',
    enter_registration: 'e.g., KA01AB1234',
    enter_license_number: 'e.g., KL01234567890',
    enter_policy_number: 'Insurance policy number',
    enter_amount: 'Amount in ₹',
    enter_distance: 'Distance in km',
    enter_time: 'Time in minutes',
    enter_phone: '+91 12345 67890',
    enter_landmarks: 'e.g., Near City Mall, After Traffic Signal',
    select_date: 'Select date',
    
    // Help texts
    vehicle_help: 'Add your vehicles for work-related travel',
    license_help: 'Valid driving license is required for vehicle operation',
    insurance_help: 'Insurance details for coverage and claims',
    route_help: 'Plan optimal routes for daily commute',
    fuel_help: 'Track fuel expenses and efficiency',
    emergency_help: 'Important contacts for roadside emergencies',
    public_transport_help: 'Alternative transport options and details',
    
    // Confirmation messages
    skip_transport_confirmation: 'Transport details help in route planning and reimbursements. Are you sure you want to skip?',
    delete_vehicle_confirmation: 'Are you sure you want to remove this vehicle?',
    delete_route_confirmation: 'Are you sure you want to remove this route?',
    delete_contact_confirmation: 'Are you sure you want to remove this contact?',
  };
  return texts[key] || key;
};

interface Vehicle {
  id: string;
  name: string;
  type: string;
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  chassisNumber: string;
  engineNumber: string;
  seatingCapacity: number;
  fuelType: string;
  fuelEfficiency: number;
}

interface License {
  number: string;
  type: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
}

interface Insurance {
  provider: string;
  policyNumber: string;
  type: string;
  expiryDate: string;
  premiumAmount: number;
}

interface Route {
  id: string;
  name: string;
  description: string;
  distance: number;
  travelTime: number;
  landmarks: string;
  isPrimary: boolean;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  type: string;
  relationship: string;
}

interface TransportDetailsData {
  hasVehicle: boolean;
  vehicles: Vehicle[];
  license: License;
  insurance: Insurance;
  preferences: {
    primaryTransport: string;
    backupTransport: string;
    dailyCommuteDistance: number;
    avoidTollRoads: boolean;
    avoidHighways: boolean;
    preferShortestRoute: boolean;
    preferFastestRoute: boolean;
  };
  routes: Route[];
  fuelTracking: {
    monthlyBudget: number;
    preferredStations: string[];
    hasCard: boolean;
    lastServiceDate: string;
    nextServiceDue: string;
    serviceCenter: string;
  };
  emergencyContacts: EmergencyContact[];
  publicTransport: {
    busRoutes: string[];
    metroStations: string[];
    trainStations: string[];
    autoStands: string[];
    hasTransportPass: boolean;
    monthlyPassCost: number;
  };
  additional: {
    modifications: string;
    specialRequirements: string;
    accessibilityNeeds: string;
    carPoolingInterest: boolean;
    bikePoolingInterest: boolean;
    travelAllowance: boolean;
  };
  timestamp: string;
}

const VEHICLE_TYPES = ['two_wheeler', 'three_wheeler', 'four_wheeler', 'commercial_vehicle', 'heavy_vehicle'];
const LICENSE_TYPES = ['learners_license', 'permanent_license', 'commercial_license', 'heavy_vehicle_license'];
const INSURANCE_TYPES = ['third_party', 'comprehensive', 'zero_depreciation'];
const TRANSPORT_MODES = ['own_bike', 'own_car', 'company_vehicle', 'public_bus', 'metro_train', 'auto_rickshaw', 'taxi_cab', 'ride_sharing', 'walking', 'cycling'];
const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid'];
const CONTACT_TYPES = ['family_member', 'friend', 'colleague', 'mechanic', 'insurance_agent', 'towing_service_contact'];

export default function TransportDetailsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [transportData, setTransportData] = useState<TransportDetailsData>({
    hasVehicle: false,
    vehicles: [],
    license: {
      number: '',
      type: '',
      issueDate: '',
      expiryDate: '',
      issuingAuthority: '',
    },
    insurance: {
      provider: '',
      policyNumber: '',
      type: '',
      expiryDate: '',
      premiumAmount: 0,
    },
    preferences: {
      primaryTransport: '',
      backupTransport: '',
      dailyCommuteDistance: 0,
      avoidTollRoads: false,
      avoidHighways: false,
      preferShortestRoute: true,
      preferFastestRoute: false,
    },
    routes: [],
    fuelTracking: {
      monthlyBudget: 0,
      preferredStations: [],
      hasCard: false,
      lastServiceDate: '',
      nextServiceDue: '',
      serviceCenter: '',
    },
    emergencyContacts: [],
    publicTransport: {
      busRoutes: [],
      metroStations: [],
      trainStations: [],
      autoStands: [],
      hasTransportPass: false,
      monthlyPassCost: 0,
    },
    additional: {
      modifications: '',
      specialRequirements: '',
      accessibilityNeeds: '',
      carPoolingInterest: false,
      bikePoolingInterest: false,
      travelAllowance: false,
    },
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showModal, setShowModal] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>({});
  const [showPicker, setShowPicker] = useState<string | null>(null);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`transport_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setTransportData(data);
      }
    } catch (error) {
      console.error('Failed to load saved transport data:', error);
    }
  };

  const handleSectionChange = (section: string, field: string, value: any) => {
    setTransportData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof TransportDetailsData] as Record<string, any>),
        [field]: value,
      } as any,
    }));
  };

  const handleSimpleChange = (field: string, value: any) => {
    setTransportData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addItem = (type: string, item: any) => {
    const id = Date.now().toString();
    const itemWithId = { ...item, id };
    
    setTransportData(prev => ({
      ...prev,
      [type]: [...prev[type as keyof TransportDetailsData] as any[], itemWithId],
    }));
    
    setShowModal(null);
    setModalData({});
  };

  const removeItem = (type: string, id: string) => {
    setTransportData(prev => ({
      ...prev,
      [type]: (prev[type as keyof TransportDetailsData] as any[]).filter(item => item.id !== id),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Vehicle validations
    if (transportData.hasVehicle && transportData.vehicles.length > 0) {
      transportData.vehicles.forEach((vehicle, index) => {
        if (vehicle.registrationNumber && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicle.registrationNumber)) {
          newErrors[`vehicle.${index}.registrationNumber`] = getLocalizedText('invalid_registration', language);
        }
      });
    }

    // License validations
    if (transportData.license.number && transportData.license.number.length < 10) {
      newErrors['license.number'] = getLocalizedText('invalid_license', language);
    }

    // Distance validations
    if (transportData.preferences.dailyCommuteDistance < 0 || transportData.preferences.dailyCommuteDistance > 500) {
      newErrors['preferences.dailyCommuteDistance'] = getLocalizedText('invalid_distance', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: TransportDetailsData = {
      ...transportData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `transport_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ transportData: finalData });
    } catch (error) {
      console.error('Failed to save transport data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Transport Details?',
      getLocalizedText('skip_transport_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            transportData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderVehicleSection = () => (
    <Card title={getLocalizedText('vehicle_information', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('vehicle_help', language)}
      </Text>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('own_vehicle', language)}
        </Text>
        <Switch
          value={transportData.hasVehicle}
          onValueChange={(value) => handleSimpleChange('hasVehicle', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.hasVehicle ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      {transportData.hasVehicle && (
        <>
          {/* Add Vehicle Button */}
          <Button
            title={getLocalizedText('add_vehicle', language)}
            onPress={() => setShowModal('vehicle')}
            variant="outline"
            size="small"
            icon={<Text style={styles.addIcon}>+</Text>}
          />

          {/* Existing Vehicles */}
          {transportData.vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>
                  {vehicle.make} {vehicle.model} ({vehicle.year})
                </Text>
                <TouchableOpacity
                  onPress={() => removeItem('vehicles', vehicle.id)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.itemDetail}>
                {getLocalizedText(vehicle.type, language)} - {vehicle.color}
              </Text>
              <Text style={styles.itemDetail}>
                Registration: {vehicle.registrationNumber}
              </Text>
              {vehicle.fuelType && (
                <Text style={styles.itemDetail}>
                  Fuel: {getLocalizedText(vehicle.fuelType, language)} 
                  {vehicle.fuelEfficiency > 0 && ` (${vehicle.fuelEfficiency} km/l)`}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
    </Card>
  );

  const renderLicenseSection = () => (
    <Card title={getLocalizedText('license_permits', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('license_help', language)}
      </Text>

      <Input
        label={getLocalizedText('license_number', language)}
        value={transportData.license.number}
        onChangeText={(text) => handleSectionChange('license', 'number', text.toUpperCase())}
        error={errors['license.number']}
        placeholder={getLocalizedText('enter_license_number', language)}
        autoCapitalize="characters"
      />

      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('license_type', language)}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPicker(showPicker === 'licenseType' ? null : 'licenseType')}
        >
          <Text style={[styles.pickerButtonText, !transportData.license.type && styles.placeholderText]}>
            {transportData.license.type 
              ? getLocalizedText(transportData.license.type, language)
              : 'Select license type'
            }
          </Text>
          <Text style={styles.pickerArrow}>{showPicker === 'licenseType' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showPicker === 'licenseType' && (
          <View style={styles.pickerContainer}>
            {LICENSE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.pickerOption}
                onPress={() => {
                  handleSectionChange('license', 'type', type);
                  setShowPicker(null);
                }}
              >
                <Text style={styles.pickerOptionText}>
                  {getLocalizedText(type, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Input
            label={getLocalizedText('license_issue_date', language)}
            value={transportData.license.issueDate}
            onChangeText={(text) => handleSectionChange('license', 'issueDate', text)}
            placeholder={getLocalizedText('select_date', language)}
          />
        </View>
        <View style={styles.halfWidth}>
          <Input
            label={getLocalizedText('license_expiry_date', language)}
            value={transportData.license.expiryDate}
            onChangeText={(text) => handleSectionChange('license', 'expiryDate', text)}
            placeholder={getLocalizedText('select_date', language)}
          />
        </View>
      </View>

      <Input
        label={getLocalizedText('license_issuing_authority', language)}
        value={transportData.license.issuingAuthority}
        onChangeText={(text) => handleSectionChange('license', 'issuingAuthority', text)}
        placeholder="e.g., RTO Karnataka"
      />
    </Card>
  );

  const renderPreferencesSection = () => (
    <Card title={getLocalizedText('transport_preferences', language)} variant="outlined" margin={8}>
      {/* Primary & Backup Transport */}
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('primary_transport', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPicker(showPicker === 'primaryTransport' ? null : 'primaryTransport')}
            >
              <Text style={[styles.pickerButtonText, !transportData.preferences.primaryTransport && styles.placeholderText]}>
                {transportData.preferences.primaryTransport 
                  ? getLocalizedText(transportData.preferences.primaryTransport, language)
                  : 'Select primary mode'
                }
              </Text>
              <Text style={styles.pickerArrow}>{showPicker === 'primaryTransport' ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showPicker === 'primaryTransport' && (
              <View style={styles.pickerContainer}>
                {TRANSPORT_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={styles.pickerOption}
                    onPress={() => {
                      handleSectionChange('preferences', 'primaryTransport', mode);
                      setShowPicker(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>
                      {getLocalizedText(mode, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.halfWidth}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('backup_transport', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPicker(showPicker === 'backupTransport' ? null : 'backupTransport')}
            >
              <Text style={[styles.pickerButtonText, !transportData.preferences.backupTransport && styles.placeholderText]}>
                {transportData.preferences.backupTransport 
                  ? getLocalizedText(transportData.preferences.backupTransport, language)
                  : 'Select backup mode'
                }
              </Text>
              <Text style={styles.pickerArrow}>{showPicker === 'backupTransport' ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showPicker === 'backupTransport' && (
              <View style={styles.pickerContainer}>
                {TRANSPORT_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={styles.pickerOption}
                    onPress={() => {
                      handleSectionChange('preferences', 'backupTransport', mode);
                      setShowPicker(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>
                      {getLocalizedText(mode, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Daily Commute Distance */}
      <Input
        label={getLocalizedText('daily_commute_distance', language)}
        value={transportData.preferences.dailyCommuteDistance.toString()}
        onChangeText={(text) => handleSectionChange('preferences', 'dailyCommuteDistance', parseFloat(text) || 0)}
        error={errors['preferences.dailyCommuteDistance']}
        placeholder={getLocalizedText('enter_distance', language)}
        keyboardType="numeric"
      />

      {/* Route Preferences */}
      <Text style={styles.sectionTitle}>Route Preferences</Text>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('avoid_toll_roads', language)}
        </Text>
        <Switch
          value={transportData.preferences.avoidTollRoads}
          onValueChange={(value) => handleSectionChange('preferences', 'avoidTollRoads', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.preferences.avoidTollRoads ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('avoid_highways', language)}
        </Text>
        <Switch
          value={transportData.preferences.avoidHighways}
          onValueChange={(value) => handleSectionChange('preferences', 'avoidHighways', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.preferences.avoidHighways ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('prefer_shortest_route', language)}
        </Text>
        <Switch
          value={transportData.preferences.preferShortestRoute}
          onValueChange={(value) => handleSectionChange('preferences', 'preferShortestRoute', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.preferences.preferShortestRoute ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('prefer_fastest_route', language)}
        </Text>
        <Switch
          value={transportData.preferences.preferFastestRoute}
          onValueChange={(value) => handleSectionChange('preferences', 'preferFastestRoute', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.preferences.preferFastestRoute ? '#4CAF50' : '#f4f3f4'}
        />
      </View>
    </Card>
  );

  const renderRoutePlanningSection = () => (
    <Card title={getLocalizedText('route_planning', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('route_help', language)}
      </Text>

      {/* Add Route Button */}
      <Button
        title={getLocalizedText('add_route', language)}
        onPress={() => setShowModal('route')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Routes */}
      {transportData.routes.map((route) => (
        <View key={route.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{route.name}</Text>
            {route.isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>Primary</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => removeItem('routes', route.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDetail}>{route.description}</Text>
          <Text style={styles.itemDetail}>
            Distance: {route.distance}km | Time: {route.travelTime} mins
          </Text>
          {route.landmarks && (
            <Text style={styles.itemDetail}>
              Landmarks: {route.landmarks}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );

  const renderEmergencyContactsSection = () => (
    <Card title={getLocalizedText('emergency_contacts', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('emergency_help', language)}
      </Text>

      {/* Add Contact Button */}
      <Button
        title={getLocalizedText('add_contact', language)}
        onPress={() => setShowModal('contact')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Contacts */}
      {transportData.emergencyContacts.map((contact) => (
        <View key={contact.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{contact.name}</Text>
            <TouchableOpacity
              onPress={() => removeItem('emergencyContacts', contact.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDetail}>
            {getLocalizedText(contact.type, language)} - {contact.relationship}
          </Text>
          <Text style={styles.itemDetail}>Phone: {contact.phone}</Text>
        </View>
      ))}
    </Card>
  );

  const renderAdditionalInfoSection = () => (
    <Card title="Additional Information" variant="outlined" margin={8}>
      {/* Pooling Interest */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('car_pooling', language)}
        </Text>
        <Switch
          value={transportData.additional.carPoolingInterest}
          onValueChange={(value) => handleSectionChange('additional', 'carPoolingInterest', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.additional.carPoolingInterest ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('bike_pooling', language)}
        </Text>
        <Switch
          value={transportData.additional.bikePoolingInterest}
          onValueChange={(value) => handleSectionChange('additional', 'bikePoolingInterest', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.additional.bikePoolingInterest ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('travel_allowance', language)}
        </Text>
        <Switch
          value={transportData.additional.travelAllowance}
          onValueChange={(value) => handleSectionChange('additional', 'travelAllowance', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={transportData.additional.travelAllowance ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      {/* Special Requirements */}
      <Input
        label={getLocalizedText('special_requirements', language)}
        value={transportData.additional.specialRequirements}
        onChangeText={(text) => handleSectionChange('additional', 'specialRequirements', text)}
        placeholder="Any special transport requirements"
        multiline
        numberOfLines={3}
      />

      <Input
        label={getLocalizedText('accessibility_needs', language)}
        value={transportData.additional.accessibilityNeeds}
        onChangeText={(text) => handleSectionChange('additional', 'accessibilityNeeds', text)}
        placeholder="Any accessibility requirements"
        multiline
        numberOfLines={3}
      />
    </Card>
  );

  const renderModals = () => (
    <>
      {/* Vehicle Modal */}
      <Modal
        visible={showModal === 'vehicle'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollView}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {getLocalizedText('add_vehicle_info', language)}
              </Text>
              
              <Input
                label={getLocalizedText('vehicle_name', language)}
                value={modalData.name || ''}
                onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
                placeholder="e.g., My Bike, Office Car"
              />
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  {getLocalizedText('vehicle_type', language)}
                </Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowPicker(showPicker === 'vehicleType' ? null : 'vehicleType')}
                >
                  <Text style={[styles.pickerButtonText, !modalData.type && styles.placeholderText]}>
                    {modalData.type 
                      ? getLocalizedText(modalData.type, language)
                      : 'Select vehicle type'
                    }
                  </Text>
                  <Text style={styles.pickerArrow}>{showPicker === 'vehicleType' ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                
                {showPicker === 'vehicleType' && (
                  <View style={styles.pickerContainer}>
                    {VEHICLE_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.pickerOption}
                        onPress={() => {
                          setModalData(prev => ({ ...prev, type }));
                          setShowPicker(null);
                        }}
                      >
                        <Text style={styles.pickerOptionText}>
                          {getLocalizedText(type, language)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label={getLocalizedText('vehicle_make', language)}
                    value={modalData.make || ''}
                    onChangeText={(text) => setModalData(prev => ({ ...prev, make: text }))}
                    placeholder={getLocalizedText('enter_make', language)}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label={getLocalizedText('vehicle_model', language)}
                    value={modalData.model || ''}
                    onChangeText={(text) => setModalData(prev => ({ ...prev, model: text }))}
                    placeholder={getLocalizedText('enter_model', language)}
                  />
                </View>
              </View>
              
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label={getLocalizedText('vehicle_year', language)}
                    value={modalData.year?.toString() || ''}
                    onChangeText={(text) => setModalData(prev => ({ ...prev, year: parseInt(text) || 0 }))}
                    placeholder={getLocalizedText('enter_year', language)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label={getLocalizedText('vehicle_color', language)}
                    value={modalData.color || ''}
                    onChangeText={(text) => setModalData(prev => ({ ...prev, color: text }))}
                    placeholder={getLocalizedText('enter_color', language)}
                  />
                </View>
              </View>
              
              <Input
                label={getLocalizedText('registration_number', language)}
                value={modalData.registrationNumber || ''}
                onChangeText={(text) => setModalData(prev => ({ ...prev, registrationNumber: text.toUpperCase() }))}
                placeholder={getLocalizedText('enter_registration', language)}
                autoCapitalize="characters"
              />
              
              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowModal(null)}
                  variant="text"
                  size="medium"
                />
                <Button
                  title="Add"
                  onPress={() => addItem('vehicles', modalData)}
                  variant="primary"
                  size="medium"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Route Modal */}
      <Modal
        visible={showModal === 'route'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('add_route_info', language)}
            </Text>
            
            <Input
              label={getLocalizedText('route_name', language)}
              value={modalData.name || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
              placeholder="e.g., Home to Office, Primary Route"
            />
            
            <Input
              label={getLocalizedText('route_description', language)}
              value={modalData.description || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, description: text }))}
              placeholder="Brief route description"
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label={getLocalizedText('distance', language)}
                  value={modalData.distance?.toString() || ''}
                  onChangeText={(text) => setModalData(prev => ({ ...prev, distance: parseFloat(text) || 0 }))}
                  placeholder={getLocalizedText('enter_distance', language)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label={getLocalizedText('travel_time', language)}
                  value={modalData.travelTime?.toString() || ''}
                  onChangeText={(text) => setModalData(prev => ({ ...prev, travelTime: parseInt(text) || 0 }))}
                  placeholder={getLocalizedText('enter_time', language)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <Input
              label={getLocalizedText('route_landmarks', language)}
              value={modalData.landmarks || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, landmarks: text }))}
              placeholder={getLocalizedText('enter_landmarks', language)}
              multiline
              numberOfLines={2}
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowModal(null)}
                variant="text"
                size="medium"
              />
              <Button
                title="Add"
                onPress={() => addItem('routes', { ...modalData, isPrimary: false })}
                variant="primary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Emergency Contact Modal */}
      <Modal
        visible={showModal === 'contact'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('add_emergency_contact', language)}
            </Text>
            
            <Input
              label={getLocalizedText('contact_name', language)}
              value={modalData.name || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
              placeholder="Contact name"
            />
            
            <Input
              label={getLocalizedText('contact_phone', language)}
              value={modalData.phone || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, phone: text }))}
              placeholder={getLocalizedText('enter_phone', language)}
              keyboardType="phone-pad"
            />
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {getLocalizedText('contact_type', language)}
              </Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPicker(showPicker === 'contactType' ? null : 'contactType')}
              >
                <Text style={[styles.pickerButtonText, !modalData.type && styles.placeholderText]}>
                  {modalData.type 
                    ? getLocalizedText(modalData.type, language)
                    : 'Select contact type'
                  }
                </Text>
                <Text style={styles.pickerArrow}>{showPicker === 'contactType' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              
              {showPicker === 'contactType' && (
                <View style={styles.pickerContainer}>
                  {CONTACT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.pickerOption}
                      onPress={() => {
                        setModalData(prev => ({ ...prev, type }));
                        setShowPicker(null);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>
                        {getLocalizedText(type, language)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            
            <Input
              label="Relationship"
              value={modalData.relationship || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, relationship: text }))}
              placeholder="e.g., Father, Mechanic, Agent"
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowModal(null)}
                variant="text"
                size="medium"
              />
              <Button
                title="Add"
                onPress={() => addItem('emergencyContacts', modalData)}
                variant="primary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('transport_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('transport_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vehicle Information */}
        {renderVehicleSection()}

        {/* License & Permits */}
        {transportData.hasVehicle && renderLicenseSection()}

        {/* Transport Preferences */}
        {renderPreferencesSection()}

        {/* Route Planning */}
        {renderRoutePlanningSection()}

        {/* Emergency Contacts */}
        {renderEmergencyContactsSection()}

        {/* Additional Information */}
        {renderAdditionalInfoSection()}

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
        />
      </View>

      {/* Modals */}
      {renderModals()}
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
  helpText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginTop: 20,
    marginBottom: 12,
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
  pickerOptionText: {
    fontSize: 16,
    color: '#212121',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#424242',
    flex: 1,
  },
  addIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  primaryBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  primaryText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemDetail: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: '90%',
    width: '90%',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
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
