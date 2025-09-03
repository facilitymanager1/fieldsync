/**
 * Progress Header Component - Shows onboarding progress and navigation
 * 
 * Features:
 * - Visual progress bar with percentage
 * - Step counter with current/total
 * - Back navigation with confirmation
 * - Multi-language titles
 * - Save indicators
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface ProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  percentage: number;
  title: string;
  canGoBack: boolean;
  onBackPress: () => void;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  language?: 'english' | 'hindi' | 'kannada';
}

export default function ProgressHeader({
  currentStep,
  totalSteps,
  percentage,
  title,
  canGoBack,
  onBackPress,
  saveStatus = 'saved',
  language = 'english'
}: ProgressHeaderProps) {
  const insets = useSafeAreaInsets();

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saved': return '#4CAF50';
      case 'saving': return '#FF9800';
      case 'unsaved': return '#F44336';
      default: return '#4CAF50';
    }
  };

  const getSaveStatusText = () => {
    const texts = {
      english: {
        saved: 'Saved',
        saving: 'Saving...',
        unsaved: 'Unsaved'
      },
      hindi: {
        saved: 'सेव किया गया',
        saving: 'सेव हो रहा है...',
        unsaved: 'सेव नहीं किया गया'
      },
      kannada: {
        saved: 'ಉಳಿಸಲಾಗಿದೆ',
        saving: 'ಉಳಿಸುತ್ತಿದೆ...',
        unsaved: 'ಉಳಿಸಲಾಗಿಲ್ಲ'
      }
    };
    return texts[language][saveStatus];
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, !canGoBack && styles.backButtonDisabled]}
          onPress={onBackPress}
          disabled={!canGoBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={canGoBack ? '#2196F3' : '#BDBDBD'}
          />
        </TouchableOpacity>

        {/* Title and Step Counter */}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          <Text style={styles.stepCounter}>
            {currentStep} of {totalSteps}
          </Text>
        </View>

        {/* Save Status */}
        <View style={styles.saveStatusContainer}>
          <View style={[styles.saveIndicator, { backgroundColor: getSaveStatusColor() }]} />
          <Text style={[styles.saveStatusText, { color: getSaveStatusColor() }]}>
            {getSaveStatusText()}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(percentage, 100)}%` }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(percentage)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  backButtonDisabled: {
    backgroundColor: '#FAFAFA',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 16,
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    lineHeight: 24,
  },
  stepCounter: {
    fontSize: 14,
    color: '#757575',
    marginTop: 2,
  },
  saveStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  saveStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 3,
    minWidth: 6, // Ensure some progress is always visible
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 12,
    minWidth: 32,
    textAlign: 'right',
  },
});
