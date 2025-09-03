import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { useOfflineSync } from '../hooks/useOfflineSync';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ConflictResolutionModalProps {
  visible: boolean;
  onClose: () => void;
  onResolve?: (itemId: string, resolution: string) => void;
}

interface ConflictItem {
  id: string;
  entityType: string;
  entityId: string;
  localData: any;
  serverData: any;
  timestamp: Date;
  localVersion: number;
  serverVersion: number;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  onClose,
  onResolve,
}) => {
  const { getConflicts, resolveConflict } = useOfflineSync();
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<ConflictItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadConflicts();
    }
  }, [visible]);

  const loadConflicts = async () => {
    try {
      setLoading(true);
      const conflictData = await getConflicts();
      setConflicts(conflictData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load conflicts');
      console.error('Error loading conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflict = async (itemId: string, resolution: 'server' | 'client' | 'merge') => {
    try {
      setLoading(true);
      await resolveConflict(itemId, resolution);
      
      if (onResolve) {
        onResolve(itemId, resolution);
      }

      // Reload conflicts
      await loadConflicts();
      setSelectedConflict(null);
      
      Alert.alert('Success', 'Conflict resolved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve conflict');
      console.error('Error resolving conflict:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderConflictDetails = (conflict: ConflictItem) => {
    const localData = conflict.localData || {};
    const serverData = conflict.serverData || {};
    
    // Get all unique keys from both objects
    const allKeys = Array.from(new Set([
      ...Object.keys(localData),
      ...Object.keys(serverData)
    ])).filter(key => !key.startsWith('_') && key !== 'id');

    return (
      <View style={styles.conflictDetails}>
        <Text style={styles.conflictTitle}>
          {conflict.entityType} - {conflict.entityId}
        </Text>
        
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>
            Local Version: {conflict.localVersion} | Server Version: {conflict.serverVersion}
          </Text>
        </View>

        <ScrollView style={styles.fieldsContainer}>
          {allKeys.map((key) => {
            const localValue = localData[key];
            const serverValue = serverData[key];
            const hasConflict = localValue !== serverValue;

            return (
              <View key={key} style={[styles.fieldRow, hasConflict && styles.conflictField]}>
                <Text style={styles.fieldName}>{key}</Text>
                
                <View style={styles.valuesContainer}>
                  <View style={styles.valueColumn}>
                    <Text style={styles.valueLabel}>Local</Text>
                    <Text style={[styles.valueText, hasConflict && styles.conflictValue]}>
                      {formatValue(localValue)}
                    </Text>
                  </View>
                  
                  <View style={styles.valueColumn}>
                    <Text style={styles.valueLabel}>Server</Text>
                    <Text style={[styles.valueText, hasConflict && styles.conflictValue]}>
                      {formatValue(serverValue)}
                    </Text>
                  </View>
                </View>

                {hasConflict && (
                  <Icon name="warning" size={16} color="#FF9800" style={styles.conflictIcon} />
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.serverButton]}
            onPress={() => handleResolveConflict(conflict.id, 'server')}
            disabled={loading}
          >
            <Icon name="cloud-download" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Use Server</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.clientButton]}
            onPress={() => handleResolveConflict(conflict.id, 'client')}
            disabled={loading}
          >
            <Icon name="smartphone" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Use Local</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.mergeButton]}
            onPress={() => handleResolveConflict(conflict.id, 'merge')}
            disabled={loading}
          >
            <Icon name="merge-type" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Merge</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleString();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Resolve Conflicts</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <Text>Loading conflicts...</Text>
          </View>
        )}

        {!loading && conflicts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="check-circle" size={48} color="#4CAF50" />
            <Text style={styles.emptyText}>No conflicts to resolve</Text>
            <Text style={styles.emptySubtext}>All data is synchronized</Text>
          </View>
        )}

        {!loading && conflicts.length > 0 && !selectedConflict && (
          <ScrollView style={styles.conflictsList}>
            <Text style={styles.conflictsHeader}>
              Found {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
            </Text>
            
            {conflicts.map((conflict) => (
              <TouchableOpacity
                key={conflict.id}
                style={styles.conflictItem}
                onPress={() => setSelectedConflict(conflict)}
              >
                <View style={styles.conflictItemHeader}>
                  <Text style={styles.conflictItemTitle}>
                    {conflict.entityType} - {conflict.entityId}
                  </Text>
                  <Icon name="chevron-right" size={24} color="#666" />
                </View>
                
                <Text style={styles.conflictItemTimestamp}>
                  Last modified: {formatTimestamp(conflict.timestamp)}
                </Text>
                
                <View style={styles.conflictItemVersions}>
                  <Text style={styles.versionBadge}>Local: v{conflict.localVersion}</Text>
                  <Text style={styles.versionBadge}>Server: v{conflict.serverVersion}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedConflict && (
          <View style={styles.detailsContainer}>
            <View style={styles.detailsHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedConflict(null)}
              >
                <Icon name="arrow-back" size={24} color="#666" />
              </TouchableOpacity>
              <Text style={styles.detailsTitle}>Conflict Details</Text>
            </View>
            
            {renderConflictDetails(selectedConflict)}
          </View>
        )}
      </View>
    </Modal>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  conflictsList: {
    flex: 1,
  },
  conflictsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    padding: 16,
  },
  conflictItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  conflictItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conflictItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  conflictItemTimestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  conflictItemVersions: {
    flexDirection: 'row',
    gap: 8,
  },
  versionBadge: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    color: '#333',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  conflictDetails: {
    flex: 1,
    padding: 16,
  },
  conflictTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  versionInfo: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fieldsContainer: {
    flex: 1,
    maxHeight: height * 0.5,
  },
  fieldRow: {
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
    borderRadius: 8,
    padding: 12,
  },
  conflictField: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  valuesContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  valueColumn: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 4,
    minHeight: 40,
  },
  conflictValue: {
    backgroundColor: '#FFEB3B',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  conflictIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  serverButton: {
    backgroundColor: '#4CAF50',
  },
  clientButton: {
    backgroundColor: '#2196F3',
  },
  mergeButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ConflictResolutionModal;