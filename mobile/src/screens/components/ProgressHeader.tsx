/**
 * ProgressHeader Component - Shows progress through onboarding flow
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface ProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  title?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  progressBarStyle?: ViewStyle;
  testID?: string;
}

export default function ProgressHeader({
  currentStep,
  totalSteps,
  title,
  style,
  titleStyle,
  progressBarStyle,
  testID,
}: ProgressHeaderProps) {
  const progressPercentage = Math.min((currentStep / totalSteps) * 100, 100);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {title && (
        <Text style={[styles.title, titleStyle]}>
          {title}
        </Text>
      )}
      
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, progressBarStyle]}>
          <View 
            style={[
              styles.progressFill,
              { width: `${progressPercentage}%` }
            ]} 
          />
        </View>
        
        <Text style={styles.stepText}>
          {currentStep} of {totalSteps}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  
  stepText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'right',
  },
});
