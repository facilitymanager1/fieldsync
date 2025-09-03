/**
 * Organization Details Screen - Placeholder
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OrganizationDetailsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Organization Details</Text>
      <Text style={styles.subtitle}>This screen is under development</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
