/**
 * OfflineIndicator Component - Shows network status
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface OfflineIndicatorProps {
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export default function OfflineIndicator({
  style,
  textStyle,
  testID,
}: OfflineIndicatorProps) {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // For now, just assume we're online
    // In a real app, you'd use @react-native-community/netinfo
    const checkConnection = () => {
      setIsConnected(true);
    };

    checkConnection();
  }, []);

  // Don't show anything if we're online
  if (isConnected) {
    return null;
  }

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.text, textStyle]}>
        📶 No internet connection
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
