/**
 * Statutory Details Screen - Legal and compliance information collection
 * 
 * Features:
 * - PF (Provident Fund) details and preferences
 * - ESI (Employee State Insurance) information
 * - Tax declarations and preferences
 * - UAN (Universal Account Number) for PF
 * - Previous employment PF transfer
 * - Tax saving investment declarations
 * - Form 16 and tax history
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
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '1234-5678-9012'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    statutory_title: 'Statutory Details',
    statutory_subtitle: 'Please provide your statutory compliance information',
    
    // Sections
    pf_details: 'Provident Fund (PF) Details',
    esi_details: 'Employee State Insurance (ESI)',
    tax_declarations: 'Tax Declarations',
    previous_employment: 'Previous Employment Details',
    investment_declarations: 'Investment Declarations',
    
    // PF Section
    pf_applicable: 'PF Applicable',
    pf_number: 'PF Number',
    uan_number: 'UAN (Universal Account Number)',
    previous_pf_number: 'Previous PF Number',
    pf_nomination: 'PF Nomination Details',
    pf_nominee_name: 'Nominee Name',
    pf_nominee_relation: 'Relationship',
    pf_nominee_share: 'Share Percentage',
    pf_nominee_date_of_birth: 'Nominee Date of Birth',
    transfer_pf: 'Transfer PF from Previous Employer',
    previous_employer_name: 'Previous Employer Name',
    previous_employer_pf: 'Previous Employer PF Code',
    
    // ESI Section
    esi_applicable: 'ESI Applicable',
    esi_number: 'ESI Number',
    esi_dispensary: 'Preferred ESI Dispensary',
    esi_nomination: 'ESI Nomination Details',
    esi_nominee_name: 'Nominee Name',
    esi_nominee_relation: 'Relationship',
    
    // Tax Section
    tax_regime: 'Tax Regime',
    old_tax_regime: 'Old Tax Regime',
    new_tax_regime: 'New Tax Regime',
    previous_employer_salary: 'Previous Employer Salary',
    previous_employer_tax: 'Tax Deducted by Previous Employer',
    form_16_available: 'Form 16 Available from Previous Employer',
    
    // Investment Declarations
    section_80c: 'Section 80C Investments',
    life_insurance: 'Life Insurance Premium',
    ppf: 'PPF (Public Provident Fund)',
    elss: 'ELSS (Equity Linked Savings Scheme)',
    nsc: 'NSC (National Savings Certificate)',
    tax_saving_fd: 'Tax Saving Fixed Deposits',
    home_loan_principal: 'Home Loan Principal',
    section_80d: 'Section 80D - Medical Insurance',
    self_medical_insurance: 'Self & Family Medical Insurance',
    parents_medical_insurance: 'Parents Medical Insurance',
    section_24: 'Section 24 - Home Loan Interest',
    home_loan_interest: 'Home Loan Interest',
    hra_details: 'HRA Details',
    hra_claimed: 'HRA Claimed',
    rent_amount: 'Monthly Rent Amount',
    landlord_name: 'Landlord Name',
    landlord_pan: 'Landlord PAN',
    
    // Professional Tax
    professional_tax: 'Professional Tax',
    pt_applicable: 'Professional Tax Applicable',
    pt_state: 'PT State',
    
    // TDS Details
    tds_details: 'TDS Details',
    previous_tds: 'TDS from Previous Employer',
    other_income: 'Other Income Sources',
    rental_income: 'Rental Income',
    capital_gains: 'Capital Gains',
    interest_income: 'Interest Income',
    
    // Actions
    save_statutory_details: 'Save Statutory Details',
    continue: 'Continue',
    skip: 'Skip for Now',
    calculate_tax: 'Calculate Tax',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_pf_number: 'Please enter a valid PF number',
    invalid_uan: 'Please enter a valid UAN',
    invalid_esi_number: 'Please enter a valid ESI number',
    invalid_pan: 'Please enter a valid PAN number',
    invalid_amount: 'Please enter a valid amount',
    total_percentage_error: 'Total nominee percentage should be 100%',
    
    // Placeholders
    enter_pf_number: 'e.g., HR/BNG/12345/01/2023',
    enter_uan: '12-digit UAN number',
    enter_esi_number: '10-digit ESI number',
    enter_nominee_name: 'Full name of nominee',
    select_relationship: 'Select relationship',
    enter_percentage: '0-100',
    select_date: 'Select date',
    enter_employer_name: 'Previous employer name',
    enter_employer_code: 'PF establishment code',
    enter_dispensary: 'Preferred ESI dispensary',
    enter_amount: 'Amount in ₹',
    enter_landlord_name: 'Landlord full name',
    enter_landlord_pan: 'Landlord PAN number',
    
    // Relationships
    spouse: 'Spouse',
    father: 'Father',
    mother: 'Mother',
    son: 'Son',
    daughter: 'Daughter',
    brother: 'Brother',
    sister: 'Sister',
    
    // States for PT
    maharashtra: 'Maharashtra',
    karnataka: 'Karnataka',
    tamil_nadu: 'Tamil Nadu',
    gujarat: 'Gujarat',
    west_bengal: 'West Bengal',
    delhi: 'Delhi',
    andhra_pradesh: 'Andhra Pradesh',
    telangana: 'Telangana',
    
    // Help texts
    pf_help: 'Provident Fund is mandatory for employees earning more than ₹15,000',
    uan_help: 'UAN is a 12-digit number allotted by EPFO',
    esi_help: 'ESI is applicable for employees earning up to ₹25,000',
    tax_regime_help: 'Choose between old and new tax regime',
    investment_help: 'Declare your tax-saving investments',
    hra_help: 'HRA exemption details for rent payment',
    
    // Confirmation messages
    skip_statutory_confirmation: 'Statutory details are required for compliance. Are you sure you want to skip?',
    tax_calculation_note: 'Tax calculation is indicative and may vary based on actual salary structure',
  };
  return texts[key] || key;
};

interface PFDetails {
  applicable: boolean;
  pfNumber: string;
  uanNumber: string;
  previousPfNumber: string;
  transferFromPrevious: boolean;
  previousEmployerName: string;
  previousEmployerCode: string;
  nominee: {
    name: string;
    relationship: string;
    sharePercentage: number;
    dateOfBirth: string;
  };
}

interface ESIDetails {
  applicable: boolean;
  esiNumber: string;
  preferredDispensary: string;
  nominee: {
    name: string;
    relationship: string;
  };
}

interface TaxDeclarations {
  taxRegime: 'old' | 'new';
  previousEmployerSalary: number;
  previousEmployerTax: number;
  form16Available: boolean;
  investments: {
    lifeInsurance: number;
    ppf: number;
    elss: number;
    nsc: number;
    taxSavingFd: number;
    homeLoanPrincipal: number;
    selfMedicalInsurance: number;
    parentsMedicalInsurance: number;
    homeLoanInterest: number;
  };
  hra: {
    claimed: boolean;
    monthlyRent: number;
    landlordName: string;
    landlordPan: string;
  };
  otherIncome: {
    rentalIncome: number;
    capitalGains: number;
    interestIncome: number;
  };
}

interface ProfessionalTax {
  applicable: boolean;
  state: string;
}

interface StatutoryDetailsData {
  pf: PFDetails;
  esi: ESIDetails;
  tax: TaxDeclarations;
  professionalTax: ProfessionalTax;
  timestamp: string;
}

const RELATIONSHIPS = ['spouse', 'father', 'mother', 'son', 'daughter', 'brother', 'sister'];
const PT_STATES = ['maharashtra', 'karnataka', 'tamil_nadu', 'gujarat', 'west_bengal', 'delhi', 'andhra_pradesh', 'telangana'];

export default function StatutoryDetailsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [statutoryData, setStatutoryData] = useState<StatutoryDetailsData>({
    pf: {
      applicable: true,
      pfNumber: '',
      uanNumber: '',
      previousPfNumber: '',
      transferFromPrevious: false,
      previousEmployerName: '',
      previousEmployerCode: '',
      nominee: {
        name: '',
        relationship: '',
        sharePercentage: 100,
        dateOfBirth: '',
      },
    },
    esi: {
      applicable: true,
      esiNumber: '',
      preferredDispensary: '',
      nominee: {
        name: '',
        relationship: '',
      },
    },
    tax: {
      taxRegime: 'new',
      previousEmployerSalary: 0,
      previousEmployerTax: 0,
      form16Available: false,
      investments: {
        lifeInsurance: 0,
        ppf: 0,
        elss: 0,
        nsc: 0,
        taxSavingFd: 0,
        homeLoanPrincipal: 0,
        selfMedicalInsurance: 0,
        parentsMedicalInsurance: 0,
        homeLoanInterest: 0,
      },
      hra: {
        claimed: false,
        monthlyRent: 0,
        landlordName: '',
        landlordPan: '',
      },
      otherIncome: {
        rentalIncome: 0,
        capitalGains: 0,
        interestIncome: 0,
      },
    },
    professionalTax: {
      applicable: false,
      state: '',
    },
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showRelationshipPicker, setShowRelationshipPicker] = useState<string | null>(null);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [taxCalculation, setTaxCalculation] = useState<any>(null);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`statutory_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setStatutoryData(data);
      }
    } catch (error) {
      console.error('Failed to load saved statutory data:', error);
    }
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    if (section === 'pf.nominee') {
      setStatutoryData(prev => ({
        ...prev,
        pf: {
          ...prev.pf,
          nominee: {
            ...prev.pf.nominee,
            [field]: value,
          },
        },
      }));
    } else if (section === 'esi.nominee') {
      setStatutoryData(prev => ({
        ...prev,
        esi: {
          ...prev.esi,
          nominee: {
            ...prev.esi.nominee,
            [field]: value,
          },
        },
      }));
    } else if (section === 'tax.investments') {
      setStatutoryData(prev => ({
        ...prev,
        tax: {
          ...prev.tax,
          investments: {
            ...prev.tax.investments,
            [field]: value,
          },
        },
      }));
    } else if (section === 'tax.hra') {
      setStatutoryData(prev => ({
        ...prev,
        tax: {
          ...prev.tax,
          hra: {
            ...prev.tax.hra,
            [field]: value,
          },
        },
      }));
    } else if (section === 'tax.otherIncome') {
      setStatutoryData(prev => ({
        ...prev,
        tax: {
          ...prev.tax,
          otherIncome: {
            ...prev.tax.otherIncome,
            [field]: value,
          },
        },
      }));
    } else {
      const keys = section.split('.');
      if (keys.length === 2) {
        setStatutoryData(prev => ({
          ...prev,
          [keys[0]]: {
            ...(prev[keys[0] as keyof StatutoryDetailsData] as Record<string, any>),
            [keys[1]]: value,
          } as any,
        }));
      } else {
        setStatutoryData(prev => ({
          ...prev,
          [section]: {
            ...(prev[section as keyof StatutoryDetailsData] as Record<string, any>),
            [field]: value,
          } as any,
        }));
      }
    }

    // Clear errors
    const errorKey = `${section}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // PF validations
    if (statutoryData.pf.applicable) {
      if (statutoryData.pf.uanNumber && !/^\d{12}$/.test(statutoryData.pf.uanNumber)) {
        newErrors['pf.uanNumber'] = getLocalizedText('invalid_uan', language);
      }
      if (statutoryData.pf.nominee.sharePercentage <= 0 || statutoryData.pf.nominee.sharePercentage > 100) {
        newErrors['pf.nominee.sharePercentage'] = getLocalizedText('total_percentage_error', language);
      }
    }

    // ESI validations
    if (statutoryData.esi.applicable && statutoryData.esi.esiNumber) {
      if (!/^\d{10}$/.test(statutoryData.esi.esiNumber)) {
        newErrors['esi.esiNumber'] = getLocalizedText('invalid_esi_number', language);
      }
    }

    // Tax validations
    if (statutoryData.tax.hra.claimed) {
      if (!statutoryData.tax.hra.landlordName.trim()) {
        newErrors['tax.hra.landlordName'] = getLocalizedText('required_field', language);
      }
      if (statutoryData.tax.hra.monthlyRent > 100000 && !statutoryData.tax.hra.landlordPan.trim()) {
        newErrors['tax.hra.landlordPan'] = getLocalizedText('required_field', language);
      }
      if (statutoryData.tax.hra.landlordPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(statutoryData.tax.hra.landlordPan)) {
        newErrors['tax.hra.landlordPan'] = getLocalizedText('invalid_pan', language);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTax = () => {
    // Mock tax calculation
    const totalInvestments = Object.values(statutoryData.tax.investments).reduce((sum, val) => sum + val, 0);
    const section80cLimit = Math.min(totalInvestments, 150000);
    const medicalInsurance = Math.min(statutoryData.tax.investments.selfMedicalInsurance + statutoryData.tax.investments.parentsMedicalInsurance, 75000);
    
    setTaxCalculation({
      section80c: section80cLimit,
      section80d: medicalInsurance,
      totalDeductions: section80cLimit + medicalInsurance,
      estimatedSavings: (section80cLimit + medicalInsurance) * 0.3, // Assuming 30% tax bracket
    });

    Alert.alert(
      'Tax Calculation',
      `Estimated Tax Savings: ₹${((section80cLimit + medicalInsurance) * 0.3).toLocaleString()}\n\n${getLocalizedText('tax_calculation_note', language)}`
    );
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: StatutoryDetailsData = {
      ...statutoryData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `statutory_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ statutoryData: finalData });
    } catch (error) {
      console.error('Failed to save statutory data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Statutory Details?',
      getLocalizedText('skip_statutory_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            statutoryData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderPFSection = () => (
    <Card title={getLocalizedText('pf_details', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('pf_help', language)}
      </Text>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('pf_applicable', language)}
        </Text>
        <Switch
          value={statutoryData.pf.applicable}
          onValueChange={(value) => handleInputChange('pf', 'applicable', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={statutoryData.pf.applicable ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      {statutoryData.pf.applicable && (
        <>
          <Input
            label={getLocalizedText('uan_number', language)}
            value={statutoryData.pf.uanNumber}
            onChangeText={(text) => handleInputChange('pf', 'uanNumber', text.replace(/\D/g, ''))}
            error={errors['pf.uanNumber']}
            placeholder={getLocalizedText('enter_uan', language)}
            keyboardType="numeric"
            maxLength={12}
            helpText={getLocalizedText('uan_help', language)}
          />

          <Input
            label={getLocalizedText('pf_number', language)}
            value={statutoryData.pf.pfNumber}
            onChangeText={(text) => handleInputChange('pf', 'pfNumber', text)}
            placeholder={getLocalizedText('enter_pf_number', language)}
          />

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>
              {getLocalizedText('transfer_pf', language)}
            </Text>
            <Switch
              value={statutoryData.pf.transferFromPrevious}
              onValueChange={(value) => handleInputChange('pf', 'transferFromPrevious', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={statutoryData.pf.transferFromPrevious ? '#4CAF50' : '#f4f3f4'}
            />
          </View>

          {statutoryData.pf.transferFromPrevious && (
            <>
              <Input
                label={getLocalizedText('previous_employer_name', language)}
                value={statutoryData.pf.previousEmployerName}
                onChangeText={(text) => handleInputChange('pf', 'previousEmployerName', text)}
                placeholder={getLocalizedText('enter_employer_name', language)}
              />

              <Input
                label={getLocalizedText('previous_employer_pf', language)}
                value={statutoryData.pf.previousEmployerCode}
                onChangeText={(text) => handleInputChange('pf', 'previousEmployerCode', text)}
                placeholder={getLocalizedText('enter_employer_code', language)}
              />

              <Input
                label={getLocalizedText('previous_pf_number', language)}
                value={statutoryData.pf.previousPfNumber}
                onChangeText={(text) => handleInputChange('pf', 'previousPfNumber', text)}
                placeholder={getLocalizedText('enter_pf_number', language)}
              />
            </>
          )}

          {/* PF Nominee */}
          <Text style={styles.sectionTitle}>
            {getLocalizedText('pf_nomination', language)}
          </Text>

          <Input
            label={getLocalizedText('pf_nominee_name', language)}
            value={statutoryData.pf.nominee.name}
            onChangeText={(text) => handleInputChange('pf.nominee', 'name', text)}
            placeholder={getLocalizedText('enter_nominee_name', language)}
          />

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('pf_nominee_relation', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowRelationshipPicker('pf')}
            >
              <Text style={[styles.pickerButtonText, !statutoryData.pf.nominee.relationship && styles.placeholderText]}>
                {statutoryData.pf.nominee.relationship 
                  ? getLocalizedText(statutoryData.pf.nominee.relationship, language)
                  : getLocalizedText('select_relationship', language)
                }
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            
            {showRelationshipPicker === 'pf' && (
              <View style={styles.pickerContainer}>
                {RELATIONSHIPS.map((relation) => (
                  <TouchableOpacity
                    key={relation}
                    style={styles.pickerOption}
                    onPress={() => {
                      handleInputChange('pf.nominee', 'relationship', relation);
                      setShowRelationshipPicker(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>
                      {getLocalizedText(relation, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Input
            label={getLocalizedText('pf_nominee_share', language)}
            value={statutoryData.pf.nominee.sharePercentage.toString()}
            onChangeText={(text) => handleInputChange('pf.nominee', 'sharePercentage', parseInt(text) || 0)}
            error={errors['pf.nominee.sharePercentage']}
            placeholder={getLocalizedText('enter_percentage', language)}
            keyboardType="numeric"
          />

          <Input
            label={getLocalizedText('pf_nominee_date_of_birth', language)}
            value={statutoryData.pf.nominee.dateOfBirth}
            onChangeText={(text) => handleInputChange('pf.nominee', 'dateOfBirth', text)}
            placeholder={getLocalizedText('select_date', language)}
          />
        </>
      )}
    </Card>
  );

  const renderESISection = () => (
    <Card title={getLocalizedText('esi_details', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('esi_help', language)}
      </Text>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('esi_applicable', language)}
        </Text>
        <Switch
          value={statutoryData.esi.applicable}
          onValueChange={(value) => handleInputChange('esi', 'applicable', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={statutoryData.esi.applicable ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      {statutoryData.esi.applicable && (
        <>
          <Input
            label={getLocalizedText('esi_number', language)}
            value={statutoryData.esi.esiNumber}
            onChangeText={(text) => handleInputChange('esi', 'esiNumber', text.replace(/\D/g, ''))}
            error={errors['esi.esiNumber']}
            placeholder={getLocalizedText('enter_esi_number', language)}
            keyboardType="numeric"
            maxLength={10}
          />

          <Input
            label={getLocalizedText('esi_dispensary', language)}
            value={statutoryData.esi.preferredDispensary}
            onChangeText={(text) => handleInputChange('esi', 'preferredDispensary', text)}
            placeholder={getLocalizedText('enter_dispensary', language)}
          />

          {/* ESI Nominee */}
          <Text style={styles.sectionTitle}>
            {getLocalizedText('esi_nomination', language)}
          </Text>

          <Input
            label={getLocalizedText('esi_nominee_name', language)}
            value={statutoryData.esi.nominee.name}
            onChangeText={(text) => handleInputChange('esi.nominee', 'name', text)}
            placeholder={getLocalizedText('enter_nominee_name', language)}
          />

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('esi_nominee_relation', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowRelationshipPicker('esi')}
            >
              <Text style={[styles.pickerButtonText, !statutoryData.esi.nominee.relationship && styles.placeholderText]}>
                {statutoryData.esi.nominee.relationship 
                  ? getLocalizedText(statutoryData.esi.nominee.relationship, language)
                  : getLocalizedText('select_relationship', language)
                }
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            
            {showRelationshipPicker === 'esi' && (
              <View style={styles.pickerContainer}>
                {RELATIONSHIPS.map((relation) => (
                  <TouchableOpacity
                    key={relation}
                    style={styles.pickerOption}
                    onPress={() => {
                      handleInputChange('esi.nominee', 'relationship', relation);
                      setShowRelationshipPicker(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>
                      {getLocalizedText(relation, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </Card>
  );

  const renderTaxSection = () => (
    <>
      <Card title={getLocalizedText('tax_declarations', language)} variant="outlined" margin={8}>
        <Text style={styles.helpText}>
          {getLocalizedText('tax_regime_help', language)}
        </Text>

        {/* Tax Regime Selection */}
        <View style={styles.taxRegimeContainer}>
          <TouchableOpacity
            style={[
              styles.taxRegimeOption,
              statutoryData.tax.taxRegime === 'old' && styles.taxRegimeSelected
            ]}
            onPress={() => handleInputChange('tax', 'taxRegime', 'old')}
          >
            <Text style={[
              styles.taxRegimeText,
              statutoryData.tax.taxRegime === 'old' && styles.taxRegimeTextSelected
            ]}>
              {getLocalizedText('old_tax_regime', language)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.taxRegimeOption,
              statutoryData.tax.taxRegime === 'new' && styles.taxRegimeSelected
            ]}
            onPress={() => handleInputChange('tax', 'taxRegime', 'new')}
          >
            <Text style={[
              styles.taxRegimeText,
              statutoryData.tax.taxRegime === 'new' && styles.taxRegimeTextSelected
            ]}>
              {getLocalizedText('new_tax_regime', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Previous Employment Details */}
        <Text style={styles.sectionTitle}>
          {getLocalizedText('previous_employment', language)}
        </Text>

        <Input
          label={getLocalizedText('previous_employer_salary', language)}
          value={statutoryData.tax.previousEmployerSalary.toString()}
          onChangeText={(text) => handleInputChange('tax', 'previousEmployerSalary', parseFloat(text) || 0)}
          placeholder={getLocalizedText('enter_amount', language)}
          keyboardType="numeric"
        />

        <Input
          label={getLocalizedText('previous_employer_tax', language)}
          value={statutoryData.tax.previousEmployerTax.toString()}
          onChangeText={(text) => handleInputChange('tax', 'previousEmployerTax', parseFloat(text) || 0)}
          placeholder={getLocalizedText('enter_amount', language)}
          keyboardType="numeric"
        />

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>
            {getLocalizedText('form_16_available', language)}
          </Text>
          <Switch
            value={statutoryData.tax.form16Available}
            onValueChange={(value) => handleInputChange('tax', 'form16Available', value)}
            trackColor={{ false: '#E0E0E0', true: '#81C784' }}
            thumbColor={statutoryData.tax.form16Available ? '#4CAF50' : '#f4f3f4'}
          />
        </View>

        {/* Calculate Tax Button */}
        <Button
          title={getLocalizedText('calculate_tax', language)}
          onPress={calculateTax}
          variant="outline"
          size="medium"
          icon={<Text style={styles.calculateIcon}>🧮</Text>}
        />
      </Card>

      {/* Investment Declarations - Only for Old Tax Regime */}
      {statutoryData.tax.taxRegime === 'old' && (
        <Card title={getLocalizedText('investment_declarations', language)} variant="outlined" margin={8}>
          <Text style={styles.helpText}>
            {getLocalizedText('investment_help', language)}
          </Text>

          <Text style={styles.sectionTitle}>
            {getLocalizedText('section_80c', language)}
          </Text>

          {[
            { key: 'lifeInsurance', label: 'life_insurance' },
            { key: 'ppf', label: 'ppf' },
            { key: 'elss', label: 'elss' },
            { key: 'nsc', label: 'nsc' },
            { key: 'taxSavingFd', label: 'tax_saving_fd' },
            { key: 'homeLoanPrincipal', label: 'home_loan_principal' },
          ].map(({ key, label }) => (
            <Input
              key={key}
              label={getLocalizedText(label, language)}
              value={statutoryData.tax.investments[key as keyof typeof statutoryData.tax.investments].toString()}
              onChangeText={(text) => handleInputChange('tax.investments', key, parseFloat(text) || 0)}
              placeholder={getLocalizedText('enter_amount', language)}
              keyboardType="numeric"
            />
          ))}

          <Text style={styles.sectionTitle}>
            {getLocalizedText('section_80d', language)}
          </Text>

          <Input
            label={getLocalizedText('self_medical_insurance', language)}
            value={statutoryData.tax.investments.selfMedicalInsurance.toString()}
            onChangeText={(text) => handleInputChange('tax.investments', 'selfMedicalInsurance', parseFloat(text) || 0)}
            placeholder={getLocalizedText('enter_amount', language)}
            keyboardType="numeric"
          />

          <Input
            label={getLocalizedText('parents_medical_insurance', language)}
            value={statutoryData.tax.investments.parentsMedicalInsurance.toString()}
            onChangeText={(text) => handleInputChange('tax.investments', 'parentsMedicalInsurance', parseFloat(text) || 0)}
            placeholder={getLocalizedText('enter_amount', language)}
            keyboardType="numeric"
          />

          <Text style={styles.sectionTitle}>
            {getLocalizedText('section_24', language)}
          </Text>

          <Input
            label={getLocalizedText('home_loan_interest', language)}
            value={statutoryData.tax.investments.homeLoanInterest.toString()}
            onChangeText={(text) => handleInputChange('tax.investments', 'homeLoanInterest', parseFloat(text) || 0)}
            placeholder={getLocalizedText('enter_amount', language)}
            keyboardType="numeric"
          />

          {/* HRA Details */}
          <Text style={styles.sectionTitle}>
            {getLocalizedText('hra_details', language)}
          </Text>

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>
              {getLocalizedText('hra_claimed', language)}
            </Text>
            <Switch
              value={statutoryData.tax.hra.claimed}
              onValueChange={(value) => handleInputChange('tax.hra', 'claimed', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={statutoryData.tax.hra.claimed ? '#4CAF50' : '#f4f3f4'}
            />
          </View>

          {statutoryData.tax.hra.claimed && (
            <>
              <Input
                label={getLocalizedText('rent_amount', language)}
                value={statutoryData.tax.hra.monthlyRent.toString()}
                onChangeText={(text) => handleInputChange('tax.hra', 'monthlyRent', parseFloat(text) || 0)}
                placeholder={getLocalizedText('enter_amount', language)}
                keyboardType="numeric"
              />

              <Input
                label={getLocalizedText('landlord_name', language)}
                value={statutoryData.tax.hra.landlordName}
                onChangeText={(text) => handleInputChange('tax.hra', 'landlordName', text)}
                error={errors['tax.hra.landlordName']}
                placeholder={getLocalizedText('enter_landlord_name', language)}
                required={statutoryData.tax.hra.claimed}
              />

              {statutoryData.tax.hra.monthlyRent > 100000 && (
                <Input
                  label={getLocalizedText('landlord_pan', language)}
                  value={statutoryData.tax.hra.landlordPan}
                  onChangeText={(text) => handleInputChange('tax.hra', 'landlordPan', text.toUpperCase())}
                  error={errors['tax.hra.landlordPan']}
                  placeholder={getLocalizedText('enter_landlord_pan', language)}
                  autoCapitalize="characters"
                  maxLength={10}
                  required
                />
              )}
            </>
          )}

          {/* Other Income */}
          <Text style={styles.sectionTitle}>
            {getLocalizedText('other_income', language)}
          </Text>

          <Input
            label={getLocalizedText('rental_income', language)}
            value={statutoryData.tax.otherIncome.rentalIncome.toString()}
            onChangeText={(text) => handleInputChange('tax.otherIncome', 'rentalIncome', parseFloat(text) || 0)}
            placeholder={getLocalizedText('enter_amount', language)}
            keyboardType="numeric"
          />

          <Input
            label={getLocalizedText('capital_gains', language)}
            value={statutoryData.tax.otherIncome.capitalGains.toString()}
            onChangeText={(text) => handleInputChange('tax.otherIncome', 'capitalGains', parseFloat(text) || 0)}
            placeholder={getLocalizedText('enter_amount', language)}
            keyboardType="numeric"
          />

          <Input
            label={getLocalizedText('interest_income', language)}
            value={statutoryData.tax.otherIncome.interestIncome.toString()}
            onChangeText={(text) => handleInputChange('tax.otherIncome', 'interestIncome', parseFloat(text) || 0)}
            placeholder={getLocalizedText('enter_amount', language)}
            keyboardType="numeric"
          />
        </Card>
      )}
    </>
  );

  const renderProfessionalTaxSection = () => (
    <Card title={getLocalizedText('professional_tax', language)} variant="outlined" margin={8}>
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('pt_applicable', language)}
        </Text>
        <Switch
          value={statutoryData.professionalTax.applicable}
          onValueChange={(value) => handleInputChange('professionalTax', 'applicable', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={statutoryData.professionalTax.applicable ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      {statutoryData.professionalTax.applicable && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {getLocalizedText('pt_state', language)}
          </Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowStatePicker(!showStatePicker)}
          >
            <Text style={[styles.pickerButtonText, !statutoryData.professionalTax.state && styles.placeholderText]}>
              {statutoryData.professionalTax.state 
                ? getLocalizedText(statutoryData.professionalTax.state, language)
                : 'Select state'
              }
            </Text>
            <Text style={styles.pickerArrow}>{showStatePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showStatePicker && (
            <View style={styles.pickerContainer}>
              {PT_STATES.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={styles.pickerOption}
                  onPress={() => {
                    handleInputChange('professionalTax', 'state', state);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={styles.pickerOptionText}>
                    {getLocalizedText(state, language)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('statutory_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('statutory_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* PF Details */}
        {renderPFSection()}

        {/* ESI Details */}
        {renderESISection()}

        {/* Tax Declarations */}
        {renderTaxSection()}

        {/* Professional Tax */}
        {renderProfessionalTaxSection()}

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
  taxRegimeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  taxRegimeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  taxRegimeSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  taxRegimeText: {
    fontSize: 16,
    color: '#424242',
    fontWeight: '500',
  },
  taxRegimeTextSelected: {
    color: '#2196F3',
  },
  calculateIcon: {
    fontSize: 16,
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
