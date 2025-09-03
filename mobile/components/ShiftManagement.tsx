// Shift Management Component for FieldSync Mobile App
// Handles shift check-in/out, break management, and shift status tracking

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import LocationService from '../services/LocationService';
import ApiService from '../services/ApiService';

export interface Shift {
  id: string;
  staffId: string;
  facilityId: string;
  startTime: Date;
  endTime?: Date;
  status: 'scheduled' | 'started' | 'on_break' | 'completed' | 'no_show';
  checkInLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  checkOutLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  breaks: Break[];
  notes?: string;
  overtimeMinutes: number;
}

export interface Break {
  id: string;
  startTime: Date;
  endTime?: Date;
  type: 'lunch' | 'short' | 'emergency';
  duration: number;
}

interface ShiftManagementProps {
  staffId: string;
  onShiftUpdate?: (shift: Shift) => void;
}

const ShiftManagement: React.FC<ShiftManagementProps> = ({
  staffId,
  onShiftUpdate,
}) => {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [currentBreak, setCurrentBreak] = useState<Break | null>(null);

  useEffect(() => {
    loadShifts();
    const interval = setInterval(loadShifts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [staffId]);

  const loadShifts = async () => {
    try {
      const response = await ApiService.getShifts(staffId);
      if (response.success && response.data) {
        const shifts = response.data;
        setCurrentShift(shifts.find(s => s.status === 'started' || s.status === 'on_break') || null);
        setUpcomingShifts(shifts.filter(s => s.status === 'scheduled'));
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
    }
  };

  const startShift = async (shiftId: string) => {
    setLoading(true);
    try {
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        Alert.alert('Location Required', 'Location access is required to check in');
        return;
      }

      const response = await ApiService.startShift(shiftId, {
        location,
        timestamp: Date.now(),
      });

      if (response.success) {
        Alert.alert('Success', 'Shift started successfully');
        await loadShifts();
        onShiftUpdate?.(response.data);
      } else {
        Alert.alert('Error', response.error || 'Failed to start shift');
      }
    } catch (error) {
      console.error('Start shift error:', error);
      Alert.alert('Error', 'Failed to start shift');
    } finally {
      setLoading(false);
    }
  };

  const endShift = async () => {
    if (!currentShift) return;

    Alert.alert(
      'End Shift',
      'Are you sure you want to end your current shift?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Shift',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const location = await LocationService.getCurrentLocation();
              
              const response = await ApiService.endShift(currentShift.id, {
                location,
                timestamp: Date.now(),
                notes,
              });

              if (response.success) {
                Alert.alert('Success', 'Shift ended successfully');
                await loadShifts();
                setNotes('');
                onShiftUpdate?.(response.data);
              } else {
                Alert.alert('Error', response.error || 'Failed to end shift');
              }
            } catch (error) {
              console.error('End shift error:', error);
              Alert.alert('Error', 'Failed to end shift');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const startBreak = async (type: Break['type']) => {
    if (!currentShift) return;

    setLoading(true);
    try {
      const response = await ApiService.startBreak(currentShift.id, {
        type,
        timestamp: Date.now(),
      });

      if (response.success) {
        setCurrentBreak(response.data);
        await loadShifts();
        setShowBreakModal(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to start break');
      }
    } catch (error) {
      console.error('Start break error:', error);
      Alert.alert('Error', 'Failed to start break');
    } finally {
      setLoading(false);
    }
  };

  const endBreak = async () => {
    if (!currentShift || !currentBreak) return;

    setLoading(true);
    try {
      const response = await ApiService.endBreak(currentShift.id, currentBreak.id, {
        timestamp: Date.now(),
      });

      if (response.success) {
        setCurrentBreak(null);
        await loadShifts();
      } else {
        Alert.alert('Error', response.error || 'Failed to end break');
      }
    } catch (error) {
      console.error('End break error:', error);
      Alert.alert('Error', 'Failed to end break');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getShiftDuration = (shift: Shift): number => {
    if (!shift.startTime) return 0;
    const endTime = shift.endTime ? new Date(shift.endTime) : new Date();
    const startTime = new Date(shift.startTime);
    return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
  };

  const getBreakTypeLabel = (type: Break['type']): string => {
    switch (type) {
      case 'lunch': return 'Lunch Break';
      case 'short': return 'Short Break';
      case 'emergency': return 'Emergency Break';
      default: return 'Break';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Current Shift Section */}
      {currentShift ? (
        <View style={styles.currentShiftCard}>
          <Text style={styles.sectionTitle}>Current Shift</Text>
          <View style={styles.shiftInfo}>
            <Text style={styles.shiftTime}>
              Started: {formatTime(currentShift.startTime)}
            </Text>
            <Text style={styles.shiftDuration}>
              Duration: {formatDuration(getShiftDuration(currentShift))}
            </Text>
            <Text style={styles.shiftStatus}>
              Status: {currentShift.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          {/* Break Management */}
          {currentShift.status === 'on_break' && currentBreak ? (
            <View style={styles.breakSection}>
              <Text style={styles.breakTitle}>
                {getBreakTypeLabel(currentBreak.type)} - In Progress
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.endBreakButton]}
                onPress={endBreak}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>End Break</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.breakButton]}
                onPress={() => setShowBreakModal(true)}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Take Break</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.endShiftButton]}
                onPress={endShift}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>End Shift</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Shift Notes */}
          <TouchableOpacity
            style={styles.notesButton}
            onPress={() => setShowNotesModal(true)}
          >
            <Text style={styles.notesButtonText}>
              {notes ? 'Update Notes' : 'Add Notes'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noShiftCard}>
          <Text style={styles.noShiftText}>No active shift</Text>
        </View>
      )}

      {/* Upcoming Shifts */}
      {upcomingShifts.length > 0 && (
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
          {upcomingShifts.map((shift) => (
            <View key={shift.id} style={styles.upcomingShiftCard}>
              <View style={styles.shiftInfo}>
                <Text style={styles.shiftTime}>
                  {formatTime(shift.startTime)}
                </Text>
                <Text style={styles.facilityName}>
                  Facility: {shift.facilityId}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, styles.startButton]}
                onPress={() => startShift(shift.id)}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Start Shift</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Break Type Modal */}
      <Modal
        visible={showBreakModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBreakModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Break Type</Text>
            
            <TouchableOpacity
              style={styles.breakTypeButton}
              onPress={() => startBreak('short')}
            >
              <Text style={styles.breakTypeText}>Short Break (15 min)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.breakTypeButton}
              onPress={() => startBreak('lunch')}
            >
              <Text style={styles.breakTypeText}>Lunch Break (30-60 min)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.breakTypeButton}
              onPress={() => startBreak('emergency')}
            >
              <Text style={styles.breakTypeText}>Emergency Break</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowBreakModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notes Modal */}
      <Modal
        visible={showNotesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Shift Notes</Text>
            
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about your shift..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => setShowNotesModal(false)}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowNotesModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  currentShiftCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noShiftCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  noShiftText: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  shiftInfo: {
    marginBottom: 16,
  },
  shiftTime: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  shiftDuration: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  shiftStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  facilityName: {
    fontSize: 14,
    color: '#666',
  },
  breakSection: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  breakTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#28a745',
  },
  breakButton: {
    backgroundColor: '#ffc107',
  },
  endBreakButton: {
    backgroundColor: '#28a745',
  },
  endShiftButton: {
    backgroundColor: '#dc3545',
  },
  notesButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  notesButtonText: {
    color: '#6c757d',
    fontSize: 14,
  },
  upcomingSection: {
    marginTop: 16,
  },
  upcomingShiftCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  breakTypeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  breakTypeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalSaveButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    backgroundColor: '#6c757d',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
});

export default ShiftManagement;
