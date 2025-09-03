/**
 * Family Details Screen - Family member information collection
 * 
 * Features:
 * - Spouse/partner information
 * - Children details with ages
 * - Dependent family members
 * - Nominee information for benefits
 * - Family medical history
 * - Emergency contact preferences from family
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
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
      dateOfBirth: '1990-01-01',
      maritalStatus: 'married'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    family_title: 'Family Details',
    family_subtitle: 'Please provide information about your family members',
    
    // Sections
    marital_status: 'Marital Status',
    spouse_information: 'Spouse/Partner Information',
    children_information: 'Children Information',
    dependents: 'Dependent Family Members',
    nominee_details: 'Nominee Details',
    family_medical_history: 'Family Medical History',
    
    // Marital status options
    single: 'Single',
    married: 'Married',
    divorced: 'Divorced',
    widowed: 'Widowed',
    separated: 'Separated',
    
    // Spouse fields
    spouse_name: 'Spouse Name',
    spouse_date_of_birth: 'Date of Birth',
    spouse_occupation: 'Occupation',
    spouse_employer: 'Employer',
    spouse_phone: 'Phone Number',
    spouse_email: 'Email Address',
    spouse_aadhaar: 'Aadhaar Number',
    spouse_pan: 'PAN Number',
    spouse_is_working: 'Currently Working',
    spouse_annual_income: 'Annual Income (Optional)',
    anniversary_date: 'Wedding Anniversary',
    
    // Children section
    add_child: 'Add Child',
    child_name: 'Child Name',
    child_date_of_birth: 'Date of Birth',
    child_gender: 'Gender',
    child_school: 'School/Institution',
    child_grade: 'Class/Grade',
    child_is_dependent: 'Is Dependent',
    child_special_needs: 'Special Needs (Optional)',
    child_medical_conditions: 'Medical Conditions (Optional)',
    no_children: 'No children added yet',
    
    // Gender options
    male: 'Male',
    female: 'Female',
    other: 'Other',
    
    // Dependents
    add_dependent: 'Add Dependent',
    dependent_name: 'Dependent Name',
    dependent_relationship: 'Relationship',
    dependent_age: 'Age',
    dependent_is_earning: 'Has Income',
    dependent_medical_conditions: 'Medical Conditions',
    dependent_care_required: 'Requires Special Care',
    no_dependents: 'No dependents added yet',
    
    // Relationships for dependents
    father: 'Father',
    mother: 'Mother',
    grandfather: 'Grandfather',
    grandmother: 'Grandmother',
    sibling: 'Sibling',
    in_law: 'In-law',
    other_relative: 'Other Relative',
    
    // Nominee information
    nominee_name: 'Nominee Name',
    nominee_relationship: 'Relationship to You',
    nominee_date_of_birth: 'Date of Birth',
    nominee_address: 'Address',
    nominee_phone: 'Phone Number',
    nominee_share_percentage: 'Share Percentage',
    nominee_minor: 'Is Minor (Under 18)',
    guardian_name: 'Guardian Name (if nominee is minor)',
    guardian_relationship: 'Guardian Relationship',
    guardian_address: 'Guardian Address',
    
    // Medical history
    family_diabetes: 'Diabetes in family',
    family_heart_disease: 'Heart disease in family',
    family_hypertension: 'Hypertension in family',
    family_cancer: 'Cancer in family',
    family_mental_health: 'Mental health conditions',
    family_genetic_conditions: 'Genetic conditions',
    other_medical_history: 'Other medical history',
    medical_history_details: 'Please provide details',
    
    // Actions
    save_family_details: 'Save Family Details',
    edit_child: 'Edit Child',
    delete_child: 'Delete Child',
    edit_dependent: 'Edit Dependent',
    delete_dependent: 'Delete Dependent',
    continue: 'Continue',
    skip: 'Skip for Now',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_date: 'Please enter a valid date',
    invalid_phone: 'Please enter a valid phone number',
    invalid_email: 'Please enter a valid email address',
    invalid_aadhaar: 'Please enter a valid 12-digit Aadhaar number',
    invalid_pan: 'Please enter a valid PAN number',
    future_date_not_allowed: 'Future date not allowed',
    age_too_young: 'Age cannot be less than 0',
    age_too_old: 'Please enter a valid age',
    total_percentage_error: 'Total nominee percentage should be 100%',
    
    // Placeholders
    enter_spouse_name: 'Enter spouse full name',
    enter_spouse_occupation: 'e.g., Software Engineer',
    enter_spouse_employer: 'Company/Organization name',
    enter_phone_number: '+91 98765 43210',
    enter_email: 'email@example.com',
    enter_aadhaar: '1234 5678 9012',
    enter_pan: 'ABCDE1234F',
    enter_annual_income: 'Annual income in ₹',
    select_date: 'Select date',
    enter_child_name: 'Child full name',
    enter_school_name: 'School/College name',
    enter_grade: 'Class/Grade/Year',
    enter_special_needs: 'Any special requirements',
    enter_medical_conditions: 'Known medical conditions',
    enter_dependent_name: 'Dependent full name',
    enter_age: 'Age in years',
    enter_nominee_name: 'Nominee full name',
    enter_address: 'Full address',
    enter_percentage: '0-100',
    enter_guardian_name: 'Guardian full name',
    enter_medical_details: 'Provide details about family medical history',
    
    // Confirmations
    delete_child_confirmation: 'Are you sure you want to remove this child?',
    delete_dependent_confirmation: 'Are you sure you want to remove this dependent?',
    skip_family_confirmation: 'Family details help with benefits and emergency situations. Are you sure you want to skip?',
    
    // Help texts
    spouse_help: 'This information is used for family benefits and emergency contacts',
    children_help: 'Add all children for insurance and benefit purposes',
    dependents_help: 'Family members who depend on you financially or for care',
    nominee_help: 'Nominee will receive benefits in case of unfortunate events',
    medical_history_help: 'Family medical history helps with health insurance and checkups',
    percentage_help: 'Total percentage for all nominees should add up to 100%',
  };
  return texts[key] || key;
};

interface SpouseInfo {
  name: string;
  dateOfBirth: string;
  occupation: string;
  employer: string;
  phone: string;
  email: string;
  aadhaar: string;
  pan: string;
  isWorking: boolean;
  annualIncome: string;
  anniversaryDate: string;
}

interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  school: string;
  grade: string;
  isDependent: boolean;
  specialNeeds: string;
  medicalConditions: string;
}

interface Dependent {
  id: string;
  name: string;
  relationship: string;
  age: number;
  isEarning: boolean;
  medicalConditions: string;
  careRequired: boolean;
}

interface NomineeInfo {
  name: string;
  relationship: string;
  dateOfBirth: string;
  address: string;
  phone: string;
  sharePercentage: number;
  isMinor: boolean;
  guardianName: string;
  guardianRelationship: string;
  guardianAddress: string;
}

interface FamilyMedicalHistory {
  diabetes: boolean;
  heartDisease: boolean;
  hypertension: boolean;
  cancer: boolean;
  mentalHealth: boolean;
  geneticConditions: boolean;
  otherConditions: string;
  details: string;
}

interface FamilyDetailsData {
  maritalStatus: string;
  spouse?: SpouseInfo;
  children: Child[];
  dependents: Dependent[];
  nominee: NomineeInfo;
  medicalHistory: FamilyMedicalHistory;
  timestamp: string;
}

const MARITAL_STATUS_OPTIONS = ['single', 'married', 'divorced', 'widowed', 'separated'];
const GENDER_OPTIONS = ['male', 'female', 'other'];
const RELATIONSHIP_OPTIONS = ['father', 'mother', 'grandfather', 'grandmother', 'sibling', 'in_law', 'other_relative'];

export default function FamilyDetailsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [familyData, setFamilyData] = useState<FamilyDetailsData>({
    maritalStatus: userData?.personalData?.maritalStatus || 'single',
    children: [],
    dependents: [],
    nominee: {
      name: '',
      relationship: '',
      dateOfBirth: '',
      address: '',
      phone: '',
      sharePercentage: 100,
      isMinor: false,
      guardianName: '',
      guardianRelationship: '',
      guardianAddress: '',
    },
    medicalHistory: {
      diabetes: false,
      heartDisease: false,
      hypertension: false,
      cancer: false,
      mentalHealth: false,
      geneticConditions: false,
      otherConditions: '',
      details: '',
    },
    timestamp: '',
  });
  
  const [showChildForm, setShowChildForm] = useState(false);
  const [showDependentForm, setShowDependentForm] = useState(false);
  const [currentChild, setCurrentChild] = useState<Child | null>(null);
  const [currentDependent, setCurrentDependent] = useState<Dependent | null>(null);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingDependentId, setEditingDependentId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadSavedData();
    initializeEmptySpouse();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`family_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setFamilyData(data);
      }
    } catch (error) {
      console.error('Failed to load saved family data:', error);
    }
  };

  const initializeEmptySpouse = () => {
    if (familyData.maritalStatus === 'married' && !familyData.spouse) {
      setFamilyData(prev => ({
        ...prev,
        spouse: {
          name: '',
          dateOfBirth: '',
          occupation: '',
          employer: '',
          phone: '',
          email: '',
          aadhaar: '',
          pan: '',
          isWorking: false,
          annualIncome: '',
          anniversaryDate: '',
        },
      }));
    }
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    if (section === 'spouse' && familyData.spouse) {
      setFamilyData(prev => ({
        ...prev,
        spouse: {
          ...prev.spouse!,
          [field]: value,
        },
      }));
    } else if (section === 'nominee') {
      setFamilyData(prev => ({
        ...prev,
        nominee: {
          ...prev.nominee,
          [field]: value,
        },
      }));
    } else if (section === 'medicalHistory') {
      setFamilyData(prev => ({
        ...prev,
        medicalHistory: {
          ...prev.medicalHistory,
          [field]: value,
        },
      }));
    } else {
      setFamilyData(prev => ({
        ...prev,
        [field]: value,
      }));
    }

    // Clear errors
    const errorKey = section === 'root' ? field : `${section}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate spouse information if married
    if (familyData.maritalStatus === 'married' && familyData.spouse) {
      const spouse = familyData.spouse;
      if (!spouse.name.trim()) {
        newErrors['spouse.name'] = getLocalizedText('required_field', language);
      }
      if (spouse.phone && !/^[\+]?[1-9][\d]{9,14}$/.test(spouse.phone.replace(/\s/g, ''))) {
        newErrors['spouse.phone'] = getLocalizedText('invalid_phone', language);
      }
      if (spouse.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spouse.email)) {
        newErrors['spouse.email'] = getLocalizedText('invalid_email', language);
      }
      if (spouse.aadhaar && !/^\d{12}$/.test(spouse.aadhaar.replace(/\s/g, ''))) {
        newErrors['spouse.aadhaar'] = getLocalizedText('invalid_aadhaar', language);
      }
      if (spouse.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(spouse.pan)) {
        newErrors['spouse.pan'] = getLocalizedText('invalid_pan', language);
      }
    }

    // Validate nominee
    if (!familyData.nominee.name.trim()) {
      newErrors['nominee.name'] = getLocalizedText('required_field', language);
    }
    if (!familyData.nominee.relationship.trim()) {
      newErrors['nominee.relationship'] = getLocalizedText('required_field', language);
    }
    if (familyData.nominee.phone && !/^[\+]?[1-9][\d]{9,14}$/.test(familyData.nominee.phone.replace(/\s/g, ''))) {
      newErrors['nominee.phone'] = getLocalizedText('invalid_phone', language);
    }
    if (familyData.nominee.sharePercentage <= 0 || familyData.nominee.sharePercentage > 100) {
      newErrors['nominee.sharePercentage'] = getLocalizedText('total_percentage_error', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addChild = () => {
    setCurrentChild({
      id: '',
      name: '',
      dateOfBirth: '',
      gender: '',
      school: '',
      grade: '',
      isDependent: true,
      specialNeeds: '',
      medicalConditions: '',
    });
    setEditingChildId(null);
    setShowChildForm(true);
  };

  const editChild = (child: Child) => {
    setCurrentChild(child);
    setEditingChildId(child.id);
    setShowChildForm(true);
  };

  const saveChild = () => {
    if (!currentChild?.name.trim()) {
      Alert.alert('Error', 'Please enter child name');
      return;
    }

    const childToSave = {
      ...currentChild,
      id: editingChildId || `child_${Date.now()}`,
    };

    if (editingChildId) {
      setFamilyData(prev => ({
        ...prev,
        children: prev.children.map(child => 
          child.id === editingChildId ? childToSave : child
        ),
      }));
    } else {
      setFamilyData(prev => ({
        ...prev,
        children: [...prev.children, childToSave],
      }));
    }

    setShowChildForm(false);
    setCurrentChild(null);
    setEditingChildId(null);
  };

  const deleteChild = (childId: string) => {
    Alert.alert(
      getLocalizedText('delete_child', language),
      getLocalizedText('delete_child_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setFamilyData(prev => ({
              ...prev,
              children: prev.children.filter(child => child.id !== childId),
            }));
          },
        },
      ]
    );
  };

  const addDependent = () => {
    setCurrentDependent({
      id: '',
      name: '',
      relationship: '',
      age: 0,
      isEarning: false,
      medicalConditions: '',
      careRequired: false,
    });
    setEditingDependentId(null);
    setShowDependentForm(true);
  };

  const editDependent = (dependent: Dependent) => {
    setCurrentDependent(dependent);
    setEditingDependentId(dependent.id);
    setShowDependentForm(true);
  };

  const saveDependent = () => {
    if (!currentDependent?.name.trim()) {
      Alert.alert('Error', 'Please enter dependent name');
      return;
    }

    const dependentToSave = {
      ...currentDependent,
      id: editingDependentId || `dependent_${Date.now()}`,
    };

    if (editingDependentId) {
      setFamilyData(prev => ({
        ...prev,
        dependents: prev.dependents.map(dep => 
          dep.id === editingDependentId ? dependentToSave : dep
        ),
      }));
    } else {
      setFamilyData(prev => ({
        ...prev,
        dependents: [...prev.dependents, dependentToSave],
      }));
    }

    setShowDependentForm(false);
    setCurrentDependent(null);
    setEditingDependentId(null);
  };

  const deleteDependent = (dependentId: string) => {
    Alert.alert(
      getLocalizedText('delete_dependent', language),
      getLocalizedText('delete_dependent_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setFamilyData(prev => ({
              ...prev,
              dependents: prev.dependents.filter(dep => dep.id !== dependentId),
            }));
          },
        },
      ]
    );
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: FamilyDetailsData = {
      ...familyData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `family_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ familyData: finalData });
    } catch (error) {
      console.error('Failed to save family data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Family Details?',
      getLocalizedText('skip_family_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            familyData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderSpouseSection = () => {
    if (familyData.maritalStatus !== 'married') return null;

    return (
      <Card 
        title={getLocalizedText('spouse_information', language)} 
        variant="outlined" 
        margin={8}
      >
        <Text style={styles.helpText}>
          {getLocalizedText('spouse_help', language)}
        </Text>

        <Input
          label={getLocalizedText('spouse_name', language)}
          value={familyData.spouse?.name || ''}
          onChangeText={(text) => handleInputChange('spouse', 'name', text)}
          error={errors['spouse.name']}
          required
          placeholder={getLocalizedText('enter_spouse_name', language)}
        />

        <Input
          label={getLocalizedText('spouse_date_of_birth', language)}
          value={familyData.spouse?.dateOfBirth || ''}
          onChangeText={(text) => handleInputChange('spouse', 'dateOfBirth', text)}
          placeholder={getLocalizedText('select_date', language)}
        />

        <Input
          label={getLocalizedText('spouse_occupation', language)}
          value={familyData.spouse?.occupation || ''}
          onChangeText={(text) => handleInputChange('spouse', 'occupation', text)}
          placeholder={getLocalizedText('enter_spouse_occupation', language)}
        />

        <Input
          label={getLocalizedText('spouse_employer', language)}
          value={familyData.spouse?.employer || ''}
          onChangeText={(text) => handleInputChange('spouse', 'employer', text)}
          placeholder={getLocalizedText('enter_spouse_employer', language)}
        />

        <Input
          label={getLocalizedText('spouse_phone', language)}
          value={familyData.spouse?.phone || ''}
          onChangeText={(text) => handleInputChange('spouse', 'phone', text)}
          error={errors['spouse.phone']}
          placeholder={getLocalizedText('enter_phone_number', language)}
          keyboardType="phone-pad"
        />

        <Input
          label={getLocalizedText('spouse_email', language)}
          value={familyData.spouse?.email || ''}
          onChangeText={(text) => handleInputChange('spouse', 'email', text)}
          error={errors['spouse.email']}
          placeholder={getLocalizedText('enter_email', language)}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>
            {getLocalizedText('spouse_is_working', language)}
          </Text>
          <Switch
            value={familyData.spouse?.isWorking || false}
            onValueChange={(value) => handleInputChange('spouse', 'isWorking', value)}
            trackColor={{ false: '#E0E0E0', true: '#81C784' }}
            thumbColor={familyData.spouse?.isWorking ? '#4CAF50' : '#f4f3f4'}
          />
        </View>

        {familyData.spouse?.isWorking && (
          <Input
            label={getLocalizedText('spouse_annual_income', language)}
            value={familyData.spouse?.annualIncome || ''}
            onChangeText={(text) => handleInputChange('spouse', 'annualIncome', text)}
            placeholder={getLocalizedText('enter_annual_income', language)}
            keyboardType="numeric"
          />
        )}

        <Input
          label={getLocalizedText('anniversary_date', language)}
          value={familyData.spouse?.anniversaryDate || ''}
          onChangeText={(text) => handleInputChange('spouse', 'anniversaryDate', text)}
          placeholder={getLocalizedText('select_date', language)}
        />
      </Card>
    );
  };

  const renderChildrenSection = () => (
    <Card 
      title={`${getLocalizedText('children_information', language)} (${familyData.children.length})`}
      variant="outlined" 
      margin={8}
      action={
        <Button
          title={getLocalizedText('add_child', language)}
          onPress={addChild}
          variant="outline"
          size="small"
          icon={<Text style={styles.addIcon}>+</Text>}
        />
      }
    >
      <Text style={styles.helpText}>
        {getLocalizedText('children_help', language)}
      </Text>

      {familyData.children.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {getLocalizedText('no_children', language)}
          </Text>
        </View>
      ) : (
        familyData.children.map(child => (
          <View key={child.id} style={styles.listItem}>
            <View style={styles.listItemInfo}>
              <Text style={styles.listItemName}>{child.name}</Text>
              <Text style={styles.listItemDetails}>
                {getLocalizedText(child.gender, language)} • {child.dateOfBirth || 'Age not specified'}
              </Text>
              {child.school && (
                <Text style={styles.listItemDetails}>{child.school}</Text>
              )}
            </View>
            <View style={styles.listItemActions}>
              <TouchableOpacity onPress={() => editChild(child)} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteChild(child.id)} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </Card>
  );

  const renderDependentsSection = () => (
    <Card 
      title={`${getLocalizedText('dependents', language)} (${familyData.dependents.length})`}
      variant="outlined" 
      margin={8}
      action={
        <Button
          title={getLocalizedText('add_dependent', language)}
          onPress={addDependent}
          variant="outline"
          size="small"
          icon={<Text style={styles.addIcon}>+</Text>}
        />
      }
    >
      <Text style={styles.helpText}>
        {getLocalizedText('dependents_help', language)}
      </Text>

      {familyData.dependents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {getLocalizedText('no_dependents', language)}
          </Text>
        </View>
      ) : (
        familyData.dependents.map(dependent => (
          <View key={dependent.id} style={styles.listItem}>
            <View style={styles.listItemInfo}>
              <Text style={styles.listItemName}>{dependent.name}</Text>
              <Text style={styles.listItemDetails}>
                {getLocalizedText(dependent.relationship, language)} • {dependent.age} years
              </Text>
              {dependent.medicalConditions && (
                <Text style={styles.listItemDetails}>Medical: {dependent.medicalConditions}</Text>
              )}
            </View>
            <View style={styles.listItemActions}>
              <TouchableOpacity onPress={() => editDependent(dependent)} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteDependent(dependent.id)} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </Card>
  );

  const renderNomineeSection = () => (
    <Card title={getLocalizedText('nominee_details', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('nominee_help', language)}
      </Text>

      <Input
        label={getLocalizedText('nominee_name', language)}
        value={familyData.nominee.name}
        onChangeText={(text) => handleInputChange('nominee', 'name', text)}
        error={errors['nominee.name']}
        required
        placeholder={getLocalizedText('enter_nominee_name', language)}
      />

      <Input
        label={getLocalizedText('nominee_relationship', language)}
        value={familyData.nominee.relationship}
        onChangeText={(text) => handleInputChange('nominee', 'relationship', text)}
        error={errors['nominee.relationship']}
        required
        placeholder="e.g., Spouse, Child, Parent"
      />

      <Input
        label={getLocalizedText('nominee_date_of_birth', language)}
        value={familyData.nominee.dateOfBirth}
        onChangeText={(text) => handleInputChange('nominee', 'dateOfBirth', text)}
        placeholder={getLocalizedText('select_date', language)}
      />

      <Input
        label={getLocalizedText('nominee_phone', language)}
        value={familyData.nominee.phone}
        onChangeText={(text) => handleInputChange('nominee', 'phone', text)}
        error={errors['nominee.phone']}
        placeholder={getLocalizedText('enter_phone_number', language)}
        keyboardType="phone-pad"
      />

      <Input
        label={getLocalizedText('nominee_address', language)}
        value={familyData.nominee.address}
        onChangeText={(text) => handleInputChange('nominee', 'address', text)}
        placeholder={getLocalizedText('enter_address', language)}
        multiline
        numberOfLines={2}
      />

      <Input
        label={getLocalizedText('nominee_share_percentage', language)}
        value={familyData.nominee.sharePercentage.toString()}
        onChangeText={(text) => handleInputChange('nominee', 'sharePercentage', parseInt(text) || 0)}
        error={errors['nominee.sharePercentage']}
        placeholder={getLocalizedText('enter_percentage', language)}
        keyboardType="numeric"
        helpText={getLocalizedText('percentage_help', language)}
      />

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>
          {getLocalizedText('nominee_minor', language)}
        </Text>
        <Switch
          value={familyData.nominee.isMinor}
          onValueChange={(value) => handleInputChange('nominee', 'isMinor', value)}
          trackColor={{ false: '#E0E0E0', true: '#81C784' }}
          thumbColor={familyData.nominee.isMinor ? '#4CAF50' : '#f4f3f4'}
        />
      </View>

      {familyData.nominee.isMinor && (
        <>
          <Input
            label={getLocalizedText('guardian_name', language)}
            value={familyData.nominee.guardianName}
            onChangeText={(text) => handleInputChange('nominee', 'guardianName', text)}
            placeholder={getLocalizedText('enter_guardian_name', language)}
            required
          />

          <Input
            label={getLocalizedText('guardian_relationship', language)}
            value={familyData.nominee.guardianRelationship}
            onChangeText={(text) => handleInputChange('nominee', 'guardianRelationship', text)}
            placeholder="e.g., Father, Mother, Uncle"
            required
          />

          <Input
            label={getLocalizedText('guardian_address', language)}
            value={familyData.nominee.guardianAddress}
            onChangeText={(text) => handleInputChange('nominee', 'guardianAddress', text)}
            placeholder={getLocalizedText('enter_address', language)}
            multiline
            numberOfLines={2}
          />
        </>
      )}
    </Card>
  );

  const renderMedicalHistorySection = () => (
    <Card title={getLocalizedText('family_medical_history', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('medical_history_help', language)}
      </Text>

      {[
        { key: 'diabetes', label: 'family_diabetes' },
        { key: 'heartDisease', label: 'family_heart_disease' },
        { key: 'hypertension', label: 'family_hypertension' },
        { key: 'cancer', label: 'family_cancer' },
        { key: 'mentalHealth', label: 'family_mental_health' },
        { key: 'geneticConditions', label: 'family_genetic_conditions' },
      ].map(({ key, label }) => (
        <View key={key} style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>
            {getLocalizedText(label, language)}
          </Text>
          <Switch
            value={familyData.medicalHistory[key as keyof FamilyMedicalHistory] as boolean}
            onValueChange={(value) => handleInputChange('medicalHistory', key, value)}
            trackColor={{ false: '#E0E0E0', true: '#FFCDD2' }}
            thumbColor={familyData.medicalHistory[key as keyof FamilyMedicalHistory] ? '#F44336' : '#f4f3f4'}
          />
        </View>
      ))}

      <Input
        label={getLocalizedText('other_medical_history', language)}
        value={familyData.medicalHistory.otherConditions}
        onChangeText={(text) => handleInputChange('medicalHistory', 'otherConditions', text)}
        placeholder="Any other family medical conditions"
      />

      <Input
        label={getLocalizedText('medical_history_details', language)}
        value={familyData.medicalHistory.details}
        onChangeText={(text) => handleInputChange('medicalHistory', 'details', text)}
        placeholder={getLocalizedText('enter_medical_details', language)}
        multiline
        numberOfLines={3}
      />
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('family_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('family_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Marital Status */}
        <Card title={getLocalizedText('marital_status', language)} variant="outlined" margin={8}>
          <View style={styles.maritalStatusContainer}>
            {MARITAL_STATUS_OPTIONS.map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.maritalStatusOption,
                  familyData.maritalStatus === status && styles.maritalStatusSelected
                ]}
                onPress={() => handleInputChange('root', 'maritalStatus', status)}
              >
                <Text style={[
                  styles.maritalStatusText,
                  familyData.maritalStatus === status && styles.maritalStatusTextSelected
                ]}>
                  {getLocalizedText(status, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Spouse Information */}
        {renderSpouseSection()}

        {/* Children Information */}
        {renderChildrenSection()}

        {/* Dependents */}
        {renderDependentsSection()}

        {/* Nominee Details */}
        {renderNomineeSection()}

        {/* Family Medical History */}
        {renderMedicalHistorySection()}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Child Form Modal */}
      <Modal
        visible={showChildForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChildForm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChildForm(false)}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingChildId ? getLocalizedText('edit_child', language) : getLocalizedText('add_child', language)}
            </Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Input
              label={getLocalizedText('child_name', language)}
              value={currentChild?.name || ''}
              onChangeText={(text) => setCurrentChild(prev => prev ? { ...prev, name: text } : null)}
              required
              placeholder={getLocalizedText('enter_child_name', language)}
            />

            <Input
              label={getLocalizedText('child_date_of_birth', language)}
              value={currentChild?.dateOfBirth || ''}
              onChangeText={(text) => setCurrentChild(prev => prev ? { ...prev, dateOfBirth: text } : null)}
              placeholder={getLocalizedText('select_date', language)}
            />

            <Input
              label={getLocalizedText('child_school', language)}
              value={currentChild?.school || ''}
              onChangeText={(text) => setCurrentChild(prev => prev ? { ...prev, school: text } : null)}
              placeholder={getLocalizedText('enter_school_name', language)}
            />

            <Input
              label={getLocalizedText('child_grade', language)}
              value={currentChild?.grade || ''}
              onChangeText={(text) => setCurrentChild(prev => prev ? { ...prev, grade: text } : null)}
              placeholder={getLocalizedText('enter_grade', language)}
            />

            <Input
              label={getLocalizedText('child_special_needs', language)}
              value={currentChild?.specialNeeds || ''}
              onChangeText={(text) => setCurrentChild(prev => prev ? { ...prev, specialNeeds: text } : null)}
              placeholder={getLocalizedText('enter_special_needs', language)}
            />

            <Input
              label={getLocalizedText('child_medical_conditions', language)}
              value={currentChild?.medicalConditions || ''}
              onChangeText={(text) => setCurrentChild(prev => prev ? { ...prev, medicalConditions: text } : null)}
              placeholder={getLocalizedText('enter_medical_conditions', language)}
              multiline
              numberOfLines={2}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              title="Save Child"
              onPress={saveChild}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>
        </View>
      </Modal>

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
  maritalStatusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  maritalStatusOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  maritalStatusSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  maritalStatusText: {
    fontSize: 14,
    color: '#424242',
  },
  maritalStatusTextSelected: {
    color: '#2196F3',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    fontStyle: 'italic',
  },
  addIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  listItemDetails: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 2,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#757575',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  modalHeaderSpacer: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
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
