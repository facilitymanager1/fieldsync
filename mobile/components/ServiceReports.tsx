// Service Reports Component for FieldSync Mobile App
// Handles creation, submission, and management of service reports

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-picker';
import LocationService from '../services/LocationService';
import ApiService from '../services/ApiService';

export interface ServiceReport {
  id: string;
  staffId: string;
  facilityId: string;
  title: string;
  description: string;
  category: 'maintenance' | 'incident' | 'safety' | 'quality' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'submitted' | 'in_progress' | 'completed' | 'cancelled';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  attachments: Attachment[];
  createdAt: Date;
  submittedAt?: Date;
  completedAt?: Date;
  assignedTo?: string;
  notes: string[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'document';
  uri: string;
  name: string;
  size: number;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';
}

interface ServiceReportsProps {
  staffId: string;
  facilityId: string;
  onReportUpdate?: (report: ServiceReport) => void;
}

const ServiceReports: React.FC<ServiceReportsProps> = ({
  staffId,
  facilityId,
  onReportUpdate,
}) => {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [currentReport, setCurrentReport] = useState<Partial<ServiceReport>>({
    staffId,
    facilityId,
    category: 'maintenance',
    priority: 'medium',
    status: 'draft',
    attachments: [],
    notes: [],
  });

  useEffect(() => {
    loadReports();
  }, [staffId, facilityId]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getServiceReports({ staffId, facilityId });
      if (response.success && response.data) {
        setReports(response.data);
      }
    } catch (error) {
      console.error('Failed to load service reports:', error);
      Alert.alert('Error', 'Failed to load service reports');
    } finally {
      setLoading(false);
    }
  };

