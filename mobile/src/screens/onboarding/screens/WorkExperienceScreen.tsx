/**
 * Work Experience Screen - Employment history collection
 * 
 * Features:
 * - Multiple work experience entries
 * - Employment type classification
 * - Skills and responsibilities tracking
 * - Salary information (optional)
 * - Reference contact details
 * - Experience verification
 * - Fresh graduate option
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
      lastName: 'Doe'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    experience_title: 'Work Experience',
    experience_subtitle: 'Tell us about your professional background',
    work_experience: 'Work Experience',
    add_experience: 'Add Work Experience',
    fresh_graduate: 'I am a fresh graduate',
    fresh_graduate_help: 'Check this if you have no work experience',
    no_experience_yet: 'No work experience added yet',
    
    // Experience form fields
    company_name: 'Company Name',
    job_title: 'Job Title/Position',
    employment_type: 'Employment Type',
    start_date: 'Start Date',
    end_date: 'End Date',
    current_job: 'Currently Working Here',
    job_description: 'Job Description',
    key_responsibilities: 'Key Responsibilities',
    skills_used: 'Skills Used',
    achievements: 'Major Achievements',
    salary_range: 'Salary Range (Optional)',
    reason_for_leaving: 'Reason for Leaving',
    
    // Reference information
    reference_details: 'Reference Details',
    reference_name: 'Reference Name',
    reference_title: 'Reference Title',
    reference_phone: 'Reference Phone',
    reference_email: 'Reference Email',
    can_contact_reference: 'Can contact this reference',
    
    // Employment types
    full_time: 'Full Time',
    part_time: 'Part Time',
    contract: 'Contract',
    internship: 'Internship',
    freelance: 'Freelance',
    consultant: 'Consultant',
    
    // Actions
    save_experience: 'Save Experience',
    edit_experience: 'Edit Experience',
    delete_experience: 'Delete Experience',
    continue: 'Continue',
    skip: 'Skip for Now',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_date: 'Please enter a valid date',
    end_date_before_start: 'End date cannot be before start date',
    invalid_email: 'Please enter a valid email address',
    invalid_phone: 'Please enter a valid phone number',
    
    // Placeholders
    enter_company_name: 'e.g., ABC Technologies Pvt Ltd',
    enter_job_title: 'e.g., Software Developer',
    enter_description: 'Brief description of your role...',
    enter_responsibilities: 'List your main responsibilities...',
    enter_skills: 'e.g., JavaScript, React, Node.js',
    enter_achievements: 'Your major accomplishments...',
    enter_salary_range: 'e.g., ₹5,00,000 - ₹7,00,000',
    enter_leaving_reason: 'e.g., Career growth, Better opportunity',
    enter_reference_name: 'Reference person name',
    enter_reference_title: 'Their job title',
    enter_reference_phone: '+91 98765 43210',
    enter_reference_email: 'reference@company.com',
    
    // Date placeholders
    select_start_date: 'Select start date',
    select_end_date: 'Select end date',
    
    // Fresh graduate texts
    fresher_message: 'No problem! We\'ll help you showcase your education, projects, and skills.',
    fresher_note: 'You can add internships, projects, or volunteer work if any.',
    
    // Confirmation messages
    delete_confirmation: 'Are you sure you want to delete this work experience?',
    unsaved_changes: 'You have unsaved changes. Do you want to save them?',
  };
  return texts[key] || key;
};

interface WorkExperience {
  id: string;
  companyName: string;
  jobTitle: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  isCurrentJob: boolean;
  jobDescription: string;
  responsibilities: string;
  skillsUsed: string;
  achievements: string;
  salaryRange: string;
  reasonForLeaving: string;
  reference: {
    name: string;
    title: string;
    phone: string;
    email: string;
    canContact: boolean;
  };
}

interface WorkExperienceData {
  experiences: WorkExperience[];
  isFreshGraduate: boolean;
  totalExperienceYears: number;
  timestamp: string;
}

const EMPLOYMENT_TYPES = [
  'full_time', 'part_time', 'contract', 'internship', 'freelance', 'consultant'
];

const EMPTY_EXPERIENCE: WorkExperience = {
  id: '',
  companyName: '',
  jobTitle: '',
  employmentType: '',
  startDate: '',
  endDate: '',
  isCurrentJob: false,
  jobDescription: '',
  responsibilities: '',
  skillsUsed: '',
  achievements: '',
  salaryRange: '',
  reasonForLeaving: '',
  reference: {
    name: '',
    title: '',
    phone: '',
    email: '',
    canContact: false,
  },
};

export default function WorkExperienceScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [experienceData, setExperienceData] = useState<WorkExperienceData>({
    experiences: [],
    isFreshGraduate: false,
    totalExperienceYears: 0,
    timestamp: '',
  });
  
  const [currentExperience, setCurrentExperience] = useState<WorkExperience>(EMPTY_EXPERIENCE);
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [showEmploymentTypePicker, setShowEmploymentTypePicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadSavedData();
  }, []);

  useEffect(() => {
    calculateTotalExperience();
  }, [experienceData.experiences]);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`experience_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setExperienceData(data);
      }
    } catch (error) {
      console.error('Failed to load saved experience data:', error);
    }
  };

  const calculateTotalExperience = () => {
    if (experienceData.experiences.length === 0) {
      setExperienceData(prev => ({ ...prev, totalExperienceYears: 0 }));
      return;
    }

    let totalMonths = 0;
    experienceData.experiences.forEach(exp => {
      if (exp.startDate) {
        const startDate = new Date(exp.startDate);
        const endDate = exp.isCurrentJob ? new Date() : new Date(exp.endDate || new Date());
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        totalMonths += diffMonths;
      }
    });

    const totalYears = Math.round((totalMonths / 12) * 10) / 10;
    setExperienceData(prev => ({ ...prev, totalExperienceYears: totalYears }));
  };

  const validateExperienceForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Required fields
    if (!currentExperience.companyName.trim()) {
      newErrors.companyName = getLocalizedText('required_field', language);
    }
    if (!currentExperience.jobTitle.trim()) {
      newErrors.jobTitle = getLocalizedText('required_field', language);
    }
    if (!currentExperience.employmentType) {
      newErrors.employmentType = getLocalizedText('required_field', language);
    }
    if (!currentExperience.startDate) {
      newErrors.startDate = getLocalizedText('required_field', language);
    }
    if (!currentExperience.isCurrentJob && !currentExperience.endDate) {
      newErrors.endDate = getLocalizedText('required_field', language);
    }

    // Date validation
    if (currentExperience.startDate && currentExperience.endDate && !currentExperience.isCurrentJob) {
      const startDate = new Date(currentExperience.startDate);
      const endDate = new Date(currentExperience.endDate);
      if (endDate < startDate) {
        newErrors.endDate = getLocalizedText('end_date_before_start', language);
      }
    }

    // Reference email validation
    if (currentExperience.reference.email && 
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentExperience.reference.email)) {
      newErrors.referenceEmail = getLocalizedText('invalid_email', language);
    }

    // Reference phone validation
    if (currentExperience.reference.phone && 
        !/^[\+]?[1-9][\d]{9,14}$/.test(currentExperience.reference.phone.replace(/\s/g, ''))) {
      newErrors.referencePhone = getLocalizedText('invalid_phone', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleExperienceInputChange = (field: string, value: string | boolean) => {
    if (field.startsWith('reference.')) {
      const referenceField = field.split('.')[1];
      setCurrentExperience(prev => ({
        ...prev,
        reference: {
          ...prev.reference,
          [referenceField]: value,
        },
      }));
    } else {
      setCurrentExperience(prev => ({ ...prev, [field]: value }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Auto-clear end date if current job is selected
    if (field === 'isCurrentJob' && value === true) {
      setCurrentExperience(prev => ({ ...prev, endDate: '' }));
    }
  };

  const saveExperience = () => {
    if (!validateExperienceForm()) return;

    const experienceToSave = {
      ...currentExperience,
      id: editingExperienceId || `exp_${Date.now()}`,
    };

    if (editingExperienceId) {
      // Update existing experience
      setExperienceData(prev => ({
        ...prev,
        experiences: prev.experiences.map(exp => 
          exp.id === editingExperienceId ? experienceToSave : exp
        ),
      }));
    } else {
      // Add new experience
      setExperienceData(prev => ({
        ...prev,
        experiences: [...prev.experiences, experienceToSave],
      }));
    }

    // Reset form
    setCurrentExperience(EMPTY_EXPERIENCE);
    setEditingExperienceId(null);
    setShowExperienceForm(false);
    setErrors({});
  };

  const editExperience = (experience: WorkExperience) => {
    setCurrentExperience(experience);
    setEditingExperienceId(experience.id);
    setShowExperienceForm(true);
  };

  const deleteExperience = (experienceId: string) => {
    Alert.alert(
      getLocalizedText('delete_experience', language),
      getLocalizedText('delete_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setExperienceData(prev => ({
              ...prev,
              experiences: prev.experiences.filter(exp => exp.id !== experienceId),
            }));
          },
        },
      ]
    );
  };

  const handleContinue = async () => {
    const finalData: WorkExperienceData = {
      ...experienceData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `experience_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ experienceData: finalData });
    } catch (error) {
      console.error('Failed to save experience data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Work Experience?',
      'Work experience helps us understand your background and find suitable opportunities.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            experienceData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderExperienceCard = (experience: WorkExperience) => (
    <Card key={experience.id} variant="outlined" margin={8}>
      <View style={styles.experienceHeader}>
        <View style={styles.experienceInfo}>
          <Text style={styles.experienceTitle}>{experience.jobTitle}</Text>
          <Text style={styles.experienceCompany}>{experience.companyName}</Text>
          <Text style={styles.experienceType}>
            {getLocalizedText(experience.employmentType, language)}
          </Text>
          <Text style={styles.experienceDuration}>
            {experience.startDate} - {experience.isCurrentJob ? 'Present' : experience.endDate}
          </Text>
        </View>
        
        <View style={styles.experienceActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => editExperience(experience)}
          >
            <Text style={styles.actionButtonText}>✏️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => deleteExperience(experience.id)}
          >
            <Text style={styles.actionButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {experience.jobDescription && (
        <Text style={styles.experienceDescription} numberOfLines={3}>
          {experience.jobDescription}
        </Text>
      )}

      {experience.skillsUsed && (
        <View style={styles.skillsContainer}>
          <Text style={styles.skillsLabel}>Skills:</Text>
          <Text style={styles.skillsText}>{experience.skillsUsed}</Text>
        </View>
      )}
    </Card>
  );

  const renderExperienceForm = () => (
    <Modal
      visible={showExperienceForm}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowExperienceForm(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowExperienceForm(false)}>
            <Text style={styles.modalCloseButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingExperienceId ? 
              getLocalizedText('edit_experience', language) : 
              getLocalizedText('add_experience', language)
            }
          </Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Company and Job Title */}
          <Input
            label={getLocalizedText('company_name', language)}
            value={currentExperience.companyName}
            onChangeText={(text) => handleExperienceInputChange('companyName', text)}
            error={errors.companyName}
            required
            placeholder={getLocalizedText('enter_company_name', language)}
          />

          <Input
            label={getLocalizedText('job_title', language)}
            value={currentExperience.jobTitle}
            onChangeText={(text) => handleExperienceInputChange('jobTitle', text)}
            error={errors.jobTitle}
            required
            placeholder={getLocalizedText('enter_job_title', language)}
          />

          {/* Employment Type */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('employment_type', language)} *
            </Text>
            <TouchableOpacity
              style={[styles.pickerButton, errors.employmentType && styles.inputError]}
              onPress={() => setShowEmploymentTypePicker(!showEmploymentTypePicker)}
            >
              <Text style={[styles.pickerButtonText, !currentExperience.employmentType && styles.placeholderText]}>
                {currentExperience.employmentType 
                  ? getLocalizedText(currentExperience.employmentType, language)
                  : 'Select employment type'
                }
              </Text>
              <Text style={styles.pickerArrow}>{showEmploymentTypePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showEmploymentTypePicker && (
              <View style={styles.pickerContainer}>
                {EMPLOYMENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      currentExperience.employmentType === type && styles.pickerOptionSelected
                    ]}
                    onPress={() => {
                      handleExperienceInputChange('employmentType', type);
                      setShowEmploymentTypePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      currentExperience.employmentType === type && styles.pickerOptionTextSelected
                    ]}>
                      {getLocalizedText(type, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.employmentType && (
              <Text style={styles.errorText}>{errors.employmentType}</Text>
            )}
          </View>

          {/* Dates */}
          <Input
            label={getLocalizedText('start_date', language)}
            value={currentExperience.startDate}
            onChangeText={(text) => handleExperienceInputChange('startDate', text)}
            error={errors.startDate}
            required
            placeholder={getLocalizedText('select_start_date', language)}
          />

          {/* Current Job Toggle */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>
              {getLocalizedText('current_job', language)}
            </Text>
            <Switch
              value={currentExperience.isCurrentJob}
              onValueChange={(value) => handleExperienceInputChange('isCurrentJob', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={currentExperience.isCurrentJob ? '#4CAF50' : '#f4f3f4'}
            />
          </View>

          {!currentExperience.isCurrentJob && (
            <Input
              label={getLocalizedText('end_date', language)}
              value={currentExperience.endDate}
              onChangeText={(text) => handleExperienceInputChange('endDate', text)}
              error={errors.endDate}
              required
              placeholder={getLocalizedText('select_end_date', language)}
            />
          )}

          {/* Job Description */}
          <Input
            label={getLocalizedText('job_description', language)}
            value={currentExperience.jobDescription}
            onChangeText={(text) => handleExperienceInputChange('jobDescription', text)}
            placeholder={getLocalizedText('enter_description', language)}
            multiline
            numberOfLines={3}
          />

          <Input
            label={getLocalizedText('key_responsibilities', language)}
            value={currentExperience.responsibilities}
            onChangeText={(text) => handleExperienceInputChange('responsibilities', text)}
            placeholder={getLocalizedText('enter_responsibilities', language)}
            multiline
            numberOfLines={3}
          />

          <Input
            label={getLocalizedText('skills_used', language)}
            value={currentExperience.skillsUsed}
            onChangeText={(text) => handleExperienceInputChange('skillsUsed', text)}
            placeholder={getLocalizedText('enter_skills', language)}
          />

          <Input
            label={getLocalizedText('achievements', language)}
            value={currentExperience.achievements}
            onChangeText={(text) => handleExperienceInputChange('achievements', text)}
            placeholder={getLocalizedText('enter_achievements', language)}
            multiline
            numberOfLines={3}
          />

          <Input
            label={getLocalizedText('salary_range', language)}
            value={currentExperience.salaryRange}
            onChangeText={(text) => handleExperienceInputChange('salaryRange', text)}
            placeholder={getLocalizedText('enter_salary_range', language)}
          />

          {!currentExperience.isCurrentJob && (
            <Input
              label={getLocalizedText('reason_for_leaving', language)}
              value={currentExperience.reasonForLeaving}
              onChangeText={(text) => handleExperienceInputChange('reasonForLeaving', text)}
              placeholder={getLocalizedText('enter_leaving_reason', language)}
            />
          )}

          {/* Reference Details */}
          <Text style={styles.sectionTitle}>
            {getLocalizedText('reference_details', language)}
          </Text>

          <Input
            label={getLocalizedText('reference_name', language)}
            value={currentExperience.reference.name}
            onChangeText={(text) => handleExperienceInputChange('reference.name', text)}
            placeholder={getLocalizedText('enter_reference_name', language)}
          />

          <Input
            label={getLocalizedText('reference_title', language)}
            value={currentExperience.reference.title}
            onChangeText={(text) => handleExperienceInputChange('reference.title', text)}
            placeholder={getLocalizedText('enter_reference_title', language)}
          />

          <Input
            label={getLocalizedText('reference_phone', language)}
            value={currentExperience.reference.phone}
            onChangeText={(text) => handleExperienceInputChange('reference.phone', text)}
            error={errors.referencePhone}
            placeholder={getLocalizedText('enter_reference_phone', language)}
            keyboardType="phone-pad"
          />

          <Input
            label={getLocalizedText('reference_email', language)}
            value={currentExperience.reference.email}
            onChangeText={(text) => handleExperienceInputChange('reference.email', text)}
            error={errors.referenceEmail}
            placeholder={getLocalizedText('enter_reference_email', language)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>
              {getLocalizedText('can_contact_reference', language)}
            </Text>
            <Switch
              value={currentExperience.reference.canContact}
              onValueChange={(value) => handleExperienceInputChange('reference.canContact', value)}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={currentExperience.reference.canContact ? '#4CAF50' : '#f4f3f4'}
            />
          </View>

          <View style={styles.spacer} />
        </ScrollView>

        <View style={styles.modalActions}>
          <Button
            title={getLocalizedText('save_experience', language)}
            onPress={saveExperience}
            variant="primary"
            size="large"
            fullWidth
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
          {getLocalizedText('experience_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('experience_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Fresh Graduate Option */}
        <Card variant="outlined" margin={8}>
          <View style={styles.freshGraduateContainer}>
            <View style={styles.freshGraduateContent}>
              <Text style={styles.freshGraduateLabel}>
                {getLocalizedText('fresh_graduate', language)}
              </Text>
              <Text style={styles.freshGraduateHelp}>
                {getLocalizedText('fresh_graduate_help', language)}
              </Text>
            </View>
            <Switch
              value={experienceData.isFreshGraduate}
              onValueChange={(value) => setExperienceData(prev => ({ ...prev, isFreshGraduate: value }))}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={experienceData.isFreshGraduate ? '#4CAF50' : '#f4f3f4'}
            />
          </View>

          {experienceData.isFreshGraduate && (
            <View style={styles.fresherMessageContainer}>
              <Text style={styles.fresherMessage}>
                {getLocalizedText('fresher_message', language)}
              </Text>
              <Text style={styles.fresherNote}>
                {getLocalizedText('fresher_note', language)}
              </Text>
            </View>
          )}
        </Card>

        {/* Work Experience Section */}
        {!experienceData.isFreshGraduate && (
          <Card 
            title={`${getLocalizedText('work_experience', language)} (${experienceData.totalExperienceYears} years)`}
            variant="outlined" 
            margin={8}
            action={
              <Button
                title={getLocalizedText('add_experience', language)}
                onPress={() => {
                  setCurrentExperience(EMPTY_EXPERIENCE);
                  setEditingExperienceId(null);
                  setShowExperienceForm(true);
                }}
                variant="outline"
                size="small"
                icon={<Text style={styles.addIcon}>+</Text>}
              />
            }
          >
            {experienceData.experiences.length === 0 ? (
              <View style={styles.noExperienceContainer}>
                <Text style={styles.noExperienceText}>
                  {getLocalizedText('no_experience_yet', language)}
                </Text>
              </View>
            ) : (
              experienceData.experiences.map(renderExperienceCard)
            )}
          </Card>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Experience Form Modal */}
      {renderExperienceForm()}

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
  freshGraduateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  freshGraduateContent: {
    flex: 1,
    marginRight: 16,
  },
  freshGraduateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
    marginBottom: 4,
  },
  freshGraduateHelp: {
    fontSize: 14,
    color: '#757575',
  },
  fresherMessageContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  fresherMessage: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
    marginBottom: 8,
  },
  fresherNote: {
    fontSize: 14,
    color: '#388E3C',
  },
  noExperienceContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noExperienceText: {
    fontSize: 16,
    color: '#757575',
    fontStyle: 'italic',
  },
  addIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  experienceInfo: {
    flex: 1,
  },
  experienceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  experienceCompany: {
    fontSize: 16,
    color: '#424242',
    marginBottom: 4,
  },
  experienceType: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  experienceDuration: {
    fontSize: 14,
    color: '#757575',
  },
  experienceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
  },
  experienceDescription: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginBottom: 8,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  skillsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    marginRight: 8,
  },
  skillsText: {
    fontSize: 14,
    color: '#2196F3',
    flex: 1,
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
  inputError: {
    borderColor: '#F44336',
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
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginTop: 24,
    marginBottom: 16,
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
