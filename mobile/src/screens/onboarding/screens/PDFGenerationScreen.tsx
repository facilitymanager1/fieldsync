import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PDFGenerationService, { EmployeeOnboardingData } from '../../../services/pdfGenerationService';

const { width, height } = Dimensions.get('window');

interface PDFOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'biodata' | 'complete' | 'individual';
  formType?: string;
  color: string;
}

const PDFGenerationScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState<EmployeeOnboardingData | null>(null);
  const [generatedPDFs, setGeneratedPDFs] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPDF, setSelectedPDF] = useState<PDFOption | null>(null);

  const pdfOptions: PDFOption[] = [
    {
      id: 'biodata',
      title: 'Bio-Data PDF',
      description: 'Complete employee profile with personal, professional, and contact information',
      icon: 'person',
      type: 'biodata',
      color: '#4CAF50',
    },
    {
      id: 'complete',
      title: 'Complete Package',
      description: 'Comprehensive onboarding package with all forms and documents',
      icon: 'folder',
      type: 'complete',
      color: '#2196F3',
    },
    {
      id: 'basic',
      title: 'Basic Details Form',
      description: 'Personal information and contact details',
      icon: 'assignment-ind',
      type: 'individual',
      formType: 'basic',
      color: '#FF9800',
    },
    {
      id: 'documents',
      title: 'Document Information',
      description: 'ID proofs and document verification status',
      icon: 'description',
      type: 'individual',
      formType: 'documents',
      color: '#9C27B0',
    },
    {
      id: 'emergency',
      title: 'Emergency Contacts',
      description: 'Family and emergency contact information',
      icon: 'contact-phone',
      type: 'individual',
      formType: 'emergency',
      color: '#F44336',
    },
    {
      id: 'bank',
      title: 'Bank Details',
      description: 'Banking information for salary processing',
      icon: 'account-balance',
      type: 'individual',
      formType: 'bank',
      color: '#607D8B',
    },
    {
      id: 'salary',
      title: 'Salary Information',
      description: 'Compensation details and breakdown',
      icon: 'monetization-on',
      type: 'individual',
      formType: 'salary',
      color: '#4CAF50',
    },
    {
      id: 'education',
      title: 'Educational Qualifications',
      description: 'Academic background and certifications',
      icon: 'school',
      type: 'individual',
      formType: 'education',
      color: '#3F51B5',
    },
    {
      id: 'experience',
      title: 'Work Experience',
      description: 'Previous employment history and roles',
      icon: 'work',
      type: 'individual',
      formType: 'experience',
      color: '#795548',
    },
    {
      id: 'uniform',
      title: 'Uniform Details',
      description: 'Uniform allocation and sizing information',
      icon: 'checkroom',
      type: 'individual',
      formType: 'uniform',
      color: '#009688',
    },
  ];

  useEffect(() => {
    loadEmployeeData();
  }, []);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      
      // Load all onboarding data from AsyncStorage
      const basicDetailsData = await AsyncStorage.getItem('onboarding_basic_details');
      const documentsData = await AsyncStorage.getItem('onboarding_documents');
      const emergencyContactsData = await AsyncStorage.getItem('onboarding_emergency_contacts');
      const bankDetailsData = await AsyncStorage.getItem('onboarding_bank_details');
      const salaryDetailsData = await AsyncStorage.getItem('onboarding_salary_details');
      const educationData = await AsyncStorage.getItem('onboarding_education');
      const experienceData = await AsyncStorage.getItem('onboarding_experience');
      const uniformData = await AsyncStorage.getItem('onboarding_uniform');

      // Parse and combine data
      const combinedData: EmployeeOnboardingData = {
        basicDetails: basicDetailsData ? JSON.parse(basicDetailsData) : {},
        documents: documentsData ? JSON.parse(documentsData) : { documents: [] },
        emergencyContacts: emergencyContactsData ? JSON.parse(emergencyContactsData).contacts || [] : [],
        bankDetails: bankDetailsData ? JSON.parse(bankDetailsData) : {},
        salaryDetails: salaryDetailsData ? JSON.parse(salaryDetailsData) : {},
        education: educationData ? JSON.parse(educationData).qualifications || [] : [],
        workExperience: experienceData ? JSON.parse(experienceData).experiences || [] : [],
        uniform: uniformData ? JSON.parse(uniformData) : { items: {} },
      };

      setEmployeeData(combinedData);
    } catch (error) {
      console.error('Error loading employee data:', error);
      Alert.alert('Error', 'Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async (option: PDFOption) => {
    if (!employeeData) {
      Alert.alert('Error', 'Employee data not available');
      return;
    }

    try {
      setLoading(true);
      let pdfPath = '';

      switch (option.type) {
        case 'biodata':
          pdfPath = await PDFGenerationService.generateBioDataPDF(employeeData, {
            fileName: `${employeeData.basicDetails.tempId}_biodata`,
            watermark: 'FieldSync',
          });
          break;

        case 'complete':
          pdfPath = await PDFGenerationService.generateCompletePackagePDF(employeeData, {
            fileName: `${employeeData.basicDetails.tempId}_complete_package`,
            watermark: 'FieldSync',
          });
          break;

        case 'individual':
          if (!option.formType) {
            throw new Error('Form type not specified');
          }
          
          let formData;
          switch (option.formType) {
            case 'basic':
              formData = employeeData.basicDetails;
              break;
            case 'documents':
              formData = employeeData.documents;
              break;
            case 'emergency':
              formData = employeeData.emergencyContacts;
              break;
            case 'bank':
              formData = employeeData.bankDetails;
              break;
            case 'salary':
              formData = employeeData.salaryDetails;
              break;
            case 'education':
              formData = employeeData.education;
              break;
            case 'experience':
              formData = employeeData.workExperience;
              break;
            case 'uniform':
              formData = employeeData.uniform;
              break;
            default:
              throw new Error(`Unsupported form type: ${option.formType}`);
          }

          pdfPath = await PDFGenerationService.generateFormPDF(
            option.formType as any,
            formData,
            employeeData.basicDetails.tempId || 'TEMP',
            {
              fileName: `${employeeData.basicDetails.tempId}_${option.formType}`,
              watermark: 'FieldSync',
            }
          );
          break;

        default:
          throw new Error(`Unsupported PDF type: ${option.type}`);
      }

      if (pdfPath) {
        setGeneratedPDFs(prev => [...prev, pdfPath]);
        Alert.alert(
          'Success',
          'PDF generated successfully!',
          [
            { text: 'OK' },
            {
              text: 'Share',
              onPress: () => sharePDF(pdfPath),
            },
          ]
        );
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      Alert.alert('Error', `Failed to generate PDF: ${error.message}`);
    } finally {
      setLoading(false);
      setModalVisible(false);
    }
  };

  const sharePDF = async (filePath: string) => {
    try {
      await Share.share({
        url: filePath,
        title: 'Employee Onboarding PDF',
        message: 'Please find the attached employee onboarding document.',
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const showPDFOptions = (option: PDFOption) => {
    setSelectedPDF(option);
    setModalVisible(true);
  };

  const renderPDFOption = (option: PDFOption) => (
    <TouchableOpacity
      key={option.id}
      style={[styles.optionCard, { borderLeftColor: option.color }]}
      onPress={() => showPDFOptions(option)}
      activeOpacity={0.7}
    >
      <View style={styles.optionHeader}>
        <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
          <Icon name={option.icon} size={24} color="white" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>{option.title}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
        <Icon name="arrow-forward-ios" size={16} color="#666" />
      </View>
    </TouchableOpacity>
  );

  const renderGenerationModal = () => (
    <Modal
      visible={modalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Generate PDF</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedPDF && (
            <View style={styles.modalBody}>
              <View style={[styles.modalIcon, { backgroundColor: selectedPDF.color }]}>
                <Icon name={selectedPDF.icon} size={32} color="white" />
              </View>
              <Text style={styles.modalPDFTitle}>{selectedPDF.title}</Text>
              <Text style={styles.modalPDFDescription}>{selectedPDF.description}</Text>

              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>This PDF will include:</Text>
                {selectedPDF.type === 'biodata' && (
                  <View>
                    <Text style={styles.featureItem}>• Complete employee profile</Text>
                    <Text style={styles.featureItem}>• Personal and professional details</Text>
                    <Text style={styles.featureItem}>• Contact information</Text>
                    <Text style={styles.featureItem}>• Document verification status</Text>
                  </View>
                )}
                {selectedPDF.type === 'complete' && (
                  <View>
                    <Text style={styles.featureItem}>• All onboarding forms</Text>
                    <Text style={styles.featureItem}>• Table of contents</Text>
                    <Text style={styles.featureItem}>• Cover page with employee details</Text>
                    <Text style={styles.featureItem}>• Professional formatting</Text>
                  </View>
                )}
                {selectedPDF.type === 'individual' && (
                  <View>
                    <Text style={styles.featureItem}>• Detailed form information</Text>
                    <Text style={styles.featureItem}>• Professional layout</Text>
                    <Text style={styles.featureItem}>• Easy to read format</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: selectedPDF.color }]}
                  onPress={() => generatePDF(selectedPDF)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Icon name="picture-as-pdf" size={20} color="white" />
                      <Text style={styles.generateText}>Generate PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading && !modalVisible) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading employee data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Icon name="picture-as-pdf" size={32} color="#007bff" />
          <Text style={styles.headerTitle}>PDF Generation</Text>
          <Text style={styles.headerSubtitle}>
            Generate professional PDFs for employee onboarding documents
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{generatedPDFs.length}</Text>
            <Text style={styles.statLabel}>PDFs Generated</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pdfOptions.length}</Text>
            <Text style={styles.statLabel}>Available Templates</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available PDF Templates</Text>
          <Text style={styles.sectionSubtitle}>
            Choose from various templates to generate professional documents
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {pdfOptions.map(renderPDFOption)}
        </View>

        {generatedPDFs.length > 0 && (
          <View style={styles.generatedSection}>
            <Text style={styles.generatedTitle}>Recently Generated PDFs</Text>
            {generatedPDFs.slice(-3).map((path, index) => (
              <TouchableOpacity
                key={index}
                style={styles.generatedPDF}
                onPress={() => sharePDF(path)}
              >
                <Icon name="picture-as-pdf" size={20} color="#007bff" />
                <Text style={styles.generatedPDFText} numberOfLines={1}>
                  {path.split('/').pop()?.replace('.pdf', '')}
                </Text>
                <Icon name="share" size={16} color="#666" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {renderGenerationModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  optionsContainer: {
    paddingHorizontal: 16,
  },
  optionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  generatedSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    marginTop: 16,
  },
  generatedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  generatedPDF: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  generatedPDFText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    alignItems: 'center',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPDFTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalPDFDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  featuresContainer: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  generateButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default PDFGenerationScreen;