  const createReport = async () => {
    if (!currentReport.title || !currentReport.description) {
      Alert.alert('Validation Error', 'Title and description are required');
      return;
    }

    try {
      setLoading(true);
      
      // Get current location
      const location = await LocationService.getCurrentLocation();
      
      const reportData = {
        ...currentReport,
        location,
        createdAt: new Date(),
      };

      const response = await ApiService.createServiceReport(reportData);
      
      if (response.success) {
        Alert.alert('Success', 'Service report created successfully');
        setShowCreateModal(false);
        resetCurrentReport();
        await loadReports();
        onReportUpdate?.(response.data);
      } else {
        Alert.alert('Error', response.error || 'Failed to create service report');
      }
    } catch (error) {
      console.error('Create report error:', error);
      Alert.alert('Error', 'Failed to create service report');
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async (reportId: string) => {
    Alert.alert(
      'Submit Report',
      'Are you sure you want to submit this report? It cannot be edited after submission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await ApiService.submitServiceReport(reportId);
              
              if (response.success) {
                Alert.alert('Success', 'Service report submitted successfully');
                await loadReports();
                onReportUpdate?.(response.data);
              } else {
                Alert.alert('Error', response.error || 'Failed to submit service report');
              }
            } catch (error) {
              console.error('Submit report error:', error);
              Alert.alert('Error', 'Failed to submit service report');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const addAttachment = () => {
    setShowImagePicker(true);
  };

  const handleImageSelection = (type: 'camera' | 'library') => {
    setShowImagePicker(false);
    
    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
    };

    const callback = (response: any) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const attachment: Attachment = {
          id: Date.now().toString(),
          type: 'image',
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          uploadStatus: 'pending',
        };

        setCurrentReport(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), attachment],
        }));
      }
    };

    if (type === 'camera') {
      launchCamera(options, callback);
    } else {
      launchImageLibrary(options, callback);
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setCurrentReport(prev => ({
      ...prev,
      attachments: prev.attachments?.filter(a => a.id !== attachmentId) || [],
    }));
  };

  const resetCurrentReport = () => {
    setCurrentReport({
      staffId,
      facilityId,
      category: 'maintenance',
      priority: 'medium',
      status: 'draft',
      attachments: [],
      notes: [],
    });
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'maintenance': return '#007AFF';
      case 'incident': return '#FF3B30';
      case 'safety': return '#FF9500';
      case 'quality': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#FFCC02';
      case 'low': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Service Reports</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>+ New Report</Text>
        </TouchableOpacity>
      </View>

      {loading && reports.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <ScrollView style={styles.reportsList}>
          {reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>{report.title}</Text>
                <View style={styles.reportBadges}>
                  <View style={[styles.badge, { backgroundColor: getCategoryColor(report.category) }]}>
                    <Text style={styles.badgeText}>{report.category.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: getPriorityColor(report.priority) }]}>
                    <Text style={styles.badgeText}>{report.priority.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              
              <Text style={styles.reportDescription} numberOfLines={3}>
                {report.description}
              </Text>
              
              <View style={styles.reportFooter}>
                <Text style={styles.reportDate}>
                  Created: {formatDate(report.createdAt)}
                </Text>
                <Text style={[styles.reportStatus, { color: getCategoryColor(report.status) }]}>
                  {report.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              
              {report.status === 'draft' && (
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => submitReport(report.id)}
                  disabled={loading}
                >
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          {reports.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No service reports found</Text>
              <Text style={styles.emptyStateSubtext}>
                Create your first report by tapping the "New Report" button
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Create Report Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowCreateModal(false);
                resetCurrentReport();
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Service Report</Text>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={createReport}
              disabled={loading}
            >
              <Text style={styles.modalSaveText}>
                {loading ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={currentReport.title || ''}
                onChangeText={(text) => setCurrentReport(prev => ({ ...prev, title: text }))}
                placeholder="Enter report title"
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.pickerContainer}>
                {['maintenance', 'incident', 'safety', 'quality', 'other'].map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.pickerOption,
                      currentReport.category === category && styles.pickerOptionSelected,
                    ]}
                    onPress={() => setCurrentReport(prev => ({ ...prev, category: category as any }))}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        currentReport.category === category && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {category.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.pickerContainer}>
                {['low', 'medium', 'high', 'urgent'].map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.pickerOption,
                      currentReport.priority === priority && styles.pickerOptionSelected,
                    ]}
                    onPress={() => setCurrentReport(prev => ({ ...prev, priority: priority as any }))}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        currentReport.priority === priority && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {priority.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={currentReport.description || ''}
                onChangeText={(text) => setCurrentReport(prev => ({ ...prev, description: text }))}
                placeholder="Describe the issue or service performed"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={1000}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Attachments</Text>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={addAttachment}
              >
                <Text style={styles.attachmentButtonText}>+ Add Photo</Text>
              </TouchableOpacity>
              
              {currentReport.attachments && currentReport.attachments.length > 0 && (
                <ScrollView horizontal style={styles.attachmentsList}>
                  {currentReport.attachments.map((attachment) => (
                    <View key={attachment.id} style={styles.attachmentItem}>
                      <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                      <TouchableOpacity
                        style={styles.removeAttachmentButton}
                        onPress={() => removeAttachment(attachment.id)}
                      >
                        <Text style={styles.removeAttachmentText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </ScrollView>
      </Modal>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.imagePickerOverlay}>
          <View style={styles.imagePickerContent}>
            <Text style={styles.imagePickerTitle}>Add Photo</Text>
            
            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => handleImageSelection('camera')}
            >
              <Text style={styles.imagePickerOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => handleImageSelection('library')}
            >
              <Text style={styles.imagePickerOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.imagePickerCancel}
              onPress={() => setShowImagePicker(false)}
            >
              <Text style={styles.imagePickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  reportsList: {
    flex: 1,
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  reportBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportDate: {
    fontSize: 12,
    color: '#999',
  },
  reportStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCancelButton: {
    padding: 8,
  },
  modalCancelText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  pickerOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#fff',
  },
  attachmentButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  attachmentButtonText: {
    color: '#6c757d',
    fontSize: 16,
  },
  attachmentsList: {
    marginTop: 12,
  },
  attachmentItem: {
    marginRight: 12,
    position: 'relative',
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachmentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  imagePickerOption: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePickerOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePickerCancel: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  imagePickerCancelText: {
    color: '#6c757d',
    fontSize: 16,
  },
});

export default ServiceReports;
