/**
 * Uniform & Inventory Capture Screen - Enhanced sizing and allocation tracking
 * 
 * Features:
 * - Comprehensive uniform sizing entry (Shirt, Pant, Shoe, Cap)
 * - Detailed measurement fields (Neck, Chest, Waist, Inseam, Height)
 * - Site-specific uniform allocation tracking
 * - Deduction vs. Non-deduction toggle based on branch rules
 * - Auto-insert based on admin panel configurations
 * - Inventory management per site
 * - Uniform issuance tracking and accountability
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
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

// Mock implementations for dependencies
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      firstName: 'John',
      lastName: 'Doe',
      employeeId: 'EMP001',
      gender: 'Male'
    },
    workDetails: {
      branchCode: 'BLR001',
      siteCode: 'SITE_BLR_001',
      department: 'Facility Management',
      designation: 'Field Technician',
      supervisorName: 'Manager Name',
      siteRules: {
        uniformMandatory: true,
        uniformDeduction: true, // Based on site policy
        uniformAllowance: 2000, // Annual allowance
        safetyGearMandatory: true
      }
    },
    addressData: {
      currentAddress: {
        city: 'Bangalore',
        state: 'Karnataka'
      }
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    uniform_title: 'Uniform & Inventory',
    uniform_subtitle: 'Please provide your uniform sizing and preferences',
    
    // Sizing Categories
    uniform_sizing: 'Uniform Sizing',
    measurements: 'Body Measurements',
    safety_gear: 'Safety Gear',
    accessories: 'Accessories',
    inventory_allocation: 'Inventory Allocation',
    
    // Uniform Types
    shirt_size: 'Shirt Size',
    pant_size: 'Pant Size',
    shoe_size: 'Shoe Size',
    cap_size: 'Cap Size',
    jacket_size: 'Jacket Size',
    overall_size: 'Overall Size',
    apron_size: 'Apron Size',
    
    // Body Measurements
    height: 'Height (cm)',
    weight: 'Weight (kg)',
    chest: 'Chest (inches)',
    waist: 'Waist (inches)',
    neck: 'Neck (inches)',
    shoulder: 'Shoulder (inches)',
    sleeve_length: 'Sleeve Length (inches)',
    inseam: 'Inseam (inches)',
    
    // Safety Gear
    helmet_size: 'Safety Helmet Size',
    glove_size: 'Glove Size',
    boot_size: 'Safety Boot Size',
    goggles: 'Safety Goggles',
    mask: 'Face Mask',
    vest: 'Safety Vest',
    
    // Size Options
    size_xs: 'XS',
    size_s: 'S',
    size_m: 'M',
    size_l: 'L',
    size_xl: 'XL',
    size_xxl: 'XXL',
    size_xxxl: 'XXXL',
    
    // Shoe Sizes
    shoe_size_6: '6',
    shoe_size_7: '7',
    shoe_size_8: '8',
    shoe_size_9: '9',
    shoe_size_10: '10',
    shoe_size_11: '11',
    shoe_size_12: '12',
    
    // Deduction Options
    deduction_policy: 'Uniform Deduction Policy',
    deduction_applicable: 'Uniform costs will be deducted from salary',
    no_deduction: 'Uniform provided free of cost',
    allowance_basis: 'Annual uniform allowance: ₹{amount}',
    
    // Inventory Management
    allocated_items: 'Allocated Items',
    item_code: 'Item Code',
    item_description: 'Item Description',
    quantity: 'Quantity',
    issue_date: 'Issue Date',
    return_date: 'Expected Return Date',
    condition: 'Condition',
    
    // Item Conditions
    new_condition: 'New',
    good_condition: 'Good',
    fair_condition: 'Fair',
    replacement_needed: 'Replacement Needed',
    
    // Site Configuration
    site_specific_rules: 'Site-Specific Rules',
    mandatory_items: 'Mandatory Items',
    optional_items: 'Optional Items',
    seasonal_items: 'Seasonal Items',
    
    // Uniform Categories
    formal_uniform: 'Formal Uniform',
    casual_uniform: 'Casual Uniform',
    safety_uniform: 'Safety Uniform',
    seasonal_uniform: 'Seasonal Uniform',
    special_occasion: 'Special Occasion',
    
    // Colors and Styles
    color_preference: 'Color Preference',
    navy_blue: 'Navy Blue',
    black: 'Black',
    grey: 'Grey',
    white: 'White',
    khaki: 'Khaki',
    
    // Fitting Preferences
    fitting_preference: 'Fitting Preference',
    regular_fit: 'Regular Fit',
    slim_fit: 'Slim Fit',
    loose_fit: 'Loose Fit',
    
    // Special Requirements
    special_requirements: 'Special Requirements',
    maternity_wear: 'Maternity Wear',
    religious_considerations: 'Religious Considerations',
    medical_considerations: 'Medical Considerations',
    accessibility_needs: 'Accessibility Needs',
    
    // Accountability
    uniform_accountability: 'Uniform Accountability',
    employee_responsibility: 'I understand that I am responsible for the care and maintenance of issued uniforms',
    loss_damage_policy: 'I agree to report any loss or damage immediately',
    return_policy: 'I will return all uniforms upon separation from the company',
    
    // Actions
    save_measurements: 'Save Measurements',
    request_fitting: 'Request Fitting Session',
    submit_requirements: 'Submit Requirements',
    continue: 'Continue',
    
    // Validation Messages
    measurement_required: 'Please enter all required measurements',
    size_required: 'Please select uniform sizes',
    acknowledgment_required: 'Please acknowledge uniform policies',
    
    // Help Text
    measurement_help: 'Accurate measurements ensure proper fit',
    size_guide_help: 'Refer to size guide for accurate selection',
    deduction_help: 'Deduction policy varies by site and employee level',
    
    // Approval Workflow
    supervisor_approval: 'Requires Supervisor Approval',
    hr_approval: 'Requires HR Approval',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    
    // Inventory Status
    in_stock: 'In Stock',
    out_of_stock: 'Out of Stock',
    on_order: 'On Order',
    discontinued: 'Discontinued',
    
    // Timeline
    immediate_issue: 'Immediate Issue',
    next_batch: 'Next Batch (7-10 days)',
    custom_order: 'Custom Order (15-20 days)',
    
    // Cost Information
    total_cost: 'Total Uniform Cost',
    monthly_deduction: 'Monthly Deduction',
    one_time_deduction: 'One-time Deduction',
    no_cost: 'No Cost to Employee',
  };
  
  return texts[key] || key;
};

interface UniformSizing {
  shirt: string;
  pant: string;
  shoe: string;
  cap: string;
  jacket: string;
  overall: string;
  apron: string;
}

interface BodyMeasurements {
  height: number;
  weight: number;
  chest: number;
  waist: number;
  neck: number;
  shoulder: number;
  sleeveLength: number;
  inseam: number;
}

interface SafetyGear {
  helmet: string;
  gloves: string;
  boots: string;
  goggles: boolean;
  mask: boolean;
  vest: string;
}

interface UniformItem {
  id: string;
  itemCode: string;
  description: string;
  category: string;
  size: string;
  color: string;
  quantity: number;
  issueDate?: string;
  returnDate?: string;
  condition: string;
  mandatory: boolean;
  cost: number;
  deductible: boolean;
}

interface SiteConfiguration {
  branchCode: string;
  siteCode: string;
  uniformDeduction: boolean;
  uniformAllowance: number;
  mandatoryItems: string[];
  optionalItems: string[];
  seasonalItems: string[];
  approvalRequired: boolean;
  customSizing: boolean;
}

interface UniformData {
  sizing: UniformSizing;
  measurements: BodyMeasurements;
  safetyGear: SafetyGear;
  allocatedItems: UniformItem[];
  preferences: {
    colorPreference: string;
    fittingPreference: string;
    specialRequirements: string[];
  };
  siteConfiguration: SiteConfiguration;
  deductionAcknowledged: boolean;
  policyAcknowledged: boolean;
  supervisorApproval?: boolean;
  totalCost: number;
  monthlyDeduction: number;
  timestamp: string;
}

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const SHOE_SIZES = ['6', '7', '8', '9', '10', '11', '12'];
const COLOR_OPTIONS = ['Navy Blue', 'Black', 'Grey', 'White', 'Khaki'];
const FITTING_OPTIONS = ['Regular Fit', 'Slim Fit', 'Loose Fit'];
const CONDITION_OPTIONS = ['New', 'Good', 'Fair', 'Replacement Needed'];

export default function UniformInventoryScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [uniformData, setUniformData] = useState<UniformData>({
    sizing: {
      shirt: '',
      pant: '',
      shoe: '',
      cap: '',
      jacket: '',
      overall: '',
      apron: '',
    },
    measurements: {
      height: 0,
      weight: 0,
      chest: 0,
      waist: 0,
      neck: 0,
      shoulder: 0,
      sleeveLength: 0,
      inseam: 0,
    },
    safetyGear: {
      helmet: '',
      gloves: '',
      boots: '',
      goggles: false,
      mask: false,
      vest: '',
    },
    allocatedItems: [],
    preferences: {
      colorPreference: '',
      fittingPreference: 'Regular Fit',
      specialRequirements: [],
    },
    siteConfiguration: {
      branchCode: '',
      siteCode: '',
      uniformDeduction: true,
      uniformAllowance: 0,
      mandatoryItems: [],
      optionalItems: [],
      seasonalItems: [],
      approvalRequired: false,
      customSizing: false,
    },
    deductionAcknowledged: false,
    policyAcknowledged: false,
    totalCost: 0,
    monthlyDeduction: 0,
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState<Partial<UniformItem>>({});

  useEffect(() => {
    loadSiteConfiguration();
    loadPredefinedItems();
  }, []);

  useEffect(() => {
    calculateCosts();
  }, [uniformData.allocatedItems, uniformData.siteConfiguration]);

  const loadSiteConfiguration = async () => {
    try {
      // Mock site configuration loading
      const siteConfig: SiteConfiguration = {
        branchCode: userData?.workDetails?.branchCode || '',
        siteCode: userData?.workDetails?.siteCode || '',
        uniformDeduction: userData?.workDetails?.siteRules?.uniformDeduction || true,
        uniformAllowance: userData?.workDetails?.siteRules?.uniformAllowance || 2000,
        mandatoryItems: ['SHIRT_001', 'PANT_001', 'SHOE_001', 'CAP_001', 'VEST_001'],
        optionalItems: ['JACKET_001', 'APRON_001'],
        seasonalItems: ['SWEATER_001', 'RAINCOAT_001'],
        approvalRequired: true,
        customSizing: true,
      };
      
      setUniformData(prev => ({ ...prev, siteConfiguration: siteConfig }));
    } catch (error) {
      console.error('Failed to load site configuration:', error);
    }
  };

  const loadPredefinedItems = () => {
    // Mock predefined uniform items based on role and site
    const predefinedItems: UniformItem[] = [
      {
        id: '1',
        itemCode: 'SHIRT_001',
        description: 'Formal Shirt - Navy Blue',
        category: 'Formal Uniform',
        size: 'M',
        color: 'Navy Blue',
        quantity: 2,
        condition: 'New',
        mandatory: true,
        cost: 800,
        deductible: true,
      },
      {
        id: '2',
        itemCode: 'PANT_001',
        description: 'Formal Trouser - Navy Blue',
        category: 'Formal Uniform',
        size: 'M',
        color: 'Navy Blue',
        quantity: 2,
        condition: 'New',
        mandatory: true,
        cost: 1200,
        deductible: true,
      },
      {
        id: '3',
        itemCode: 'SHOE_001',
        description: 'Formal Shoes - Black',
        category: 'Formal Uniform',
        size: '9',
        color: 'Black',
        quantity: 1,
        condition: 'New',
        mandatory: true,
        cost: 1500,
        deductible: true,
      },
      {
        id: '4',
        itemCode: 'VEST_001',
        description: 'Safety Vest - High Visibility',
        category: 'Safety Uniform',
        size: 'L',
        color: 'Orange',
        quantity: 1,
        condition: 'New',
        mandatory: true,
        cost: 500,
        deductible: false,
      },
    ];
    
    setUniformData(prev => ({ ...prev, allocatedItems: predefinedItems }));
  };

  const calculateCosts = () => {
    const totalCost = uniformData.allocatedItems
      .filter(item => item.deductible)
      .reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    
    const monthlyDeduction = uniformData.siteConfiguration.uniformDeduction 
      ? Math.round(totalCost / 12) 
      : 0;
    
    setUniformData(prev => ({
      ...prev,
      totalCost,
      monthlyDeduction,
    }));
  };

  const handleSizingChange = (field: keyof UniformSizing, value: string) => {
    setUniformData(prev => ({
      ...prev,
      sizing: { ...prev.sizing, [field]: value },
    }));
  };

  const handleMeasurementChange = (field: keyof BodyMeasurements, value: string) => {
    setUniformData(prev => ({
      ...prev,
      measurements: { ...prev.measurements, [field]: parseFloat(value) || 0 },
    }));
  };

  const handleSafetyGearChange = (field: keyof SafetyGear, value: string | boolean) => {
    setUniformData(prev => ({
      ...prev,
      safetyGear: { ...prev.safetyGear, [field]: value },
    }));
  };

  const addUniformItem = () => {
    if (!newItem.itemCode || !newItem.description) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    const item: UniformItem = {
      id: Date.now().toString(),
      itemCode: newItem.itemCode!,
      description: newItem.description!,
      category: newItem.category || 'General',
      size: newItem.size || 'M',
      color: newItem.color || 'Navy Blue',
      quantity: newItem.quantity || 1,
      condition: newItem.condition || 'New',
      mandatory: newItem.mandatory || false,
      cost: newItem.cost || 0,
      deductible: newItem.deductible || false,
    };
    
    setUniformData(prev => ({
      ...prev,
      allocatedItems: [...prev.allocatedItems, item],
    }));
    
    setNewItem({});
    setShowItemModal(false);
  };

  const removeUniformItem = (id: string) => {
    setUniformData(prev => ({
      ...prev,
      allocatedItems: prev.allocatedItems.filter(item => item.id !== id),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Check required sizing
    if (!uniformData.sizing.shirt) {
      newErrors.shirtSize = getLocalizedText('size_required', language);
    }
    if (!uniformData.sizing.pant) {
      newErrors.pantSize = getLocalizedText('size_required', language);
    }
    if (!uniformData.sizing.shoe) {
      newErrors.shoeSize = getLocalizedText('size_required', language);
    }

    // Check required measurements
    if (!uniformData.measurements.height) {
      newErrors.height = getLocalizedText('measurement_required', language);
    }
    if (!uniformData.measurements.chest) {
      newErrors.chest = getLocalizedText('measurement_required', language);
    }
    if (!uniformData.measurements.waist) {
      newErrors.waist = getLocalizedText('measurement_required', language);
    }

    // Check policy acknowledgment
    if (!uniformData.policyAcknowledged) {
      newErrors.policy = getLocalizedText('acknowledgment_required', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const finalData: UniformData = {
      ...uniformData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `uniform_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ uniformData: finalData });
    } catch (error) {
      console.error('Failed to save uniform data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const renderSizingSection = () => (
    <Card title={getLocalizedText('uniform_sizing', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('size_guide_help', language)}
      </Text>

      {/* Basic Uniform Sizes */}
      <View style={styles.sizingGrid}>
        <View style={styles.sizingItem}>
          <Text style={styles.sizingLabel}>
            {getLocalizedText('shirt_size', language)}
          </Text>
          <TouchableOpacity
            style={styles.sizeButton}
            onPress={() => setShowPicker(showPicker === 'shirt' ? null : 'shirt')}
          >
            <Text style={styles.sizeButtonText}>
              {uniformData.sizing.shirt || 'Select Size'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          
          {showPicker === 'shirt' && (
            <View style={styles.pickerContainer}>
              {SIZE_OPTIONS.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={styles.pickerOption}
                  onPress={() => {
                    handleSizingChange('shirt', size);
                    setShowPicker(null);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {errors.shirtSize && (
            <Text style={styles.errorText}>{errors.shirtSize}</Text>
          )}
        </View>

        <View style={styles.sizingItem}>
          <Text style={styles.sizingLabel}>
            {getLocalizedText('pant_size', language)}
          </Text>
          <TouchableOpacity
            style={styles.sizeButton}
            onPress={() => setShowPicker(showPicker === 'pant' ? null : 'pant')}
          >
            <Text style={styles.sizeButtonText}>
              {uniformData.sizing.pant || 'Select Size'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          
          {showPicker === 'pant' && (
            <View style={styles.pickerContainer}>
              {SIZE_OPTIONS.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={styles.pickerOption}
                  onPress={() => {
                    handleSizingChange('pant', size);
                    setShowPicker(null);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {errors.pantSize && (
            <Text style={styles.errorText}>{errors.pantSize}</Text>
          )}
        </View>

        <View style={styles.sizingItem}>
          <Text style={styles.sizingLabel}>
            {getLocalizedText('shoe_size', language)}
          </Text>
          <TouchableOpacity
            style={styles.sizeButton}
            onPress={() => setShowPicker(showPicker === 'shoe' ? null : 'shoe')}
          >
            <Text style={styles.sizeButtonText}>
              {uniformData.sizing.shoe || 'Select Size'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          
          {showPicker === 'shoe' && (
            <View style={styles.pickerContainer}>
              {SHOE_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={styles.pickerOption}
                  onPress={() => {
                    handleSizingChange('shoe', size);
                    setShowPicker(null);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {errors.shoeSize && (
            <Text style={styles.errorText}>{errors.shoeSize}</Text>
          )}
        </View>

        <View style={styles.sizingItem}>
          <Text style={styles.sizingLabel}>
            {getLocalizedText('cap_size', language)}
          </Text>
          <TouchableOpacity
            style={styles.sizeButton}
            onPress={() => setShowPicker(showPicker === 'cap' ? null : 'cap')}
          >
            <Text style={styles.sizeButtonText}>
              {uniformData.sizing.cap || 'Select Size'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          
          {showPicker === 'cap' && (
            <View style={styles.pickerContainer}>
              {SIZE_OPTIONS.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={styles.pickerOption}
                  onPress={() => {
                    handleSizingChange('cap', size);
                    setShowPicker(null);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Card>
  );

  const renderMeasurementsSection = () => (
    <Card title={getLocalizedText('measurements', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('measurement_help', language)}
      </Text>

      <View style={styles.measurementGrid}>
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('height', language)}
              value={uniformData.measurements.height.toString()}
              onChangeText={(text) => handleMeasurementChange('height', text)}
              placeholder="170"
              keyboardType="numeric"
              error={errors.height}
            />
          </View>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('weight', language)}
              value={uniformData.measurements.weight.toString()}
              onChangeText={(text) => handleMeasurementChange('weight', text)}
              placeholder="70"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('chest', language)}
              value={uniformData.measurements.chest.toString()}
              onChangeText={(text) => handleMeasurementChange('chest', text)}
              placeholder="38"
              keyboardType="numeric"
              error={errors.chest}
            />
          </View>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('waist', language)}
              value={uniformData.measurements.waist.toString()}
              onChangeText={(text) => handleMeasurementChange('waist', text)}
              placeholder="32"
              keyboardType="numeric"
              error={errors.waist}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('neck', language)}
              value={uniformData.measurements.neck.toString()}
              onChangeText={(text) => handleMeasurementChange('neck', text)}
              placeholder="15"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('inseam', language)}
              value={uniformData.measurements.inseam.toString()}
              onChangeText={(text) => handleMeasurementChange('inseam', text)}
              placeholder="30"
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>
    </Card>
  );

  const renderAllocatedItems = () => (
    <Card title={getLocalizedText('allocated_items', language)} variant="outlined" margin={8}>
      <Button
        title="Add Item"
        onPress={() => setShowItemModal(true)}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {uniformData.allocatedItems.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemCode}>{item.itemCode}</Text>
              <Text style={styles.itemDescription}>{item.description}</Text>
              <Text style={styles.itemDetails}>
                Size: {item.size} | Color: {item.color} | Qty: {item.quantity}
              </Text>
              {item.mandatory && (
                <Text style={styles.mandatoryBadge}>Mandatory</Text>
              )}
            </View>
            
            <View style={styles.itemActions}>
              <Text style={styles.itemCost}>₹{item.cost * item.quantity}</Text>
              {!item.mandatory && (
                <TouchableOpacity
                  onPress={() => removeUniformItem(item.id)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <View style={styles.itemMeta}>
            <Text style={styles.itemCategory}>{item.category}</Text>
            <Text style={[
              styles.deductibleStatus,
              { color: item.deductible ? '#F44336' : '#4CAF50' }
            ]}>
              {item.deductible ? 'Deductible' : 'Free'}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );

  const renderDeductionPolicy = () => (
    <Card title={getLocalizedText('deduction_policy', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('deduction_help', language)}
      </Text>

      <View style={styles.policySection}>
        <View style={styles.policyRow}>
          <Switch
            value={!uniformData.siteConfiguration.uniformDeduction}
            disabled={true} // Site-controlled
          />
          <Text style={styles.policyText}>
            {uniformData.siteConfiguration.uniformDeduction
              ? getLocalizedText('deduction_applicable', language)
              : getLocalizedText('no_deduction', language)
            }
          </Text>
        </View>

        {uniformData.siteConfiguration.uniformAllowance > 0 && (
          <Text style={styles.allowanceText}>
            {getLocalizedText('allowance_basis', language)
              .replace('{amount}', uniformData.siteConfiguration.uniformAllowance.toString())}
          </Text>
        )}

        {/* Cost Breakdown */}
        <View style={styles.costBreakdown}>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>
              {getLocalizedText('total_cost', language)}:
            </Text>
            <Text style={styles.costValue}>₹{uniformData.totalCost}</Text>
          </View>
          
          {uniformData.siteConfiguration.uniformDeduction && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>
                {getLocalizedText('monthly_deduction', language)}:
              </Text>
              <Text style={styles.costValue}>₹{uniformData.monthlyDeduction}</Text>
            </View>
          )}
        </View>

        {/* Acknowledgment */}
        <View style={styles.acknowledgmentSection}>
          <View style={styles.acknowledgmentRow}>
            <Switch
              value={uniformData.deductionAcknowledged}
              onValueChange={(value) => setUniformData(prev => ({ 
                ...prev, 
                deductionAcknowledged: value 
              }))}
            />
            <Text style={styles.acknowledgmentText}>
              I acknowledge the uniform deduction policy
            </Text>
          </View>

          <View style={styles.acknowledgmentRow}>
            <Switch
              value={uniformData.policyAcknowledged}
              onValueChange={(value) => setUniformData(prev => ({ 
                ...prev, 
                policyAcknowledged: value 
              }))}
            />
            <Text style={styles.acknowledgmentText}>
              {getLocalizedText('employee_responsibility', language)}
            </Text>
          </View>
          
          {errors.policy && (
            <Text style={styles.errorText}>{errors.policy}</Text>
          )}
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('uniform_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('uniform_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderSizingSection()}
        {renderMeasurementsSection()}
        {renderAllocatedItems()}
        {renderDeductionPolicy()}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={getLocalizedText('request_fitting', language)}
          onPress={() => Alert.alert('Fitting Session', 'Fitting session request submitted')}
          variant="text"
          size="medium"
        />
        
        <Button
          title={getLocalizedText('continue', language)}
          onPress={handleSubmit}
          variant="primary"
          size="medium"
        />
      </View>

      {/* Add Item Modal */}
      <Modal
        visible={showItemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Uniform Item</Text>
            
            <Input
              label={getLocalizedText('item_code', language)}
              value={newItem.itemCode || ''}
              onChangeText={(text) => setNewItem(prev => ({ ...prev, itemCode: text }))}
              placeholder="ITEM_001"
            />
            
            <Input
              label={getLocalizedText('item_description', language)}
              value={newItem.description || ''}
              onChangeText={(text) => setNewItem(prev => ({ ...prev, description: text }))}
              placeholder="Item description"
            />
            
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label={getLocalizedText('quantity', language)}
                  value={newItem.quantity?.toString() || '1'}
                  onChangeText={(text) => setNewItem(prev => ({ ...prev, quantity: parseInt(text) || 1 }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label="Cost (₹)"
                  value={newItem.cost?.toString() || '0'}
                  onChangeText={(text) => setNewItem(prev => ({ ...prev, cost: parseFloat(text) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowItemModal(false)}
                variant="text"
                size="medium"
              />
              <Button
                title="Add"
                onPress={addUniformItem}
                variant="primary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>
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
  sizingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sizingItem: {
    flex: 1,
    minWidth: '45%',
  },
  sizingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 8,
  },
  sizeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  sizeButtonText: {
    fontSize: 14,
    color: '#212121',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#757575',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 150,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#212121',
  },
  measurementGrid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
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
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  itemDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginTop: 2,
  },
  itemDetails: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  mandatoryBadge: {
    fontSize: 10,
    color: '#F44336',
    fontWeight: '600',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  itemActions: {
    alignItems: 'flex-end',
  },
  itemCost: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  removeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  removeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemCategory: {
    fontSize: 12,
    color: '#757575',
  },
  deductibleStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  policySection: {
    marginTop: 8,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  policyText: {
    fontSize: 14,
    color: '#424242',
    marginLeft: 12,
    flex: 1,
  },
  allowanceText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 8,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  costBreakdown: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
    color: '#424242',
  },
  costValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
  },
  acknowledgmentSection: {
    marginTop: 16,
  },
  acknowledgmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  acknowledgmentText: {
    fontSize: 13,
    color: '#424242',
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 20,
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
