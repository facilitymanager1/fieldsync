/**
 * Training Records Screen - Skills, certifications, and training management
 * 
 * Features:
 * - Professional certifications tracking
 * - Skills assessment and proficiency levels
 * - Training courses and completion status
 * - Compliance training requirements
 * - License renewals and expiry tracking
 * - Continuing education units (CEUs)
 * - Industry-specific qualifications
 * - Training schedule and planning
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
    workExperience: [
      {
        jobTitle: 'Field Technician',
        company: 'TechCorp',
        industry: 'Facilities Management'
      }
    ]
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    training_title: 'Training Records',
    training_subtitle: 'Please provide your training, certifications, and skills information',
    
    // Sections
    certifications: 'Professional Certifications',
    skills_assessment: 'Skills Assessment',
    training_courses: 'Training Courses',
    compliance_training: 'Compliance Training',
    licenses_permits: 'Professional Licenses & Permits',
    continuing_education: 'Continuing Education',
    industry_qualifications: 'Industry-Specific Qualifications',
    training_schedule: 'Training Schedule & Plans',
    
    // Certifications
    certification_name: 'Certification Name',
    issuing_organization: 'Issuing Organization',
    certification_number: 'Certification Number',
    issue_date: 'Issue Date',
    expiry_date: 'Expiry Date',
    renewal_required: 'Renewal Required',
    renewal_date: 'Next Renewal Date',
    certification_level: 'Certification Level',
    certification_status: 'Status',
    verification_url: 'Verification URL',
    
    // Common Certifications
    safety_certification: 'Safety Certification',
    first_aid_cpr: 'First Aid & CPR',
    electrical_safety: 'Electrical Safety',
    confined_space: 'Confined Space Entry',
    height_safety: 'Working at Heights',
    hazmat_handling: 'Hazmat Handling',
    fire_safety: 'Fire Safety',
    equipment_operation: 'Equipment Operation',
    quality_management: 'Quality Management (ISO)',
    environmental_management: 'Environmental Management',
    project_management: 'Project Management (PMP)',
    itil_certification: 'ITIL Certification',
    
    // Certification Levels
    basic_level: 'Basic',
    intermediate_level: 'Intermediate',
    advanced_level: 'Advanced',
    expert_level: 'Expert',
    master_level: 'Master',
    
    // Certification Status
    active_status: 'Active',
    expired_status: 'Expired',
    pending_renewal: 'Pending Renewal',
    in_progress: 'In Progress',
    suspended_status: 'Suspended',
    
    // Skills Assessment
    skill_name: 'Skill Name',
    proficiency_level: 'Proficiency Level',
    years_experience: 'Years of Experience',
    last_used: 'Last Used',
    skill_category: 'Category',
    self_assessment: 'Self Assessment',
    verified_by: 'Verified By',
    assessment_date: 'Assessment Date',
    
    // Proficiency Levels
    beginner: 'Beginner (1-2)',
    novice: 'Novice (2-3)',
    intermediate: 'Intermediate (3-5)',
    proficient: 'Proficient (5-8)',
    expert: 'Expert (8+)',
    
    // Skill Categories
    technical_skills: 'Technical Skills',
    software_skills: 'Software Skills',
    communication_skills: 'Communication Skills',
    leadership_skills: 'Leadership Skills',
    safety_skills: 'Safety Skills',
    maintenance_skills: 'Maintenance Skills',
    customer_service: 'Customer Service',
    problem_solving: 'Problem Solving',
    
    // Common Skills
    electrical_work: 'Electrical Work',
    plumbing: 'Plumbing',
    hvac_systems: 'HVAC Systems',
    carpentry: 'Carpentry',
    painting: 'Painting',
    welding: 'Welding',
    equipment_maintenance: 'Equipment Maintenance',
    facility_management: 'Facility Management',
    security_systems: 'Security Systems',
    fire_systems: 'Fire Safety Systems',
    building_automation: 'Building Automation',
    energy_management: 'Energy Management',
    
    // Training Courses
    course_name: 'Course Name',
    training_provider: 'Training Provider',
    course_duration: 'Duration (hours)',
    completion_date: 'Completion Date',
    course_status: 'Status',
    certificate_received: 'Certificate Received',
    course_cost: 'Course Cost',
    funded_by: 'Funded By',
    course_rating: 'Course Rating',
    course_notes: 'Notes/Comments',
    
    // Course Status
    not_started: 'Not Started',
    in_progress_course: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    
    // Funding Sources
    self_funded: 'Self Funded',
    company_funded: 'Company Funded',
    government_funded: 'Government Funded',
    scholarship: 'Scholarship',
    
    // Compliance Training
    compliance_type: 'Compliance Type',
    mandatory_training: 'Mandatory Training',
    completion_deadline: 'Completion Deadline',
    compliance_status: 'Compliance Status',
    last_completed: 'Last Completed',
    next_due_date: 'Next Due Date',
    frequency: 'Training Frequency',
    compliance_officer: 'Compliance Officer',
    
    // Compliance Types
    safety_compliance: 'Safety Compliance',
    environmental_compliance: 'Environmental Compliance',
    data_protection: 'Data Protection',
    anti_harassment: 'Anti-Harassment',
    diversity_inclusion: 'Diversity & Inclusion',
    code_of_conduct: 'Code of Conduct',
    cybersecurity: 'Cybersecurity',
    quality_standards: 'Quality Standards',
    
    // Training Frequency
    annual: 'Annual',
    biannual: 'Bi-Annual',
    quarterly: 'Quarterly',
    monthly: 'Monthly',
    as_required: 'As Required',
    one_time: 'One Time',
    
    // Professional Licenses
    license_name: 'License Name',
    license_number: 'License Number',
    issuing_authority: 'Issuing Authority',
    license_type: 'License Type',
    license_level: 'License Level',
    license_status: 'License Status',
    license_restrictions: 'Restrictions/Conditions',
    ceu_requirements: 'CEU Requirements',
    
    // License Types
    professional_license: 'Professional License',
    trade_license: 'Trade License',
    operator_license: 'Operator License',
    safety_license: 'Safety License',
    
    // Continuing Education
    ceu_earned: 'CEUs Earned',
    ceu_required: 'CEUs Required',
    reporting_period: 'Reporting Period',
    education_provider: 'Education Provider',
    education_topic: 'Topic/Subject',
    education_hours: 'Contact Hours',
    education_type: 'Education Type',
    
    // Education Types
    classroom_training: 'Classroom Training',
    online_training: 'Online Training',
    webinar: 'Webinar',
    conference: 'Conference',
    workshop: 'Workshop',
    seminar: 'Seminar',
    self_study: 'Self Study',
    
    // Training Schedule
    upcoming_training: 'Upcoming Training',
    training_plan: 'Training Plan',
    training_budget: 'Training Budget',
    training_goals: 'Training Goals',
    skill_gaps: 'Identified Skill Gaps',
    development_priorities: 'Development Priorities',
    mentor_coach: 'Mentor/Coach',
    training_calendar: 'Training Calendar',
    
    // Actions
    add_certification: 'Add Certification',
    add_skill: 'Add Skill',
    add_course: 'Add Training Course',
    add_compliance: 'Add Compliance Training',
    add_license: 'Add License/Permit',
    add_education: 'Add Continuing Education',
    assess_skill: 'Assess Skill',
    plan_training: 'Plan Training',
    save_training_records: 'Save Training Records',
    continue: 'Continue',
    skip: 'Skip for Now',
    
    // Modals
    add_certification_modal: 'Add Certification',
    add_skill_modal: 'Add Skill',
    add_course_modal: 'Add Training Course',
    edit_certification: 'Edit Certification',
    edit_skill: 'Edit Skill',
    skill_assessment_modal: 'Skill Assessment',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_date: 'Please enter a valid date',
    invalid_url: 'Please enter a valid URL',
    invalid_number: 'Please enter a valid number',
    expiry_warning: 'This certification will expire soon',
    renewal_overdue: 'Renewal is overdue',
    
    // Placeholders
    enter_certification_name: 'e.g., CompTIA A+, PMP, First Aid',
    enter_organization: 'e.g., CompTIA, PMI, Red Cross',
    enter_cert_number: 'Certification ID/Number',
    enter_skill_name: 'e.g., Electrical Troubleshooting',
    enter_course_name: 'e.g., Advanced HVAC Systems',
    enter_provider: 'Training provider/institution',
    enter_hours: 'Duration in hours',
    enter_cost: 'Cost in ₹',
    enter_url: 'https://verify.example.com',
    select_date: 'Select date',
    select_level: 'Select proficiency level',
    select_category: 'Select category',
    
    // Help texts
    certifications_help: 'Add your professional certifications and licenses',
    skills_help: 'Assess your technical and soft skills proficiency',
    courses_help: 'Track completed and planned training courses',
    compliance_help: 'Mandatory training required by regulations',
    licenses_help: 'Professional licenses required for your role',
    ceu_help: 'Continuing education units for license maintenance',
    schedule_help: 'Plan your professional development activities',
    
    // Warnings and Notifications
    expiring_soon: 'Expiring Soon',
    overdue: 'Overdue',
    renewal_reminder: 'Renewal reminder set',
    compliance_due: 'Compliance training due',
    skill_gap_identified: 'Skill gap identified',
    training_recommended: 'Training recommended',
    
    // Confirmation messages
    skip_training_confirmation: 'Training records help track compliance and development. Are you sure you want to skip?',
    delete_certification_confirmation: 'Are you sure you want to remove this certification?',
    delete_skill_confirmation: 'Are you sure you want to remove this skill?',
    delete_course_confirmation: 'Are you sure you want to remove this course?',
    
    // Rating labels
    excellent: 'Excellent (5)',
    very_good: 'Very Good (4)',
    good: 'Good (3)',
    fair: 'Fair (2)',
    poor: 'Poor (1)',
  };
  return texts[key] || key;
};

interface Certification {
  id: string;
  name: string;
  issuingOrganization: string;
  certificationNumber: string;
  issueDate: string;
  expiryDate: string;
  level: string;
  status: string;
  renewalRequired: boolean;
  verificationUrl: string;
  notes: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  proficiencyLevel: string;
  yearsExperience: number;
  lastUsed: string;
  selfAssessment: number;
  verifiedBy: string;
  assessmentDate: string;
  notes: string;
}

interface TrainingCourse {
  id: string;
  name: string;
  provider: string;
  duration: number;
  completionDate: string;
  status: string;
  certificateReceived: boolean;
  cost: number;
  fundedBy: string;
  rating: number;
  notes: string;
}

interface ComplianceTraining {
  id: string;
  type: string;
  name: string;
  mandatory: boolean;
  completionDeadline: string;
  status: string;
  lastCompleted: string;
  nextDueDate: string;
  frequency: string;
  complianceOfficer: string;
}

interface ProfessionalLicense {
  id: string;
  name: string;
  licenseNumber: string;
  issuingAuthority: string;
  type: string;
  level: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  restrictions: string;
  ceuRequired: number;
  ceuEarned: number;
}

interface ContinuingEducation {
  id: string;
  provider: string;
  topic: string;
  hours: number;
  type: string;
  completionDate: string;
  ceuEarned: number;
  relatedLicense: string;
}

interface TrainingRecordsData {
  certifications: Certification[];
  skills: Skill[];
  trainingCourses: TrainingCourse[];
  complianceTraining: ComplianceTraining[];
  professionalLicenses: ProfessionalLicense[];
  continuingEducation: ContinuingEducation[];
  trainingPlan: {
    goals: string;
    skillGaps: string;
    developmentPriorities: string;
    mentor: string;
    annualBudget: number;
    nextReviewDate: string;
  };
  timestamp: string;
}

const CERTIFICATION_LEVELS = ['basic_level', 'intermediate_level', 'advanced_level', 'expert_level', 'master_level'];
const CERTIFICATION_STATUS = ['active_status', 'expired_status', 'pending_renewal', 'in_progress', 'suspended_status'];
const PROFICIENCY_LEVELS = ['beginner', 'novice', 'intermediate', 'proficient', 'expert'];
const SKILL_CATEGORIES = ['technical_skills', 'software_skills', 'communication_skills', 'leadership_skills', 'safety_skills', 'maintenance_skills'];
const COURSE_STATUS = ['not_started', 'in_progress_course', 'completed', 'failed', 'cancelled'];
const FUNDING_SOURCES = ['self_funded', 'company_funded', 'government_funded', 'scholarship'];
const COMPLIANCE_TYPES = ['safety_compliance', 'environmental_compliance', 'data_protection', 'anti_harassment', 'diversity_inclusion', 'code_of_conduct'];
const TRAINING_FREQUENCY = ['annual', 'biannual', 'quarterly', 'monthly', 'as_required', 'one_time'];
const LICENSE_TYPES = ['professional_license', 'trade_license', 'operator_license', 'safety_license'];
const EDUCATION_TYPES = ['classroom_training', 'online_training', 'webinar', 'conference', 'workshop', 'seminar', 'self_study'];

export default function TrainingRecordsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [trainingData, setTrainingData] = useState<TrainingRecordsData>({
    certifications: [],
    skills: [],
    trainingCourses: [],
    complianceTraining: [],
    professionalLicenses: [],
    continuingEducation: [],
    trainingPlan: {
      goals: '',
      skillGaps: '',
      developmentPriorities: '',
      mentor: '',
      annualBudget: 0,
      nextReviewDate: '',
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
      const saved = await AsyncStorage.getItem(`training_data_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setTrainingData(data);
      }
    } catch (error) {
      console.error('Failed to load saved training data:', error);
    }
  };

  const handleSectionChange = (section: string, field: string, value: any) => {
    setTrainingData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof TrainingRecordsData] as Record<string, any>),
        [field]: value,
      } as any,
    }));
  };

  const addItem = (type: string, item: any) => {
    const id = Date.now().toString();
    const itemWithId = { ...item, id };
    
    setTrainingData(prev => ({
      ...prev,
      [type]: [...prev[type as keyof TrainingRecordsData] as any[], itemWithId],
    }));
    
    setShowModal(null);
    setModalData({});
  };

  const removeItem = (type: string, id: string) => {
    setTrainingData(prev => ({
      ...prev,
      [type]: (prev[type as keyof TrainingRecordsData] as any[]).filter(item => item.id !== id),
    }));
  };

  const getExpiryStatus = (expiryDate: string) => {
    if (!expiryDate) return null;
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'overdue';
    if (daysUntilExpiry <= 30) return 'expiring_soon';
    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Basic validation - no specific requirements for training records
    // Users can skip this section if needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    const finalData: TrainingRecordsData = {
      ...trainingData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `training_data_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ trainingData: finalData });
    } catch (error) {
      console.error('Failed to save training data:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Training Records?',
      getLocalizedText('skip_training_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            trainingData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const renderCertificationsSection = () => (
    <Card title={getLocalizedText('certifications', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('certifications_help', language)}
      </Text>

      {/* Add Certification Button */}
      <Button
        title={getLocalizedText('add_certification', language)}
        onPress={() => setShowModal('certification')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Certifications */}
      {trainingData.certifications.map((cert) => {
        const expiryStatus = getExpiryStatus(cert.expiryDate);
        
        return (
          <View key={cert.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{cert.name}</Text>
              {expiryStatus && (
                <View style={[
                  styles.statusBadge,
                  expiryStatus === 'overdue' ? styles.overdueBadge : styles.expiringSoonBadge
                ]}>
                  <Text style={styles.statusText}>
                    {getLocalizedText(expiryStatus, language)}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => removeItem('certifications', cert.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.itemDetail}>
              {cert.issuingOrganization} - {getLocalizedText(cert.level, language)}
            </Text>
            <Text style={styles.itemDetail}>
              Status: {getLocalizedText(cert.status, language)}
            </Text>
            {cert.expiryDate && (
              <Text style={styles.itemDetail}>
                Expires: {cert.expiryDate}
              </Text>
            )}
          </View>
        );
      })}
    </Card>
  );

  const renderSkillsSection = () => (
    <Card title={getLocalizedText('skills_assessment', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('skills_help', language)}
      </Text>

      {/* Add Skill Button */}
      <Button
        title={getLocalizedText('add_skill', language)}
        onPress={() => setShowModal('skill')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Skills */}
      {trainingData.skills.map((skill) => (
        <View key={skill.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{skill.name}</Text>
            <View style={styles.proficiencyBadge}>
              <Text style={styles.proficiencyText}>
                {getLocalizedText(skill.proficiencyLevel, language)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removeItem('skills', skill.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDetail}>
            {getLocalizedText(skill.category, language)}
          </Text>
          <Text style={styles.itemDetail}>
            Experience: {skill.yearsExperience} years
          </Text>
          {skill.lastUsed && (
            <Text style={styles.itemDetail}>
              Last used: {skill.lastUsed}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );

  const renderTrainingCoursesSection = () => (
    <Card title={getLocalizedText('training_courses', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('courses_help', language)}
      </Text>

      {/* Add Course Button */}
      <Button
        title={getLocalizedText('add_course', language)}
        onPress={() => setShowModal('course')}
        variant="outline"
        size="small"
        icon={<Text style={styles.addIcon}>+</Text>}
      />

      {/* Existing Courses */}
      {trainingData.trainingCourses.map((course) => (
        <View key={course.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{course.name}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {getLocalizedText(course.status, language)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removeItem('trainingCourses', course.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.itemDetail}>
            Provider: {course.provider}
          </Text>
          <Text style={styles.itemDetail}>
            Duration: {course.duration} hours
          </Text>
          {course.completionDate && (
            <Text style={styles.itemDetail}>
              Completed: {course.completionDate}
            </Text>
          )}
          {course.rating > 0 && (
            <Text style={styles.itemDetail}>
              Rating: {'★'.repeat(course.rating)}{'☆'.repeat(5 - course.rating)}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );

  const renderTrainingPlanSection = () => (
    <Card title={getLocalizedText('training_schedule', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('schedule_help', language)}
      </Text>

      <Input
        label={getLocalizedText('training_goals', language)}
        value={trainingData.trainingPlan.goals}
        onChangeText={(text) => handleSectionChange('trainingPlan', 'goals', text)}
        placeholder="Your professional development goals"
        multiline
        numberOfLines={3}
      />

      <Input
        label={getLocalizedText('skill_gaps', language)}
        value={trainingData.trainingPlan.skillGaps}
        onChangeText={(text) => handleSectionChange('trainingPlan', 'skillGaps', text)}
        placeholder="Skills you need to develop"
        multiline
        numberOfLines={3}
      />

      <Input
        label={getLocalizedText('development_priorities', language)}
        value={trainingData.trainingPlan.developmentPriorities}
        onChangeText={(text) => handleSectionChange('trainingPlan', 'developmentPriorities', text)}
        placeholder="Top 3 development priorities"
        multiline
        numberOfLines={3}
      />

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Input
            label={getLocalizedText('mentor_coach', language)}
            value={trainingData.trainingPlan.mentor}
            onChangeText={(text) => handleSectionChange('trainingPlan', 'mentor', text)}
            placeholder="Mentor or coach name"
          />
        </View>
        <View style={styles.halfWidth}>
          <Input
            label={getLocalizedText('training_budget', language)}
            value={trainingData.trainingPlan.annualBudget.toString()}
            onChangeText={(text) => handleSectionChange('trainingPlan', 'annualBudget', parseFloat(text) || 0)}
            placeholder={getLocalizedText('enter_cost', language)}
            keyboardType="numeric"
          />
        </View>
      </View>
    </Card>
  );

  const renderModals = () => (
    <>
      {/* Certification Modal */}
      <Modal
        visible={showModal === 'certification'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollView}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {getLocalizedText('add_certification_modal', language)}
              </Text>
              
              <Input
                label={getLocalizedText('certification_name', language)}
                value={modalData.name || ''}
                onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
                placeholder={getLocalizedText('enter_certification_name', language)}
              />
              
              <Input
                label={getLocalizedText('issuing_organization', language)}
                value={modalData.issuingOrganization || ''}
                onChangeText={(text) => setModalData(prev => ({ ...prev, issuingOrganization: text }))}
                placeholder={getLocalizedText('enter_organization', language)}
              />
              
              <Input
                label={getLocalizedText('certification_number', language)}
                value={modalData.certificationNumber || ''}
                onChangeText={(text) => setModalData(prev => ({ ...prev, certificationNumber: text }))}
                placeholder={getLocalizedText('enter_cert_number', language)}
              />
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  {getLocalizedText('certification_level', language)}
                </Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowPicker(showPicker === 'certLevel' ? null : 'certLevel')}
                >
                  <Text style={[styles.pickerButtonText, !modalData.level && styles.placeholderText]}>
                    {modalData.level 
                      ? getLocalizedText(modalData.level, language)
                      : getLocalizedText('select_level', language)
                    }
                  </Text>
                  <Text style={styles.pickerArrow}>{showPicker === 'certLevel' ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                
                {showPicker === 'certLevel' && (
                  <View style={styles.pickerContainer}>
                    {CERTIFICATION_LEVELS.map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={styles.pickerOption}
                        onPress={() => {
                          setModalData(prev => ({ ...prev, level }));
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
              
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label={getLocalizedText('issue_date', language)}
                    value={modalData.issueDate || ''}
                    onChangeText={(text) => setModalData(prev => ({ ...prev, issueDate: text }))}
                    placeholder={getLocalizedText('select_date', language)}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label={getLocalizedText('expiry_date', language)}
                    value={modalData.expiryDate || ''}
                    onChangeText={(text) => setModalData(prev => ({ ...prev, expiryDate: text }))}
                    placeholder={getLocalizedText('select_date', language)}
                  />
                </View>
              </View>
              
              <Input
                label={getLocalizedText('verification_url', language)}
                value={modalData.verificationUrl || ''}
                onChangeText={(text) => setModalData(prev => ({ ...prev, verificationUrl: text }))}
                placeholder={getLocalizedText('enter_url', language)}
                keyboardType="url"
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
                  onPress={() => addItem('certifications', {
                    ...modalData,
                    status: 'active_status',
                    renewalRequired: modalData.expiryDate ? true : false
                  })}
                  variant="primary"
                  size="medium"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Skill Modal */}
      <Modal
        visible={showModal === 'skill'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('add_skill_modal', language)}
            </Text>
            
            <Input
              label={getLocalizedText('skill_name', language)}
              value={modalData.name || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
              placeholder={getLocalizedText('enter_skill_name', language)}
            />
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {getLocalizedText('skill_category', language)}
              </Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPicker(showPicker === 'skillCategory' ? null : 'skillCategory')}
              >
                <Text style={[styles.pickerButtonText, !modalData.category && styles.placeholderText]}>
                  {modalData.category 
                    ? getLocalizedText(modalData.category, language)
                    : getLocalizedText('select_category', language)
                  }
                </Text>
                <Text style={styles.pickerArrow}>{showPicker === 'skillCategory' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              
              {showPicker === 'skillCategory' && (
                <View style={styles.pickerContainer}>
                  {SKILL_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={styles.pickerOption}
                      onPress={() => {
                        setModalData(prev => ({ ...prev, category }));
                        setShowPicker(null);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>
                        {getLocalizedText(category, language)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {getLocalizedText('proficiency_level', language)}
              </Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPicker(showPicker === 'proficiency' ? null : 'proficiency')}
              >
                <Text style={[styles.pickerButtonText, !modalData.proficiencyLevel && styles.placeholderText]}>
                  {modalData.proficiencyLevel 
                    ? getLocalizedText(modalData.proficiencyLevel, language)
                    : getLocalizedText('select_level', language)
                  }
                </Text>
                <Text style={styles.pickerArrow}>{showPicker === 'proficiency' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              
              {showPicker === 'proficiency' && (
                <View style={styles.pickerContainer}>
                  {PROFICIENCY_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={styles.pickerOption}
                      onPress={() => {
                        setModalData(prev => ({ ...prev, proficiencyLevel: level }));
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
            
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label={getLocalizedText('years_experience', language)}
                  value={modalData.yearsExperience?.toString() || ''}
                  onChangeText={(text) => setModalData(prev => ({ ...prev, yearsExperience: parseInt(text) || 0 }))}
                  placeholder="Years"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label={getLocalizedText('last_used', language)}
                  value={modalData.lastUsed || ''}
                  onChangeText={(text) => setModalData(prev => ({ ...prev, lastUsed: text }))}
                  placeholder="When last used"
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowModal(null)}
                variant="text"
                size="medium"
              />
              <Button
                title="Add"
                onPress={() => addItem('skills', {
                  ...modalData,
                  selfAssessment: 3,
                  assessmentDate: new Date().toISOString().split('T')[0]
                })}
                variant="primary"
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Training Course Modal */}
      <Modal
        visible={showModal === 'course'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getLocalizedText('add_course_modal', language)}
            </Text>
            
            <Input
              label={getLocalizedText('course_name', language)}
              value={modalData.name || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, name: text }))}
              placeholder={getLocalizedText('enter_course_name', language)}
            />
            
            <Input
              label={getLocalizedText('training_provider', language)}
              value={modalData.provider || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, provider: text }))}
              placeholder={getLocalizedText('enter_provider', language)}
            />
            
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label={getLocalizedText('course_duration', language)}
                  value={modalData.duration?.toString() || ''}
                  onChangeText={(text) => setModalData(prev => ({ ...prev, duration: parseInt(text) || 0 }))}
                  placeholder={getLocalizedText('enter_hours', language)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfWidth}>
                <Input
                  label={getLocalizedText('course_cost', language)}
                  value={modalData.cost?.toString() || ''}
                  onChangeText={(text) => setModalData(prev => ({ ...prev, cost: parseFloat(text) || 0 }))}
                  placeholder={getLocalizedText('enter_cost', language)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {getLocalizedText('course_status', language)}
              </Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPicker(showPicker === 'courseStatus' ? null : 'courseStatus')}
              >
                <Text style={[styles.pickerButtonText, !modalData.status && styles.placeholderText]}>
                  {modalData.status 
                    ? getLocalizedText(modalData.status, language)
                    : 'Select status'
                  }
                </Text>
                <Text style={styles.pickerArrow}>{showPicker === 'courseStatus' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              
              {showPicker === 'courseStatus' && (
                <View style={styles.pickerContainer}>
                  {COURSE_STATUS.map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={styles.pickerOption}
                      onPress={() => {
                        setModalData(prev => ({ ...prev, status }));
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
            
            <Input
              label={getLocalizedText('completion_date', language)}
              value={modalData.completionDate || ''}
              onChangeText={(text) => setModalData(prev => ({ ...prev, completionDate: text }))}
              placeholder={getLocalizedText('select_date', language)}
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
                onPress={() => addItem('trainingCourses', {
                  ...modalData,
                  certificateReceived: modalData.status === 'completed',
                  rating: 0
                })}
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
          {getLocalizedText('training_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('training_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Certifications */}
        {renderCertificationsSection()}

        {/* Skills Assessment */}
        {renderSkillsSection()}

        {/* Training Courses */}
        {renderTrainingCoursesSection()}

        {/* Training Plan */}
        {renderTrainingPlanSection()}

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
  statusBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  expiringSoonBadge: {
    backgroundColor: '#FF9800',
  },
  overdueBadge: {
    backgroundColor: '#F44336',
  },
  proficiencyBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  proficiencyText: {
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
