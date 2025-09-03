/**
 * Medical Information Screen - Health and medical details collection
 * 
 * Features:
 * - Complete health profile creation
 * - Medical conditions and allergies tracking
 * - Medication management
 * - Insurance information
 * - Emergency medical contacts
 * - Blood group and medical history
 * - Vaccination records
 * - Health checkup scheduling
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
      dateOfBirth: '1990-01-01',
      bloodGroup: 'O+',
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    medical_title: 'Medical Information',
    medical_subtitle: 'Please provide your health and medical details',
    
    // Sections
    basic_health_info: 'Basic Health Information',
    medical_conditions: 'Medical Conditions',
    allergies_section: 'Allergies & Sensitivities',
    medications: 'Current Medications',
    insurance_info: 'Medical Insurance',
    emergency_medical: 'Emergency Medical Information',
    vaccination_records: 'Vaccination Records',
    health_checkups: 'Health Checkups',
    lifestyle_info: 'Lifestyle Information',
    
    // Basic Health Info
    blood_group: 'Blood Group',
    height: 'Height (cm)',
    weight: 'Weight (kg)',
    bmi: 'BMI',
    body_type: 'Body Type',
    fitness_level: 'Fitness Level',
    
    // Medical Conditions
    existing_conditions: 'Existing Medical Conditions',
    chronic_diseases: 'Chronic Diseases',
    past_surgeries: 'Past Surgeries',
    family_medical_history: 'Family Medical History',
    genetic_conditions: 'Genetic Conditions',
    mental_health: 'Mental Health History',
    
    // Conditions
    diabetes: 'Diabetes',
    hypertension: 'Hypertension/High Blood Pressure',
    heart_disease: 'Heart Disease',
    asthma: 'Asthma',
    arthritis: 'Arthritis',
    thyroid: 'Thyroid Disorders',
    epilepsy: 'Epilepsy',
    migraine: 'Migraine',
    back_pain: 'Chronic Back Pain',
    kidney_disease: 'Kidney Disease',
    liver_disease: 'Liver Disease',
    cancer_history: 'Cancer History',
    other_condition: 'Other Condition',
    
    // Allergies
    drug_allergies: 'Drug/Medicine Allergies',
    food_allergies: 'Food Allergies',
    environmental_allergies: 'Environmental Allergies',
    allergy_severity: 'Severity Level',
    allergy_symptoms: 'Symptoms',
    allergy_treatment: 'Treatment Required',
    
    // Severity levels
    mild: 'Mild',
    moderate: 'Moderate',
    severe: 'Severe',
    life_threatening: 'Life Threatening',
    
    // Common allergies
    penicillin: 'Penicillin',
    aspirin: 'Aspirin',
    ibuprofen: 'Ibuprofen',
    peanuts: 'Peanuts',
    shellfish: 'Shellfish',
    dairy: 'Dairy Products',
    eggs: 'Eggs',
    pollen: 'Pollen',
    dust_mites: 'Dust Mites',
    pet_dander: 'Pet Dander',
    
    // Medications
    current_medications: 'Current Medications',
    medication_name: 'Medication Name',
    dosage: 'Dosage',
    frequency: 'Frequency',
    prescribed_by: 'Prescribed By',
    start_date: 'Start Date',
    purpose: 'Purpose/Condition',
    side_effects: 'Known Side Effects',
    
    // Frequency options
    once_daily: 'Once Daily',
    twice_daily: 'Twice Daily',
    three_times_daily: 'Three Times Daily',
    as_needed: 'As Needed',
    weekly: 'Weekly',
    monthly: 'Monthly',
    
    // Insurance
    insurance_provider: 'Insurance Provider',
    policy_number: 'Policy Number',
    policy_holder: 'Policy Holder',
    coverage_amount: 'Coverage Amount',
    family_covered: 'Family Members Covered',
    cashless_hospitals: 'Preferred Cashless Hospitals',
    insurance_expiry: 'Policy Expiry Date',
    
    // Emergency Medical
    primary_doctor: 'Primary Doctor',
    doctor_phone: 'Doctor Phone Number',
    doctor_hospital: 'Hospital/Clinic',
    medical_emergency_contact: 'Medical Emergency Contact',
    emergency_contact_relation: 'Relationship',
    emergency_contact_phone: 'Emergency Contact Phone',
    preferred_hospital: 'Preferred Hospital',
    medical_alert: 'Medical Alert Information',
    organ_donor: 'Organ Donor',
    
    // Vaccinations
    covid_vaccination: 'COVID-19 Vaccination',
    vaccination_status: 'Vaccination Status',
    vaccine_type: 'Vaccine Type',
    vaccination_date: 'Date of Vaccination',
    booster_status: 'Booster Status',
    hepatitis_b: 'Hepatitis B',
    tetanus: 'Tetanus',
    typhoid: 'Typhoid',
    other_vaccines: 'Other Vaccines',
    
    // Vaccination status
    not_vaccinated: 'Not Vaccinated',
    partially_vaccinated: 'Partially Vaccinated',
    fully_vaccinated: 'Fully Vaccinated',
    booster_taken: 'Booster Taken',
    
    // Health Checkups
    last_checkup: 'Last General Health Checkup',
    checkup_frequency: 'Preferred Checkup Frequency',
    next_checkup: 'Next Scheduled Checkup',
    blood_test_date: 'Last Blood Test',
    eye_checkup: 'Last Eye Checkup',
    dental_checkup: 'Last Dental Checkup',
    
    // Lifestyle
    smoking_status: 'Smoking Status',
    alcohol_consumption: 'Alcohol Consumption',
    exercise_frequency: 'Exercise Frequency',
    diet_type: 'Diet Type',
    sleep_hours: 'Average Sleep Hours',
    stress_level: 'Stress Level',
    
    // Smoking status
    non_smoker: 'Non-Smoker',
    occasional_smoker: 'Occasional Smoker',
    regular_smoker: 'Regular Smoker',
    ex_smoker: 'Ex-Smoker',
    
    // Alcohol consumption
    non_drinker: 'Non-Drinker',
    occasional_drinker: 'Occasional Drinker',
    social_drinker: 'Social Drinker',
    regular_drinker: 'Regular Drinker',
    
    // Exercise frequency
    never: 'Never',
    rarely: 'Rarely (1-2 times/month)',
    sometimes: 'Sometimes (1-2 times/week)',
    regularly: 'Regularly (3-4 times/week)',
    daily: 'Daily',
    
    // Diet types
    vegetarian: 'Vegetarian',
    non_vegetarian: 'Non-Vegetarian',
    vegan: 'Vegan',
    eggetarian: 'Eggetarian',
    
    // Stress levels
    low_stress: 'Low',
    moderate_stress: 'Moderate',
    high_stress: 'High',
    very_high_stress: 'Very High',
    
    // Actions
    add_condition: 'Add Condition',
    add_allergy: 'Add Allergy',
    add_medication: 'Add Medication',
    add_vaccine: 'Add Vaccine Record',
    save_medical_info: 'Save Medical Information',
    continue: 'Continue',
    skip: 'Skip for Now',
    
    // Modals
    add_medical_condition: 'Add Medical Condition',
    add_allergy_info: 'Add Allergy Information',
    add_medication_info: 'Add Medication',
    condition_name: 'Condition Name',
    diagnosis_date: 'Diagnosis Date',
    current_status: 'Current Status',
    treatment_status: 'Treatment Status',
    allergy_name: 'Allergy Name',
    reaction_type: 'Reaction Type',
    
    // Treatment status
    under_treatment: 'Under Treatment',
    controlled: 'Controlled',
    cured: 'Cured',
    monitoring: 'Monitoring',
    
    // Body types
    underweight: 'Underweight',
    normal_weight: 'Normal Weight',
    overweight: 'Overweight',
    obese: 'Obese',
    
    // Fitness levels
    sedentary: 'Sedentary',
    low_active: 'Low Active',
    moderately_active: 'Moderately Active',
    very_active: 'Very Active',
    extremely_active: 'Extremely Active',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_height: 'Please enter a valid height (100-250 cm)',
    invalid_weight: 'Please enter a valid weight (30-200 kg)',
    invalid_phone: 'Please enter a valid phone number',
    
    // Placeholders
    enter_height: 'e.g., 170',
    enter_weight: 'e.g., 70',
    enter_condition: 'e.g., Diabetes Type 2',
    enter_allergy: 'e.g., Peanuts',
    enter_medication: 'e.g., Metformin 500mg',
    enter_doctor_name: 'Dr. Full Name',
    enter_hospital: 'Hospital/Clinic Name',
    enter_policy_number: 'Policy/Member ID',
    enter_coverage: 'e.g., 500000',
    select_date: 'Select date',
    
    // Help texts
    bmi_help: 'BMI is calculated automatically based on height and weight',
    medical_conditions_help: 'Include any ongoing or past medical conditions',
    allergy_help: 'Important for workplace safety and medical emergencies',
    medication_help: 'Include all current prescription and OTC medications',
    insurance_help: 'Medical insurance details for cashless treatment',
    emergency_help: 'Important contact for medical emergencies at work',
    vaccination_help: 'Vaccination records for compliance and safety',
    lifestyle_help: 'Lifestyle information helps in health risk assessment',
    
    // Confirmation messages
    skip_medical_confirmation: 'Medical information is important for workplace safety. Are you sure you want to skip?',
    delete_condition_confirmation: 'Are you sure you want to remove this medical condition?',
    delete_allergy_confirmation: 'Are you sure you want to remove this allergy information?',
    delete_medication_confirmation: 'Are you sure you want to remove this medication?',
  };
  return texts[key] || key;
};

interface MedicalCondition {
  id: string;
  name: string;
  diagnosisDate: string;
  currentStatus: string;
  treatmentStatus: string;
  notes: string;
}

interface Allergy {
  id: string;
  name: string;
  type: 'drug' | 'food' | 'environmental';
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  symptoms: string;
  treatment: string;
  reactionType: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  startDate: string;
  purpose: string;
  sideEffects: string;
}

interface VaccinationRecord {
  id: string;
  vaccineName: string;
  status: string;
  vaccineType: string;
  vaccinationDate: string;
  boosterDate: string;
  nextDue: string;
}

interface MedicalInsurance {
  provider: string;
  policyNumber: string;
  policyHolder: string;
  coverageAmount: number;
  familyCovered: string[];
  preferredHospitals: string[];
  expiryDate: string;
}

interface EmergencyMedical {
  primaryDoctor: {
    name: string;
    phone: string;
    hospital: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  preferredHospital: string;
  medicalAlert: string;
  organDonor: boolean;
}

interface MedicalInformationData {
  basicHealth: {
    bloodGroup: string;
    height: number;
    weight: number;
    bmi: number;
    bodyType: string;
    fitnessLevel: string;
  };
  conditions: MedicalCondition[];
  allergies: Allergy[];
  medications: Medication[];
  insurance: MedicalInsurance;
  emergencyMedical: EmergencyMedical;
  vaccinations: VaccinationRecord[];
  lifestyle: {
    smokingStatus: string;
    alcoholConsumption: string;
    exerciseFrequency: string;
    dietType: string;
    sleepHours: number;
    stressLevel: string;
  };
  checkups: {
    lastGeneralCheckup: string;
    checkupFrequency: string;
    nextCheckup: string;
    lastBloodTest: string;
    lastEyeCheckup: string;
    lastDentalCheckup: string;
  };
  timestamp: string;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const BODY_TYPES = ['underweight', 'normal_weight', 'overweight', 'obese'];
const FITNESS_LEVELS = ['sedentary', 'low_active', 'moderately_active', 'very_active', 'extremely_active'];
const COMMON_CONDITIONS = ['diabetes', 'hypertension', 'heart_disease', 'asthma', 'arthritis', 'thyroid', 'epilepsy', 'migraine'];
const ALLERGY_TYPES = ['drug', 'food', 'environmental'];
const SEVERITY_LEVELS = ['mild', 'moderate', 'severe', 'life_threatening'];
const MEDICATION_FREQUENCIES = ['once_daily', 'twice_daily', 'three_times_daily', 'as_needed', 'weekly', 'monthly'];
const SMOKING_STATUS = ['non_smoker', 'occasional_smoker', 'regular_smoker', 'ex_smoker'];
const ALCOHOL_CONSUMPTION = ['non_drinker', 'occasional_drinker', 'social_drinker', 'regular_drinker'];
const EXERCISE_FREQUENCIES = ['never', 'rarely', 'sometimes', 'regularly', 'daily'];
const DIET_TYPES = ['vegetarian', 'non_vegetarian', 'vegan', 'eggetarian'];
const STRESS_LEVELS = ['low_stress', 'moderate_stress', 'high_stress', 'very_high_stress'];

export default function MedicalInformationScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [medicalData, setMedicalData] = useState<MedicalInformationData>({
    basicHealth: {
      bloodGroup: userData?.personalData?.bloodGroup || '',
      height: 0,
      weight: 0,
      bmi: 0,
      bodyType: '',
      fitnessLevel: '',
    },
    conditions: [],
    allergies: [],
    medications: [],
    insurance: {
      provider: '',
      policyNumber: '',
      policyHolder: '',
      coverageAmount: 0,
      familyCovered: [],
      preferredHospitals: [],
      expiryDate: '',
    },
    emergencyMedical: {
      primaryDoctor: {
        name: '',
        phone: '',
        hospital: '',
      },
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
      },
      preferredHospital: '',
      medicalAlert: '',
      organDonor: false,
    },
    vaccinations: [],
    lifestyle: {
      smokingStatus: '',
      alcoholConsumption: '',
      exerciseFrequency: '',
      dietType: '',
      sleepHours: 8,
      stressLevel: '',
    },
    checkups: {
      lastGeneralCheckup: '',
      checkupFrequency: '',
      nextCheckup: '',
      lastBloodTest: '',
      lastEyeCheckup: '',
      lastDentalCheckup: '',
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

  useEffect(() => {
    // Calculate BMI when height or weight changes
    if (medicalData.basicHealth.height > 0 && medicalData.basicHealth.weight > 0) {
      const heightInM = medicalData.basicHealth.height / 100;
      const bmi = Math.round((medicalData.basicHealth.weight / (heightInM * heightInM)) * 10) / 10;
      
      if (bmi !== medicalData.basicHealth.bmi) {
        setMedicalData(prev => ({
          ...prev,
          basicHealth: {
            ...prev.basicHealth,
            bmi,
            bodyType: getBMICategory(bmi),
          },
        }));
      }
    }
  }, [medicalData.basicHealth.height, medicalData.basicHealth.weight]);

  const getBMICategory = (bmi: number): string => {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25) return 'normal_weight';
    if (bmi < 30) return 'overweight';
    return 'obese';
  };

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`medical_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setMedicalData(data);
      }
    } catch (error) {
      console.error('Failed to load saved medical data:', error);
    }
  };

  const handleBasicHealthChange = (field: string, value: any) => {
    setMedicalData(prev => ({
      ...prev,
      basicHealth: {
        ...prev.basicHealth,
        [field]: value,
      },
    }));

    // Clear errors
    if (errors[`basicHealth.${field}`]) {
      setErrors(prev => ({ ...prev, [`basicHealth.${field}`]: '' }));
    }
  };

  const handleSectionChange = (section: string, field: string, value: any) => {
    setMedicalData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof MedicalInformationData] as Record<string, any>),
        [field]: value,
      } as any,
    }));
  };

  const handleNestedChange = (section: string, subsection: string, field: string, value: any) => {
    setMedicalData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof MedicalInformationData] as Record<string, any>),
        [subsection]: {
          ...(prev[section as keyof MedicalInformationData] as any)[subsection],
          [field]: value,
        },
      } as any,
    }));
  };

  const addItem = (type: string, item: any) => {
    const id = Date.now().toString();
    const itemWithId = { ...item, id };
    
    setMedicalData(prev => ({
      ...prev,
      [type]: [...prev[type as keyof MedicalInformationData] as any[], itemWithId],
    }));
    
    setShowModal(null);
    setModalData({});
  };

  const removeItem = (type: string, id: string) => {
    setMedicalData(prev => ({
      ...prev,
      [type]: (prev[type as keyof MedicalInformationData] as any[]).filter(item => item.id !== id),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Basic health validations
    if (medicalData.basicHealth.height > 0 && (medicalData.basicHealth.height < 100 || medicalData.basicHealth.height > 250)) {
      newErrors['basicHealth.height'] = getLocalizedText('invalid_height', language);
    }
    
    if (medicalData.basicHealth.weight > 0 && (medicalData.basicHealth.weight < 30 || medicalData.basicHealth.weight > 200)) {
      newErrors['basicHealth.weight'] = getLocalizedText('invalid_weight', language);
    }

    // Emergency contact validations
    if (medicalData.emergencyMedical.primaryDoctor.phone && !/^\+?[\d\s\-\(\)]{10,}$/.test(medicalData.emergencyMedical.primaryDoctor.phone)) {
      newErrors['emergencyMedical.primaryDoctor.phone'] = getLocalizedText('invalid_phone', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: MedicalInformationData = {
      ...medicalData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `medical_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ medicalData: finalData });
    } catch (error) {
      console.error('Failed to save medical data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Medical Information?',
      getLocalizedText('skip_medical_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            medicalData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderBasicHealthSection = () => (
    <Card title={getLocalizedText('basic_health_info', language)} variant="outlined" margin={8}>
      {/* Blood Group */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('blood_group', language)}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPicker(showPicker === 'bloodGroup' ? null : 'bloodGroup')}
        >
          <Text style={[styles.pickerButtonText, !medicalData.basicHealth.bloodGroup && styles.placeholderText]}>
            {medicalData.basicHealth.bloodGroup || 'Select blood group'}
          </Text>
          <Text style={styles.pickerArrow}>{showPicker === 'bloodGroup' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showPicker === 'bloodGroup' && (
          <View style={styles.pickerContainer}>
            {BLOOD_GROUPS.map((group) => (
              <TouchableOpacity
                key={group}
                style={styles.pickerOption}
                onPress={() => {
                  handleBasicHealthChange('bloodGroup', group);
                  setShowPicker(null);
                }}
              >
                <Text style={styles.pickerOptionText}>{group}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Height & Weight */}
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Input
            label={getLocalizedText('height', language)}
            value={medicalData.basicHealth.height.toString()}
            onChangeText={(text) => handleBasicHealthChange('height', parseFloat(text) || 0)}
            error={errors['basicHealth.height']}
            placeholder={getLocalizedText('enter_height', language)}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfWidth}>
          <Input
            label={getLocalizedText('weight', language)}
            value={medicalData.basicHealth.weight.toString()}
            onChangeText={(text) => handleBasicHealthChange('weight', parseFloat(text) || 0)}
            error={errors['basicHealth.weight']}
            placeholder={getLocalizedText('enter_weight', language)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* BMI Display */}
      {medicalData.basicHealth.bmi > 0 && (
        <View style={styles.bmiContainer}>
          <Text style={styles.bmiLabel}>{getLocalizedText('bmi', language)}: </Text>
          <Text style={styles.bmiValue}>{medicalData.basicHealth.bmi}</Text>
          <Text style={styles.bmiCategory}>
            ({getLocalizedText(medicalData.basicHealth.bodyType, language)})
          </Text>
        </View>
      )}

      {/* Fitness Level */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('fitness_level', language)}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPicker(showPicker === 'fitnessLevel' ? null : 'fitnessLevel')}
        >
          <Text style={[styles.pickerButtonText, !medicalData.basicHealth.fitnessLevel && styles.placeholderText]}>
            {medicalData.basicHealth.fitnessLevel 
              ? getLocalizedText(medicalData.basicHealth.fitnessLevel, language)
              : 'Select fitness level'
            }
          </Text>
          <Text style={styles.pickerArrow}>{showPicker === 'fitnessLevel' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showPicker === 'fitnessLevel' && (
          <View style={styles.pickerContainer}>
            {FITNESS_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.pickerOption}
                onPress={() => {
                  handleBasicHealthChange('fitnessLevel', level);
                  setShowPicker(null);
                }}
              >
                <Text style={styles.pickerOptionText}>
                  {getLocalizedText(level, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Card>
  );

  const renderMedicalConditionsSection = () => (
    <Card title={getLocalizedText('medical_conditions', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('medical_conditions_help', language)}
      </Text>

      {/* Add Condition Button */}
      <Button
        title={getLocalizedText('add_condition', language)}
        onPress={() => setShowModal('condition')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Conditions */}
      {medicalData.conditions.map((condition) => (
        <View key={condition.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{condition.name}</Text>
            <TouchableOpacity
              onPress={() => removeItem('conditions', condition.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDetail}>
            Status: {getLocalizedText(condition.treatmentStatus, language)}
          </Text>
          {condition.diagnosisDate && (
            <Text style={styles.itemDetail}>
              Diagnosed: {condition.diagnosisDate}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );

  const renderAllergiesSection = () => (
    <Card title={getLocalizedText('allergies_section', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('allergy_help', language)}
      </Text>

      {/* Add Allergy Button */}
      <Button
        title={getLocalizedText('add_allergy', language)}
        onPress={() => setShowModal('allergy')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Allergies */}
      {medicalData.allergies.map((allergy) => (
        <View key={allergy.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{allergy.name}</Text>
            <View style={styles.severityBadge}>
              <Text style={styles.severityText}>
                {getLocalizedText(allergy.severity, language)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removeItem('allergies', allergy.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDetail}>
            Type: {getLocalizedText(allergy.type, language)}
          </Text>
          {allergy.symptoms && (
            <Text style={styles.itemDetail}>
              Symptoms: {allergy.symptoms}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );

  const renderMedicationsSection = () => (
    <Card title={getLocalizedText('medications', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('medication_help', language)}
      </Text>

      {/* Add Medication Button */}
      <Button
        title={getLocalizedText('add_medication', language)}
        onPress={() => setShowModal('medication')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Medications */}
      {medicalData.medications.map((medication) => (
        <View key={medication.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{medication.name}</Text>
            <TouchableOpacity
              onPress={() => removeItem('medications', medication.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDetail}>
            Dosage: {medication.dosage} - {getLocalizedText(medication.frequency, language)}
          </Text>
          <Text style={styles.itemDetail}>
            Purpose: {medication.purpose}
          </Text>
          {medication.prescribedBy && (
            <Text style={styles.itemDetail}>
              Prescribed by: {medication.prescribedBy}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );

  const renderEmergencyMedicalSection = () => (
    <Card title={getLocalizedText('emergency_medical', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('emergency_help', language)}
      </Text>

      {/* Primary Doctor */}
      <Text style={styles.sectionTitle}>
        {getLocalizedText('primary_doctor', language)}
      </Text>

      <Input
        label={getLocalizedText('doctor_name', language)}
        value={medicalData.emergencyMedical.primaryDoctor.name}
        onChangeText={(text) => handleNestedChange('emergencyMedical', 'primaryDoctor', 'name', text)}
        placeholder={getLocalizedText('enter_doctor_name', language)}
      />

      <Input
        label={getLocalizedText('doctor_phone', language)}
        value={medicalData.emergencyMedical.primaryDoctor.phone}
        onChangeText={(text) => handleNestedChange('emergencyMedical', 'primaryDoctor', 'phone', text)}
        error={errors['emergencyMedical.primaryDoctor.phone']}
        placeholder="+91 12345 67890"
        keyboardType="phone-pad"
      />

      <Input
        label={getLocalizedText('doctor_hospital', language)}
        value={medicalData.emergencyMedical.primaryDoctor.hospital}
        onChangeText={(text) => handleNestedChange('emergencyMedical', 'primaryDoctor', 'hospital', text)}
        placeholder={getLocalizedText('enter_hospital', language)}
      />

      {/* Emergency Contact */}
      <Text style={styles.sectionTitle}>
        {getLocalizedText('medical_emergency_contact', language)}
      </Text>

      <Input
        label={getLocalizedText('emergency_contact_name', language)}
        value={medicalData.emergencyMedical.emergencyContact.name}
        onChangeText={(text) => handleNestedChange('emergencyMedical', 'emergencyContact', 'name', text)}
        placeholder="Emergency contact name"
      />

      <Input
        label={getLocalizedText('emergency_contact_relation', language)}
        value={medicalData.emergencyMedical.emergencyContact.relationship}
        onChangeText={(text) => handleNestedChange('emergencyMedical', 'emergencyContact', 'relationship', text)}
        placeholder="e.g., Spouse, Parent, Sibling"
      />

      <Input
        label={getLocalizedText('emergency_contact_phone', language)}
        value={medicalData.emergencyMedical.emergencyContact.phone}
        onChangeText={(text) => handleNestedChange('emergencyMedical', 'emergencyContact', 'phone', text)}
        placeholder="+91 12345 67890"
        keyboardType="phone-pad"
      />

      {/* Medical Alert */}
      <Input
        label={getLocalizedText('medical_alert', language)}
        value={medicalData.emergencyMedical.medicalAlert}
        onChangeText={(text) => handleSectionChange('emergencyMedical', 'medicalAlert', text)}
        placeholder="Any critical medical information for emergencies"
        multiline
        numberOfLines={3}
      />

      {/* Organ Donor */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('organ_donor', language)}
        </Text>
        <Switch
          value={medicalData.emergencyMedical.organDonor}
          onValueChange={(value) => handleSectionChange('emergencyMedical', 'organDonor', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={medicalData.emergencyMedical.organDonor ? '#4CAF50' : '#f4f3f4'}
        />
      </View>
    </Card>
  );

  const renderLifestyleSection = () => (
    <Card title={getLocalizedText('lifestyle_info', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('lifestyle_help', language)}
      </Text>

      {/* Smoking Status */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('smoking_status', language)}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPicker(showPicker === 'smoking' ? null : 'smoking')}
        >
          <Text style={[styles.pickerButtonText, !medicalData.lifestyle.smokingStatus && styles.placeholderText]}>
            {medicalData.lifestyle.smokingStatus 
              ? getLocalizedText(medicalData.lifestyle.smokingStatus, language)
              : 'Select smoking status'
            }
          </Text>
          <Text style={styles.pickerArrow}>{showPicker === 'smoking' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showPicker === 'smoking' && (
          <View style={styles.pickerContainer}>
            {SMOKING_STATUS.map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.pickerOption}
                onPress={() => {
                  handleSectionChange('lifestyle', 'smokingStatus', status);
                  setShowPicker(null);
                }}
              >
                <Text style={styles.pickerOptionText}>
                  {getLocalizedText(status, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Alcohol Consumption */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('alcohol_consumption', language)}
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowPicker(showPicker === 'alcohol' ? null : 'alcohol')}
        >
          <Text style={[styles.pickerButtonText, !medicalData.lifestyle.alcoholConsumption && styles.placeholderText]}>
            {medicalData.lifestyle.alcoholConsumption 
              ? getLocalizedText(medicalData.lifestyle.alcoholConsumption, language)
              : 'Select alcohol consumption'
            }
          </Text>
          <Text style={styles.pickerArrow}>{showPicker === 'alcohol' ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showPicker === 'alcohol' && (
          <View style={styles.pickerContainer}>
            {ALCOHOL_CONSUMPTION.map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.pickerOption}
                onPress={() => {
                  handleSectionChange('lifestyle', 'alcoholConsumption', level);
                  setShowPicker(null);
                }}
              >
                <Text style={styles.pickerOptionText}>
                  {getLocalizedText(level, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Exercise & Diet */}
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('exercise_frequency', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPicker(showPicker === 'exercise' ? null : 'exercise')}
            >
              <Text style={[styles.pickerButtonText, !medicalData.lifestyle.exerciseFrequency && styles.placeholderText]}>
                {medicalData.lifestyle.exerciseFrequency 
                  ? getLocalizedText(medicalData.lifestyle.exerciseFrequency, language)
                  : 'Select frequency'
                }
              </Text>
              <Text style={styles.pickerArrow}>{showPicker === 'exercise' ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showPicker === 'exercise' && (
              <View style={styles.pickerContainer}>
                {EXERCISE_FREQUENCIES.map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={styles.pickerOption}
                    onPress={() => {
                      handleSectionChange('lifestyle', 'exerciseFrequency', freq);
                      setShowPicker(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>
                      {getLocalizedText(freq, language)}
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
              {getLocalizedText('diet_type', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPicker(showPicker === 'diet' ? null : 'diet')}
            >
              <Text style={[styles.pickerButtonText, !medicalData.lifestyle.dietType && styles.placeholderText]}>
                {medicalData.lifestyle.dietType 
                  ? getLocalizedText(medicalData.lifestyle.dietType, language)
                  : 'Select diet'
                }
              </Text>
              <Text style={styles.pickerArrow}>{showPicker === 'diet' ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showPicker === 'diet' && (
              <View style={styles.pickerContainer}>
                {DIET_TYPES.map((diet) => (
                  <TouchableOpacity
                    key={diet}
                    style={styles.pickerOption}
                    onPress={() => {
                      handleSectionChange('lifestyle', 'dietType', diet);
                      setShowPicker(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>
                      {getLocalizedText(diet, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Sleep & Stress */}
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Input
            label={getLocalizedText('sleep_hours', language)}
            value={medicalData.lifestyle.sleepHours.toString()}
            onChangeText={(text) => handleSectionChange('lifestyle', 'sleepHours', parseFloat(text) || 8)}
            placeholder="8"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.halfWidth}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('stress_level', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPicker(showPicker === 'stress' ? null : 'stress')}
            >
              <Text style={[styles.pickerButtonText, !medicalData.lifestyle.stressLevel && styles.placeholderText]}>
                {medicalData.lifestyle.stressLevel 
                  ? getLocalizedText(medicalData.lifestyle.stressLevel, language)
                  : 'Select level'
                }
              </Text>
              <Text style={styles.pickerArrow}>{showPicker === 'stress' ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showPicker === 'stress' && (
              <View style={styles.pickerContainer}>
                {STRESS_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={styles.pickerOption}
                    onPress={() => {
                      handleSectionChange('lifestyle', 'stressLevel', level);
                      setShowPicker(null);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>
                      {getLocalizedText(level, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );

  const renderModals = () => (
    <>
      {/* Medical Condition Modal */}
      <Modal
        visible={showModal === 'condition'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('add_medical_condition', language)}
            </Text>
            
            <Input
              label={getLocalizedText('condition_name', language)}
              value={modalData.name || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
              placeholder={getLocalizedText('enter_condition', language)}
            />
            
            <Input
              label={getLocalizedText('diagnosis_date', language)}
              value={modalData.diagnosisDate || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, diagnosisDate: text }))}
              placeholder={getLocalizedText('select_date', language)}
            />
            
            <Input
              label={getLocalizedText('treatment_status', language)}
              value={modalData.treatmentStatus || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, treatmentStatus: text }))}
              placeholder="e.g., Under treatment, Controlled"
            />
            
            <Input
              label="Notes"
              value={modalData.notes || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, notes: text }))}
              placeholder="Additional notes"
              multiline
              numberOfLines={3}
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
                onPress={() => addItem('conditions', modalData)}
                variant="primary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Allergy Modal */}
      <Modal
        visible={showModal === 'allergy'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('add_allergy_info', language)}
            </Text>
            
            <Input
              label={getLocalizedText('allergy_name', language)}
              value={modalData.name || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
              placeholder={getLocalizedText('enter_allergy', language)}
            />
            
            <Input
              label={getLocalizedText('allergy_symptoms', language)}
              value={modalData.symptoms || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, symptoms: text }))}
              placeholder="e.g., Rash, Swelling, Difficulty breathing"
              multiline
              numberOfLines={3}
            />
            
            <Input
              label={getLocalizedText('allergy_treatment', language)}
              value={modalData.treatment || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, treatment: text }))}
              placeholder="e.g., Antihistamines, Epinephrine"
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
                onPress={() => addItem('allergies', { 
                  ...modalData, 
                  type: 'drug',
                  severity: 'moderate' 
                })}
                variant="primary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Medication Modal */}
      <Modal
        visible={showModal === 'medication'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('add_medication_info', language)}
            </Text>
            
            <Input
              label={getLocalizedText('medication_name', language)}
              value={modalData.name || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
              placeholder={getLocalizedText('enter_medication', language)}
            />
            
            <Input
              label={getLocalizedText('dosage', language)}
              value={modalData.dosage || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, dosage: text }))}
              placeholder="e.g., 500mg, 2 tablets"
            />
            
            <Input
              label={getLocalizedText('frequency', language)}
              value={modalData.frequency || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, frequency: text }))}
              placeholder="e.g., Twice daily, As needed"
            />
            
            <Input
              label={getLocalizedText('purpose', language)}
              value={modalData.purpose || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, purpose: text }))}
              placeholder="e.g., Diabetes, Blood pressure"
            />
            
            <Input
              label={getLocalizedText('prescribed_by', language)}
              value={modalData.prescribedBy || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, prescribedBy: text }))}
              placeholder="Dr. Name"
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
                onPress={() => addItem('medications', modalData)}
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
          {getLocalizedText('medical_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('medical_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Health Information */}
        {renderBasicHealthSection()}

        {/* Medical Conditions */}
        {renderMedicalConditionsSection()}

        {/* Allergies */}
        {renderAllergiesSection()}

        {/* Medications */}
        {renderMedicationsSection()}

        {/* Emergency Medical */}
        {renderEmergencyMedicalSection()}

        {/* Lifestyle Information */}
        {renderLifestyleSection()}

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
  bmiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  bmiLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1976D2',
  },
  bmiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976D2',
    marginRight: 8,
  },
  bmiCategory: {
    fontSize: 14,
    color: '#1976D2',
    fontStyle: 'italic',
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
  severityBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  severityText: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 24,
    maxHeight: '80%',
    width: '90%',
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
