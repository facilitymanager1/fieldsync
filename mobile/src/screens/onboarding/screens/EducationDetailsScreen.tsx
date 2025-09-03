/**
 * Education Details Screen - Educational qualification and certification details
 * 
 * Features:
 * - Educational qualification selection
 * - Institution details
 * - Year of completion
 * - Grade/Percentage entry
 * - Certificate upload capability
 * - Multiple qualification support
 * - Skills and certifications section
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
  Modal,
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
    personalDetails: { mobileNumber: '9876543210' }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    education_title: 'Education Details',
    education_subtitle: 'Please provide your educational qualifications',
    highest_qualification: 'Highest Qualification',
    institution_name: 'Institution/School/College Name',
    year_of_completion: 'Year of Completion',
    grade_percentage: 'Grade/Percentage',
    add_qualification: 'Add Another Qualification',
    skills_certifications: 'Skills & Certifications',
    technical_skills: 'Technical Skills',
    certifications: 'Certifications',
    languages_known: 'Languages Known',
    continue: 'Continue',
    skip: 'Skip for Now',
    required_field: 'This field is required',
    upload_certificate: 'Upload Certificate',
    remove: 'Remove',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    select_qualification: 'Select Qualification',
    enter_percentage: 'Enter percentage (0-100)',
    enter_cgpa: 'Enter CGPA (0-10)',
    grade_type: 'Grade Type',
    percentage: 'Percentage',
    cgpa: 'CGPA',
    grade: 'Grade',
    
    // Qualifications
    below_10th: 'Below 10th',
    'tenth_sslc': '10th/SSLC',
    'twelfth_puc': '12th/PUC/HSC',
    diploma: 'Diploma',
    iti: 'ITI',
    degree: 'Degree',
    masters: 'Masters',
    phd: 'PhD',
    others: 'Others',
    
    // Languages
    english: 'English',
    hindi: 'Hindi',
    kannada: 'Kannada',
    tamil: 'Tamil',
    telugu: 'Telugu',
    malayalam: 'Malayalam',
    marathi: 'Marathi',
    gujarati: 'Gujarati',
    bengali: 'Bengali',
    punjabi: 'Punjabi',
  };
  return texts[key] || key;
};

interface QualificationData {
  id: string;
  level: string;
  institutionName: string;
  yearOfCompletion: string;
  gradeType: 'percentage' | 'cgpa' | 'grade';
  gradeValue: string;
  certificateUri?: string;
}

interface EducationData {
  qualifications: QualificationData[];
  technicalSkills: string[];
  certifications: string[];
  languagesKnown: string[];
  timestamp: string;
}

const QUALIFICATION_LEVELS = [
  'below_10th', 'tenth_sslc', 'twelfth_puc', 'diploma', 'iti', 'degree', 'masters', 'phd', 'others'
];

const LANGUAGES = [
  'english', 'hindi', 'kannada', 'tamil', 'telugu', 'malayalam', 'marathi', 'gujarati', 'bengali', 'punjabi'
];

export default function EducationDetailsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [educationData, setEducationData] = useState<EducationData>({
    qualifications: [{
      id: '1',
      level: '',
      institutionName: '',
      yearOfCompletion: '',
      gradeType: 'percentage',
      gradeValue: '',
    }],
    technicalSkills: [],
    certifications: [],
    languagesKnown: ['english'], // Default to English
    timestamp: '',
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showQualificationModal, setShowQualificationModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentSkill, setCurrentSkill] = useState('');
  const [currentCertification, setCurrentCertification] = useState('');

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`education_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setEducationData(data);
      }
    } catch (error) {
      console.error('Failed to load saved education data:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate at least one qualification
    if (educationData.qualifications.length === 0) {
      newErrors.qualifications = 'At least one qualification is required';
      return false;
    }

    // Validate each qualification
    educationData.qualifications.forEach((qual, index) => {
      if (!qual.level) {
        newErrors[`qualification_${index}_level`] = getLocalizedText('required_field', language);
      }
      if (!qual.institutionName.trim()) {
        newErrors[`qualification_${index}_institution`] = getLocalizedText('required_field', language);
      }
      if (!qual.yearOfCompletion.trim()) {
        newErrors[`qualification_${index}_year`] = getLocalizedText('required_field', language);
      }
      if (!qual.gradeValue.trim()) {
        newErrors[`qualification_${index}_grade`] = getLocalizedText('required_field', language);
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleQualificationChange = (index: number, field: keyof QualificationData, value: string) => {
    const updatedQualifications = [...educationData.qualifications];
    updatedQualifications[index] = { ...updatedQualifications[index], [field]: value };
    
    setEducationData(prev => ({
      ...prev,
      qualifications: updatedQualifications,
    }));

    // Clear errors
    const errorKey = `qualification_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addQualification = () => {
    const newQualification: QualificationData = {
      id: Date.now().toString(),
      level: '',
      institutionName: '',
      yearOfCompletion: '',
      gradeType: 'percentage',
      gradeValue: '',
    };
    
    setEducationData(prev => ({
      ...prev,
      qualifications: [...prev.qualifications, newQualification],
    }));
  };

  const removeQualification = (index: number) => {
    if (educationData.qualifications.length === 1) {
      Alert.alert('Error', 'At least one qualification is required');
      return;
    }
    
    const updatedQualifications = educationData.qualifications.filter((_, i) => i !== index);
    setEducationData(prev => ({
      ...prev,
      qualifications: updatedQualifications,
    }));
  };

  const addSkill = () => {
    if (!currentSkill.trim()) return;
    
    const updatedSkills = [...educationData.technicalSkills, currentSkill.trim()];
    setEducationData(prev => ({ ...prev, technicalSkills: updatedSkills }));
    setCurrentSkill('');
  };

  const removeSkill = (index: number) => {
    const updatedSkills = educationData.technicalSkills.filter((_, i) => i !== index);
    setEducationData(prev => ({ ...prev, technicalSkills: updatedSkills }));
  };

  const addCertification = () => {
    if (!currentCertification.trim()) return;
    
    const updatedCertifications = [...educationData.certifications, currentCertification.trim()];
    setEducationData(prev => ({ ...prev, certifications: updatedCertifications }));
    setCurrentCertification('');
  };

  const removeCertification = (index: number) => {
    const updatedCertifications = educationData.certifications.filter((_, i) => i !== index);
    setEducationData(prev => ({ ...prev, certifications: updatedCertifications }));
  };

  const toggleLanguage = (lang: string) => {
    const isSelected = educationData.languagesKnown.includes(lang);
    let updatedLanguages;
    
    if (isSelected) {
      // Don't allow removing English as it's required
      if (lang === 'english') {
        Alert.alert('Error', 'English is required and cannot be removed');
        return;
      }
      updatedLanguages = educationData.languagesKnown.filter(l => l !== lang);
    } else {
      updatedLanguages = [...educationData.languagesKnown, lang];
    }
    
    setEducationData(prev => ({ ...prev, languagesKnown: updatedLanguages }));
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: EducationData = {
      ...educationData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `education_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ educationData: finalData });
    } catch (error) {
      console.error('Failed to save education data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Education Details?',
      'Education details help us match you with suitable positions.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            educationData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderQualificationCard = (qualification: QualificationData, index: number) => (
    <Card
      key={qualification.id}
      title={`Qualification ${index + 1}`}
      variant="outlined"
      margin={8}
      headerActions={
        educationData.qualifications.length > 1 ? (
          <TouchableOpacity onPress={() => removeQualification(index)}>
            <Text style={styles.removeButton}>
              {getLocalizedText('remove', language)}
            </Text>
          </TouchableOpacity>
        ) : null
      }
    >
      {/* Qualification Level */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('highest_qualification', language)} *
        </Text>
        <TouchableOpacity
          style={[styles.pickerButton, errors[`qualification_${index}_level`] ? styles.inputError : null]}
          onPress={() => setShowQualificationModal(true)}
        >
          <Text style={[styles.pickerButtonText, !qualification.level && styles.placeholderText]}>
            {qualification.level ? getLocalizedText(qualification.level, language) : getLocalizedText('select_qualification', language)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
        {errors[`qualification_${index}_level`] && (
          <Text style={styles.errorText}>{errors[`qualification_${index}_level`]}</Text>
        )}
      </View>

      {/* Institution Name */}
      <Input
        label={getLocalizedText('institution_name', language)}
        value={qualification.institutionName}
        onChangeText={(text) => handleQualificationChange(index, 'institutionName', text)}
        error={errors[`qualification_${index}_institution`]}
        required
        placeholder="Enter institution name"
      />

      {/* Year of Completion */}
      <Input
        label={getLocalizedText('year_of_completion', language)}
        value={qualification.yearOfCompletion}
        onChangeText={(text) => handleQualificationChange(index, 'yearOfCompletion', text)}
        error={errors[`qualification_${index}_year`]}
        required
        placeholder="YYYY"
        keyboardType="numeric"
        maxLength={4}
      />

      {/* Grade Type Selection */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('grade_type', language)} *
        </Text>
        <View style={styles.gradeTypeContainer}>
          {(['percentage', 'cgpa', 'grade'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.gradeTypeButton,
                qualification.gradeType === type && styles.gradeTypeButtonActive
              ]}
              onPress={() => handleQualificationChange(index, 'gradeType', type)}
            >
              <Text style={[
                styles.gradeTypeButtonText,
                qualification.gradeType === type && styles.gradeTypeButtonTextActive
              ]}>
                {getLocalizedText(type, language)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Grade/Percentage */}
      <Input
        label={getLocalizedText('grade_percentage', language)}
        value={qualification.gradeValue}
        onChangeText={(text) => handleQualificationChange(index, 'gradeValue', text)}
        error={errors[`qualification_${index}_grade`]}
        required
        placeholder={
          qualification.gradeType === 'percentage' 
            ? getLocalizedText('enter_percentage', language)
            : qualification.gradeType === 'cgpa'
            ? getLocalizedText('enter_cgpa', language)
            : 'Enter grade'
        }
        keyboardType={qualification.gradeType !== 'grade' ? 'numeric' : 'default'}
      />
    </Card>
  );

  const renderSkillsSection = () => (
    <Card title={getLocalizedText('skills_certifications', language)} variant="outlined" margin={8}>
      {/* Technical Skills */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('technical_skills', language)}
        </Text>
        <View style={styles.addItemContainer}>
          <TextInput
            style={styles.addItemInput}
            value={currentSkill}
            onChangeText={setCurrentSkill}
            placeholder="Enter a technical skill"
            returnKeyType="done"
            onSubmitEditing={addSkill}
          />
          <TouchableOpacity style={styles.addButton} onPress={addSkill}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipContainer}>
          {educationData.technicalSkills.map((skill, index) => (
            <TouchableOpacity
              key={index}
              style={styles.chip}
              onPress={() => removeSkill(index)}
            >
              <Text style={styles.chipText}>{skill}</Text>
              <Text style={styles.chipRemove}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Certifications */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('certifications', language)}
        </Text>
        <View style={styles.addItemContainer}>
          <TextInput
            style={styles.addItemInput}
            value={currentCertification}
            onChangeText={setCurrentCertification}
            placeholder="Enter certification name"
            returnKeyType="done"
            onSubmitEditing={addCertification}
          />
          <TouchableOpacity style={styles.addButton} onPress={addCertification}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipContainer}>
          {educationData.certifications.map((cert, index) => (
            <TouchableOpacity
              key={index}
              style={styles.chip}
              onPress={() => removeCertification(index)}
            >
              <Text style={styles.chipText}>{cert}</Text>
              <Text style={styles.chipRemove}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Languages Known */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {getLocalizedText('languages_known', language)} *
        </Text>
        <TouchableOpacity
          style={styles.languageSelector}
          onPress={() => setShowLanguageModal(true)}
        >
          <Text style={styles.languageSelectorText}>
            Select Languages ({educationData.languagesKnown.length} selected)
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>
        <View style={styles.chipContainer}>
          {educationData.languagesKnown.map((lang, index) => (
            <View key={index} style={styles.chip}>
              <Text style={styles.chipText}>
                {getLocalizedText(lang, language)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );

  const renderQualificationModal = () => (
    <Modal
      visible={showQualificationModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowQualificationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {getLocalizedText('select_qualification', language)}
          </Text>
          <ScrollView style={styles.modalScrollView}>
            {QUALIFICATION_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.modalOption}
                onPress={() => {
                  handleQualificationChange(0, 'level', level);
                  setShowQualificationModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>
                  {getLocalizedText(level, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button
            title={getLocalizedText('cancel', language)}
            onPress={() => setShowQualificationModal(false)}
            variant="outline"
          />
        </View>
      </View>
    </Modal>
  );

  const renderLanguageModal = () => (
    <Modal
      visible={showLanguageModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowLanguageModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {getLocalizedText('languages_known', language)}
          </Text>
          <ScrollView style={styles.modalScrollView}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.modalOption,
                  educationData.languagesKnown.includes(lang) && styles.modalOptionSelected
                ]}
                onPress={() => toggleLanguage(lang)}
              >
                <Text style={[
                  styles.modalOptionText,
                  educationData.languagesKnown.includes(lang) && styles.modalOptionTextSelected
                ]}>
                  {educationData.languagesKnown.includes(lang) ? '✓ ' : ''}
                  {getLocalizedText(lang, language)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button
            title={getLocalizedText('save', language)}
            onPress={() => setShowLanguageModal(false)}
            variant="primary"
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('education_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('education_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Qualifications */}
        {educationData.qualifications.map((qualification, index) =>
          renderQualificationCard(qualification, index)
        )}
        
        {/* Add Qualification Button */}
        <View style={styles.addQualificationContainer}>
          <Button
            title={getLocalizedText('add_qualification', language)}
            onPress={addQualification}
            variant="outline"
            size="medium"
          />
        </View>

        {/* Skills and Certifications */}
        {renderSkillsSection()}
        
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
          disabled={educationData.qualifications.length === 0}
        />
      </View>

      {/* Modals */}
      {renderQualificationModal()}
      {renderLanguageModal()}
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
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  gradeTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  gradeTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  gradeTypeButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  gradeTypeButtonText: {
    fontSize: 14,
    color: '#757575',
  },
  gradeTypeButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  removeButton: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
  addQualificationContainer: {
    marginHorizontal: 8,
    marginVertical: 16,
  },
  addItemContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  addItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 14,
    color: '#2196F3',
  },
  chipRemove: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  languageSelector: {
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
  languageSelectorText: {
    fontSize: 16,
    color: '#212121',
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
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 300,
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#212121',
  },
  modalOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '500',
  },
});
