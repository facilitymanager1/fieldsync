/**
 * Emergency Contacts Screen - Emergency contact information collection
 * 
 * Features:
 * - Multiple emergency contacts (primary, secondary)
 * - Relationship types and contact preferences
 * - Contact verification via SMS/call
 * - Priority ordering of contacts
 * - Medical emergency specific contacts
 * - Contact accessibility (calling permissions)
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
  Linking,
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
      phone: '+91 98765 43210'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    emergency_title: 'Emergency Contacts',
    emergency_subtitle: 'Add emergency contacts who can be reached in case of emergencies',
    emergency_contacts: 'Emergency Contacts',
    add_contact: 'Add Emergency Contact',
    primary_contact: 'Primary Contact',
    secondary_contact: 'Secondary Contact',
    no_contacts_yet: 'No emergency contacts added yet',
    
    // Contact form fields
    contact_name: 'Full Name',
    relationship: 'Relationship',
    phone_number: 'Phone Number',
    alternate_phone: 'Alternate Phone (Optional)',
    email_address: 'Email Address (Optional)',
    address: 'Address (Optional)',
    blood_group: 'Blood Group (Optional)',
    medical_conditions: 'Medical Conditions (Optional)',
    
    // Contact preferences
    contact_preferences: 'Contact Preferences',
    can_call_anytime: 'Can call anytime (24/7)',
    preferred_contact_time: 'Preferred contact time',
    contact_method: 'Preferred contact method',
    emergency_only: 'Emergency contact only',
    work_related: 'Can contact for work matters',
    medical_emergency: 'Medical emergency contact',
    
    // Relationship types
    father: 'Father',
    mother: 'Mother',
    spouse: 'Spouse',
    sibling: 'Sibling',
    child: 'Child',
    friend: 'Friend',
    relative: 'Relative',
    colleague: 'Colleague',
    doctor: 'Doctor',
    other: 'Other',
    
    // Contact methods
    phone_call: 'Phone Call',
    sms: 'SMS',
    email: 'Email',
    whatsapp: 'WhatsApp',
    
    // Time preferences
    anytime: 'Anytime',
    morning: 'Morning (6 AM - 12 PM)',
    afternoon: 'Afternoon (12 PM - 6 PM)',
    evening: 'Evening (6 PM - 10 PM)',
    work_hours: 'Work Hours (9 AM - 6 PM)',
    
    // Actions
    save_contact: 'Save Contact',
    edit_contact: 'Edit Contact',
    delete_contact: 'Delete Contact',
    verify_contact: 'Verify Contact',
    call_contact: 'Call Contact',
    send_test_sms: 'Send Test SMS',
    make_primary: 'Make Primary',
    continue: 'Continue',
    skip: 'Skip for Now',
    
    // Status
    verified: 'Verified',
    not_verified: 'Not Verified',
    verification_pending: 'Verification Pending',
    verification_failed: 'Verification Failed',
    
    // Validation messages
    required_field: 'This field is required',
    invalid_phone: 'Please enter a valid phone number',
    invalid_email: 'Please enter a valid email address',
    phone_already_exists: 'This phone number is already added',
    minimum_contacts: 'Please add at least one emergency contact',
    
    // Placeholders
    enter_full_name: 'Enter full name',
    enter_phone_number: '+91 98765 43210',
    enter_alternate_phone: '+91 87654 32109',
    enter_email: 'contact@email.com',
    enter_address: 'Full address (optional)',
    select_relationship: 'Select relationship',
    select_blood_group: 'Select blood group',
    enter_medical_conditions: 'Any known medical conditions',
    
    // Blood groups
    'A+': 'A+', 'A-': 'A-', 'B+': 'B+', 'B-': 'B-',
    'AB+': 'AB+', 'AB-': 'AB-', 'O+': 'O+', 'O-': 'O-',
    
    // Confirmation messages
    delete_confirmation: 'Are you sure you want to delete this emergency contact?',
    verify_confirmation: 'Send verification message to this contact?',
    call_confirmation: 'Make a test call to verify this contact?',
    contact_verified: 'Contact verified successfully',
    verification_sent: 'Verification message sent',
    
    // Instructions
    emergency_instructions: 'Emergency Contact Guidelines',
    guideline_1: '• Add at least 2 emergency contacts',
    guideline_2: '• Include family members and close friends',
    guideline_3: '• Verify contact numbers are active',
    guideline_4: '• Inform contacts about being emergency contacts',
    guideline_5: '• Update contact details regularly',
    guideline_6: '• Include medical emergency contacts if needed',
  };
  return texts[key] || key;
};

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phoneNumber: string;
  alternatePhone: string;
  email: string;
  address: string;
  bloodGroup: string;
  medicalConditions: string;
  isPrimary: boolean;
  isVerified: boolean;
  verificationStatus: 'not_verified' | 'verification_pending' | 'verified' | 'verification_failed';
  preferences: {
    canCallAnytime: boolean;
    preferredContactTime: string;
    contactMethod: string;
    emergencyOnly: boolean;
    workRelated: boolean;
    medicalEmergency: boolean;
  };
  createdAt: string;
  lastVerified?: string;
}

interface EmergencyContactsData {
  contacts: EmergencyContact[];
  primaryContactId?: string;
  timestamp: string;
}

const RELATIONSHIP_TYPES = [
  'father', 'mother', 'spouse', 'sibling', 'child', 'friend', 
  'relative', 'colleague', 'doctor', 'other'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const CONTACT_METHODS = ['phone_call', 'sms', 'email', 'whatsapp'];

const TIME_PREFERENCES = ['anytime', 'morning', 'afternoon', 'evening', 'work_hours'];

const EMPTY_CONTACT: EmergencyContact = {
  id: '',
  name: '',
  relationship: '',
  phoneNumber: '',
  alternatePhone: '',
  email: '',
  address: '',
  bloodGroup: '',
  medicalConditions: '',
  isPrimary: false,
  isVerified: false,
  verificationStatus: 'not_verified',
  preferences: {
    canCallAnytime: true,
    preferredContactTime: 'anytime',
    contactMethod: 'phone_call',
    emergencyOnly: true,
    workRelated: false,
    medicalEmergency: false,
  },
  createdAt: '',
};

export default function EmergencyContactsScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [contactsData, setContactsData] = useState<EmergencyContactsData>({
    contacts: [],
    timestamp: '',
  });
  
  const [currentContact, setCurrentContact] = useState<EmergencyContact>(EMPTY_CONTACT);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);
  const [showContactMethodPicker, setShowContactMethodPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const saved = await AsyncStorage.getItem(`emergency_contacts_${userData?.login?.username}`);
      if (saved) {
        const data = JSON.parse(saved);
        setContactsData(data);
      }
    } catch (error) {
      console.error('Failed to load saved emergency contacts:', error);
    }
  };

  const validateContactForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Required fields
    if (!currentContact.name.trim()) {
      newErrors.name = getLocalizedText('required_field', language);
    }
    if (!currentContact.relationship) {
      newErrors.relationship = getLocalizedText('required_field', language);
    }
    if (!currentContact.phoneNumber.trim()) {
      newErrors.phoneNumber = getLocalizedText('required_field', language);
    } else if (!/^[\+]?[1-9][\d]{9,14}$/.test(currentContact.phoneNumber.replace(/\s/g, ''))) {
      newErrors.phoneNumber = getLocalizedText('invalid_phone', language);
    }

    // Check for duplicate phone numbers
    const existingContact = contactsData.contacts.find(
      contact => contact.phoneNumber === currentContact.phoneNumber && contact.id !== editingContactId
    );
    if (existingContact) {
      newErrors.phoneNumber = getLocalizedText('phone_already_exists', language);
    }

    // Email validation (if provided)
    if (currentContact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentContact.email)) {
      newErrors.email = getLocalizedText('invalid_email', language);
    }

    // Alternate phone validation (if provided)
    if (currentContact.alternatePhone && 
        !/^[\+]?[1-9][\d]{9,14}$/.test(currentContact.alternatePhone.replace(/\s/g, ''))) {
      newErrors.alternatePhone = getLocalizedText('invalid_phone', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContactInputChange = (field: string, value: string | boolean) => {
    if (field.startsWith('preferences.')) {
      const preferenceField = field.split('.')[1];
      setCurrentContact(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [preferenceField]: value,
        },
      }));
    } else {
      setCurrentContact(prev => ({ ...prev, [field]: value }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const saveContact = () => {
    if (!validateContactForm()) return;

    const contactToSave: EmergencyContact = {
      ...currentContact,
      id: editingContactId || `contact_${Date.now()}`,
      createdAt: editingContactId ? currentContact.createdAt : new Date().toISOString(),
    };

    let updatedContacts: EmergencyContact[];

    if (editingContactId) {
      // Update existing contact
      updatedContacts = contactsData.contacts.map(contact => 
        contact.id === editingContactId ? contactToSave : contact
      );
    } else {
      // Add new contact
      updatedContacts = [...contactsData.contacts, contactToSave];
    }

    // Set as primary if it's the first contact or explicitly set
    if (updatedContacts.length === 1 || contactToSave.isPrimary) {
      updatedContacts = updatedContacts.map(contact => ({
        ...contact,
        isPrimary: contact.id === contactToSave.id,
      }));
      
      setContactsData(prev => ({
        ...prev,
        contacts: updatedContacts,
        primaryContactId: contactToSave.id,
      }));
    } else {
      setContactsData(prev => ({
        ...prev,
        contacts: updatedContacts,
      }));
    }

    // Reset form
    setCurrentContact(EMPTY_CONTACT);
    setEditingContactId(null);
    setShowContactForm(false);
    setErrors({});
  };

  const editContact = (contact: EmergencyContact) => {
    setCurrentContact(contact);
    setEditingContactId(contact.id);
    setShowContactForm(true);
  };

  const deleteContact = (contactId: string) => {
    Alert.alert(
      getLocalizedText('delete_contact', language),
      getLocalizedText('delete_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedContacts = contactsData.contacts.filter(contact => contact.id !== contactId);
            
            // If deleted contact was primary, make first contact primary
            if (contactsData.primaryContactId === contactId && updatedContacts.length > 0) {
              updatedContacts[0].isPrimary = true;
              setContactsData(prev => ({
                ...prev,
                contacts: updatedContacts,
                primaryContactId: updatedContacts[0].id,
              }));
            } else {
              setContactsData(prev => ({
                ...prev,
                contacts: updatedContacts,
              }));
            }
          },
        },
      ]
    );
  };

  const makePrimary = (contactId: string) => {
    const updatedContacts = contactsData.contacts.map(contact => ({
      ...contact,
      isPrimary: contact.id === contactId,
    }));

    setContactsData(prev => ({
      ...prev,
      contacts: updatedContacts,
      primaryContactId: contactId,
    }));
  };

  const verifyContact = async (contact: EmergencyContact) => {
    Alert.alert(
      getLocalizedText('verify_contact', language),
      getLocalizedText('verify_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SMS',
          onPress: () => sendVerificationSMS(contact),
        },
        {
          text: 'Call',
          onPress: () => makeVerificationCall(contact),
        },
      ]
    );
  };

  const sendVerificationSMS = async (contact: EmergencyContact) => {
    // Update status to pending
    updateContactVerificationStatus(contact.id, 'verification_pending');

    try {
      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      updateContactVerificationStatus(contact.id, 'verified');
      Alert.alert('Success', getLocalizedText('verification_sent', language));
    } catch (error) {
      updateContactVerificationStatus(contact.id, 'verification_failed');
      Alert.alert('Error', 'Failed to send verification SMS');
    }
  };

  const makeVerificationCall = (contact: EmergencyContact) => {
    Alert.alert(
      getLocalizedText('call_contact', language),
      getLocalizedText('call_confirmation', language),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${contact.phoneNumber}`);
            updateContactVerificationStatus(contact.id, 'verified');
          },
        },
      ]
    );
  };

  const updateContactVerificationStatus = (
    contactId: string, 
    status: EmergencyContact['verificationStatus']
  ) => {
    const updatedContacts = contactsData.contacts.map(contact => 
      contact.id === contactId 
        ? { 
            ...contact, 
            verificationStatus: status,
            isVerified: status === 'verified',
            lastVerified: status === 'verified' ? new Date().toISOString() : contact.lastVerified,
          }
        : contact
    );

    setContactsData(prev => ({
      ...prev,
      contacts: updatedContacts,
    }));
  };

  const handleContinue = async () => {
    if (contactsData.contacts.length === 0) {
      Alert.alert('Required', getLocalizedText('minimum_contacts', language));
      return;
    }

    const finalData: EmergencyContactsData = {
      ...contactsData,
      timestamp: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(
        `emergency_contacts_${userData?.login?.username}`,
        JSON.stringify(finalData)
      );

      goToNextStep({ emergencyContactsData: finalData });
    } catch (error) {
      console.error('Failed to save emergency contacts:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Emergency Contacts?',
      'Emergency contacts are important for workplace safety and emergency situations.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          onPress: () => goToNextStep({ 
            emergencyContactsData: { 
              skipped: true, 
              timestamp: new Date().toISOString() 
            } 
          })
        },
      ]
    );
  };

  const getVerificationStatusColor = (status: EmergencyContact['verificationStatus']): string => {
    switch (status) {
      case 'verified': return '#4CAF50';
      case 'verification_pending': return '#FF9800';
      case 'verification_failed': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getVerificationStatusIcon = (status: EmergencyContact['verificationStatus']): string => {
    switch (status) {
      case 'verified': return '✅';
      case 'verification_pending': return '⏳';
      case 'verification_failed': return '❌';
      default: return '❓';
    }
  };

  const renderContactCard = (contact: EmergencyContact) => (
    <Card key={contact.id} variant="outlined" margin={8}>
      <View style={styles.contactHeader}>
        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{contact.name}</Text>
            {contact.isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>PRIMARY</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.contactRelationship}>
            {getLocalizedText(contact.relationship, language)}
          </Text>
          
          <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
          
          <View style={styles.verificationStatus}>
            <Text style={[styles.verificationText, { color: getVerificationStatusColor(contact.verificationStatus) }]}>
              {getVerificationStatusIcon(contact.verificationStatus)} {getLocalizedText(contact.verificationStatus, language)}
            </Text>
          </View>
        </View>
        
        <View style={styles.contactActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => verifyContact(contact)}
          >
            <Text style={styles.actionButtonText}>📞</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => editContact(contact)}
          >
            <Text style={styles.actionButtonText}>✏️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => deleteContact(contact.id)}
          >
            <Text style={styles.actionButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact preferences summary */}
      <View style={styles.preferencesContainer}>
        {contact.preferences.canCallAnytime && (
          <View style={styles.preferenceTag}>
            <Text style={styles.preferenceTagText}>24/7</Text>
          </View>
        )}
        {contact.preferences.medicalEmergency && (
          <View style={[styles.preferenceTag, styles.medicalTag]}>
            <Text style={[styles.preferenceTagText, styles.medicalTagText]}>Medical</Text>
          </View>
        )}
        {contact.preferences.workRelated && (
          <View style={styles.preferenceTag}>
            <Text style={styles.preferenceTagText}>Work</Text>
          </View>
        )}
      </View>

      {!contact.isPrimary && (
        <View style={styles.makePrimaryContainer}>
          <Button
            title={getLocalizedText('make_primary', language)}
            onPress={() => makePrimary(contact.id)}
            variant="text"
            size="small"
          />
        </View>
      )}
    </Card>
  );

  const renderGuidelines = () => (
    <Card title={getLocalizedText('emergency_instructions', language)} variant="outlined" margin={8}>
      <View style={styles.guidelinesList}>
        <Text style={styles.guidelineItem}>{getLocalizedText('guideline_1', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('guideline_2', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('guideline_3', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('guideline_4', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('guideline_5', language)}</Text>
        <Text style={styles.guidelineItem}>{getLocalizedText('guideline_6', language)}</Text>
      </View>
    </Card>
  );

  const renderContactForm = () => (
    <Modal
      visible={showContactForm}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowContactForm(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowContactForm(false)}>
            <Text style={styles.modalCloseButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingContactId ? 
              getLocalizedText('edit_contact', language) : 
              getLocalizedText('add_contact', language)
            }
          </Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Basic Information */}
          <Input
            label={getLocalizedText('contact_name', language)}
            value={currentContact.name}
            onChangeText={(text) => handleContactInputChange('name', text)}
            error={errors.name}
            required
            placeholder={getLocalizedText('enter_full_name', language)}
          />

          {/* Relationship Picker */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('relationship', language)} *
            </Text>
            <TouchableOpacity
              style={[styles.pickerButton, errors.relationship && styles.inputError]}
              onPress={() => setShowRelationshipPicker(!showRelationshipPicker)}
            >
              <Text style={[styles.pickerButtonText, !currentContact.relationship && styles.placeholderText]}>
                {currentContact.relationship 
                  ? getLocalizedText(currentContact.relationship, language)
                  : getLocalizedText('select_relationship', language)
                }
              </Text>
              <Text style={styles.pickerArrow}>{showRelationshipPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showRelationshipPicker && (
              <View style={styles.pickerContainer}>
                {RELATIONSHIP_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      currentContact.relationship === type && styles.pickerOptionSelected
                    ]}
                    onPress={() => {
                      handleContactInputChange('relationship', type);
                      setShowRelationshipPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      currentContact.relationship === type && styles.pickerOptionTextSelected
                    ]}>
                      {getLocalizedText(type, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.relationship && (
              <Text style={styles.errorText}>{errors.relationship}</Text>
            )}
          </View>

          <Input
            label={getLocalizedText('phone_number', language)}
            value={currentContact.phoneNumber}
            onChangeText={(text) => handleContactInputChange('phoneNumber', text)}
            error={errors.phoneNumber}
            required
            placeholder={getLocalizedText('enter_phone_number', language)}
            keyboardType="phone-pad"
          />

          <Input
            label={getLocalizedText('alternate_phone', language)}
            value={currentContact.alternatePhone}
            onChangeText={(text) => handleContactInputChange('alternatePhone', text)}
            error={errors.alternatePhone}
            placeholder={getLocalizedText('enter_alternate_phone', language)}
            keyboardType="phone-pad"
          />

          <Input
            label={getLocalizedText('email_address', language)}
            value={currentContact.email}
            onChangeText={(text) => handleContactInputChange('email', text)}
            error={errors.email}
            placeholder={getLocalizedText('enter_email', language)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label={getLocalizedText('address', language)}
            value={currentContact.address}
            onChangeText={(text) => handleContactInputChange('address', text)}
            placeholder={getLocalizedText('enter_address', language)}
            multiline
            numberOfLines={2}
          />

          {/* Blood Group Picker */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              {getLocalizedText('blood_group', language)}
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowBloodGroupPicker(!showBloodGroupPicker)}
            >
              <Text style={[styles.pickerButtonText, !currentContact.bloodGroup && styles.placeholderText]}>
                {currentContact.bloodGroup || getLocalizedText('select_blood_group', language)}
              </Text>
              <Text style={styles.pickerArrow}>{showBloodGroupPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {showBloodGroupPicker && (
              <View style={styles.pickerContainer}>
                {BLOOD_GROUPS.map((group) => (
                  <TouchableOpacity
                    key={group}
                    style={[
                      styles.pickerOption,
                      currentContact.bloodGroup === group && styles.pickerOptionSelected
                    ]}
                    onPress={() => {
                      handleContactInputChange('bloodGroup', group);
                      setShowBloodGroupPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      currentContact.bloodGroup === group && styles.pickerOptionTextSelected
                    ]}>
                      {group}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Input
            label={getLocalizedText('medical_conditions', language)}
            value={currentContact.medicalConditions}
            onChangeText={(text) => handleContactInputChange('medicalConditions', text)}
            placeholder={getLocalizedText('enter_medical_conditions', language)}
            multiline
            numberOfLines={2}
          />

          {/* Contact Preferences */}
          <Text style={styles.sectionTitle}>
            {getLocalizedText('contact_preferences', language)}
          </Text>

          {/* Preference toggles */}
          {[
            { key: 'canCallAnytime', label: 'can_call_anytime' },
            { key: 'emergencyOnly', label: 'emergency_only' },
            { key: 'workRelated', label: 'work_related' },
            { key: 'medicalEmergency', label: 'medical_emergency' },
          ].map(({ key, label }) => (
            <View key={key} style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>
                {getLocalizedText(label, language)}
              </Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  currentContact.preferences[key as keyof typeof currentContact.preferences] && styles.toggleActive
                ]}
                onPress={() => handleContactInputChange(
                  `preferences.${key}`, 
                  !currentContact.preferences[key as keyof typeof currentContact.preferences]
                )}
              >
                <View style={[
                  styles.toggleThumb,
                  currentContact.preferences[key as keyof typeof currentContact.preferences] && styles.toggleThumbActive
                ]} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.spacer} />
        </ScrollView>

        <View style={styles.modalActions}>
          <Button
            title={getLocalizedText('save_contact', language)}
            onPress={saveContact}
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
          {getLocalizedText('emergency_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('emergency_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Guidelines */}
        {renderGuidelines()}

        {/* Emergency Contacts */}
        <Card 
          title={`${getLocalizedText('emergency_contacts', language)} (${contactsData.contacts.length})`}
          variant="outlined" 
          margin={8}
          action={
            <Button
              title={getLocalizedText('add_contact', language)}
              onPress={() => {
                setCurrentContact(EMPTY_CONTACT);
                setEditingContactId(null);
                setShowContactForm(true);
              }}
              variant="outline"
              size="small"
              icon={<Text style={styles.addIcon}>+</Text>}
            />
          }
        >
          {contactsData.contacts.length === 0 ? (
            <View style={styles.noContactsContainer}>
              <Text style={styles.noContactsText}>
                {getLocalizedText('no_contacts_yet', language)}
              </Text>
            </View>
          ) : (
            contactsData.contacts.map(renderContactCard)
          )}
        </Card>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Contact Form Modal */}
      {renderContactForm()}

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
          disabled={contactsData.contacts.length === 0}
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
  guidelinesList: {
    paddingVertical: 8,
  },
  guidelineItem: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 6,
    lineHeight: 20,
  },
  noContactsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noContactsText: {
    fontSize: 16,
    color: '#757575',
    fontStyle: 'italic',
  },
  addIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  primaryBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  contactRelationship: {
    fontSize: 16,
    color: '#424242',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  verificationStatus: {
    marginBottom: 8,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  contactActions: {
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
  preferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  preferenceTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  preferenceTagText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  medicalTag: {
    backgroundColor: '#FFEBEE',
  },
  medicalTagText: {
    color: '#C62828',
  },
  makePrimaryContainer: {
    alignItems: 'flex-start',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginTop: 24,
    marginBottom: 16,
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
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
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
