import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ApiService from '../services/ApiServiceNew';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ServiceReport {
  id: string;
  title: string;
  description: string;
  ticketId?: string;
  location: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  attachments: string[];
  workPerformed: string;
  materials: { name: string; quantity: number; unit: string }[];
  timeSpent: number; // in minutes
  createdAt: string;
  submittedAt?: string;
  createdBy: string;
}

const ReportsScreen: React.FC = () => {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ServiceReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ServiceReport | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const { user } = useAuth();
  const { isConnected } = useSocket();

  const [newReport, setNewReport] = useState({
    title: '',
    description: '',
    ticketId: '',
    location: '',
    workPerformed: '',
    timeSpent: '',
    materials: [{ name: '', quantity: '', unit: 'pieces' }],
  });

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, filterStatus]);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const data = await ApiService.getReports();
      setReports(data || mockReports);
    } catch (error) {
      console.error('Failed to load reports:', error);
      setReports(mockReports);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadReports();
    setIsRefreshing(false);
  };

  const filterReports = () => {
    let filtered = reports;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(report => report.status === filterStatus);
    }

    setFilteredReports(filtered);
  };

  const handleCreateReport = async () => {
    try {
      if (!newReport.title || !newReport.description || !newReport.workPerformed) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const reportData = {
        title: newReport.title,
        description: newReport.description,
        ticketId: newReport.ticketId || undefined,
        location: {
          address: newReport.location,
        },
        workPerformed: newReport.workPerformed,
        timeSpent: parseInt(newReport.timeSpent) || 0,
        materials: newReport.materials.filter(m => m.name && m.quantity),
        status: 'draft',
        createdBy: user?.id,
        attachments: [],
      };

      await ApiService.createReport(reportData);
      setShowCreateModal(false);
      resetNewReport();
      Alert.alert('Success', 'Report created successfully');
      loadReports();
    } catch (error) {
      console.error('Failed to create report:', error);
      Alert.alert('Error', 'Failed to create report');
    }
  };

  const handleSubmitReport = async (reportId: string) => {
    try {
      await ApiService.updateReport(reportId, { status: 'submitted', submittedAt: new Date().toISOString() });
      Alert.alert('Success', 'Report submitted for approval');
      loadReports();
    } catch (error) {
      console.error('Failed to submit report:', error);
      Alert.alert('Error', 'Failed to submit report');
    }
  };

  const resetNewReport = () => {
    setNewReport({
      title: '',
      description: '',
      ticketId: '',
      location: '',
      workPerformed: '',
      timeSpent: '',
      materials: [{ name: '', quantity: '', unit: 'pieces' }],
    });
  };

  const addMaterial = () => {
    setNewReport({
      ...newReport,
      materials: [...newReport.materials, { name: '', quantity: '', unit: 'pieces' }],
    });
  };

  const updateMaterial = (index: number, field: string, value: string) => {
    const updatedMaterials = [...newReport.materials];
    updatedMaterials[index] = { ...updatedMaterials[index], [field]: value };
    setNewReport({ ...newReport, materials: updatedMaterials });
  };

  const removeMaterial = (index: number) => {
    if (newReport.materials.length > 1) {
      const updatedMaterials = newReport.materials.filter((_, i) => i !== index);
      setNewReport({ ...newReport, materials: updatedMaterials });
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft': return '#9E9E9E';
      case 'submitted': return '#FF9800';
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderReportItem = ({ item }: { item: ServiceReport }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => {
        setSelectedReport(item);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportInfo}>
          <Text style={styles.reportTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.reportLocation} numberOfLines={1}>
            {item.location.address}
          </Text>
        </View>
        <View style={styles.reportBadges}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
      </View>
      
      <Text style={styles.reportDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      <View style={styles.reportFooter}>
        <View style={styles.reportStats}>
          <Icon name="schedule" size={16} color="#666" />
          <Text style={styles.statText}>{formatTime(item.timeSpent)}</Text>
          <Icon name="build" size={16} color="#666" style={{ marginLeft: 12 }} />
          <Text style={styles.statText}>{item.materials.length} materials</Text>
        </View>
        <Text style={styles.reportDate}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFilterButton = (status: string, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterStatus === status && styles.activeFilterButton,
      ]}
      onPress={() => setFilterStatus(status)}
    >
      <Text
        style={[
          styles.filterButtonText,
          filterStatus === status && styles.activeFilterButtonText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderMaterialInput = (material: any, index: number) => (
    <View key={index} style={styles.materialRow}>
      <TextInput
        style={[styles.input, styles.materialInput]}
        placeholder="Material name"
        value={material.name}
        onChangeText={(text) => updateMaterial(index, 'name', text)}
      />
      <TextInput
        style={[styles.input, styles.quantityInput]}
        placeholder="Qty"
        value={material.quantity}
        onChangeText={(text) => updateMaterial(index, 'quantity', text)}
        keyboardType="numeric"
      />
      <TouchableOpacity
        style={styles.removeMaterialButton}
        onPress={() => removeMaterial(index)}
        disabled={newReport.materials.length === 1}
      >
        <Icon name="remove-circle" size={24} color={newReport.materials.length === 1 ? '#CCC' : '#F44336'} />
      </TouchableOpacity>
    </View>
  );

  const mockReports: ServiceReport[] = [
    {
      id: '1',
      title: 'HVAC System Maintenance',
      description: 'Regular maintenance check for building HVAC system',
      ticketId: 'TKT-001',
      location: { address: '123 Main St, Building A' },
      status: 'submitted',
      attachments: [],
      workPerformed: 'Replaced air filters, cleaned coils, checked refrigerant levels',
      materials: [
        { name: 'Air Filter', quantity: 4, unit: 'pieces' },
        { name: 'Cleaning Solution', quantity: 1, unit: 'bottle' },
      ],
      timeSpent: 120,
      createdAt: new Date().toISOString(),
      createdBy: 'user1',
    },
    {
      id: '2',
      title: 'Elevator Safety Inspection',
      description: 'Monthly safety inspection and maintenance',
      location: { address: '456 Oak Ave, Tower B' },
      status: 'approved',
      attachments: [],
      workPerformed: 'Inspected cables, tested emergency systems, lubricated mechanisms',
      materials: [
        { name: 'Lubricant', quantity: 2, unit: 'tubes' },
      ],
      timeSpent: 90,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      submittedAt: new Date(Date.now() - 43200000).toISOString(),
      createdBy: 'user1',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Service Reports</Text>
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
            <Text style={styles.statusText}>
              {isConnected ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {renderFilterButton('all', 'All')}
        {renderFilterButton('draft', 'Draft')}
        {renderFilterButton('submitted', 'Submitted')}
        {renderFilterButton('approved', 'Approved')}
      </View>

      {/* Reports List */}
      <FlatList
        data={filteredReports}
        renderItem={renderReportItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        style={styles.reportsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="assignment" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No reports found</Text>
          </View>
        }
      />

      {/* Create Report Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Service Report</Text>
            <TouchableOpacity onPress={handleCreateReport}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <TextInput
              style={styles.input}
              placeholder="Report Title *"
              value={newReport.title}
              onChangeText={(text) => setNewReport({ ...newReport, title: text })}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description *"
              value={newReport.description}
              onChangeText={(text) => setNewReport({ ...newReport, description: text })}
              multiline
              numberOfLines={3}
            />

            <TextInput
              style={styles.input}
              placeholder="Related Ticket ID (optional)"
              value={newReport.ticketId}
              onChangeText={(text) => setNewReport({ ...newReport, ticketId: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Location"
              value={newReport.location}
              onChangeText={(text) => setNewReport({ ...newReport, location: text })}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Work Performed *"
              value={newReport.workPerformed}
              onChangeText={(text) => setNewReport({ ...newReport, workPerformed: text })}
              multiline
              numberOfLines={4}
            />

            <TextInput
              style={styles.input}
              placeholder="Time Spent (minutes)"
              value={newReport.timeSpent}
              onChangeText={(text) => setNewReport({ ...newReport, timeSpent: text })}
              keyboardType="numeric"
            />

            <Text style={styles.sectionLabel}>Materials Used</Text>
            {newReport.materials.map((material, index) => renderMaterialInput(material, index))}
            
            <TouchableOpacity style={styles.addMaterialButton} onPress={addMaterial}>
              <Icon name="add-circle" size={20} color="#007AFF" />
              <Text style={styles.addMaterialText}>Add Material</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedReport && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Report Details</Text>
              {selectedReport.status === 'draft' && (
                <TouchableOpacity onPress={() => handleSubmitReport(selectedReport.id)}>
                  <Text style={styles.saveButton}>Submit</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.detailTitle}>{selectedReport.title}</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedReport.status) }]}>
                  <Text style={styles.badgeText}>{selectedReport.status}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Time Spent:</Text>
                <Text style={styles.detailValue}>{formatTime(selectedReport.timeSpent)}</Text>
              </View>

              <Text style={styles.detailSectionTitle}>Description</Text>
              <Text style={styles.detailDescription}>{selectedReport.description}</Text>

              <Text style={styles.detailSectionTitle}>Work Performed</Text>
              <Text style={styles.detailDescription}>{selectedReport.workPerformed}</Text>

              <Text style={styles.detailSectionTitle}>Materials Used</Text>
              {selectedReport.materials.map((material, index) => (
                <View key={index} style={styles.materialItem}>
                  <Text style={styles.materialText}>
                    {material.name} - {material.quantity} {material.unit}
                  </Text>
                </View>
              ))}

              <Text style={styles.detailSectionTitle}>Location</Text>
              <Text style={styles.detailDescription}>{selectedReport.location.address}</Text>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  createButton: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#E0E0E0',
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  reportsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
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
  reportInfo: {
    flex: 1,
    marginRight: 12,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reportLocation: {
    fontSize: 14,
    color: '#666',
  },
  reportBadges: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  reportDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  materialInput: {
    flex: 2,
    marginRight: 8,
    marginBottom: 0,
  },
  quantityInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  removeMaterialButton: {
    padding: 4,
  },
  addMaterialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  addMaterialText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  detailValue: {
    fontSize: 16,
    color: '#666',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  materialItem: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  materialText: {
    fontSize: 14,
    color: '#333',
  },
});

export default ReportsScreen;
