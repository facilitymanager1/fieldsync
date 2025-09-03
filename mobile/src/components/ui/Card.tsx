/**
 * Card Component - Reusable card container with shadow and styling
 * 
 * Features:
 * - Multiple variants (default, elevated, outlined)
 * - Customizable padding and margins
 * - Shadow support for iOS and Android
 * - Header and footer sections
 * - Action buttons support
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  title?: string;
  subtitle?: string;
  action?: React.ReactNode; // Alias for headerActions
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  padding?: number;
  margin?: number;
  style?: ViewStyle;
  headerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  contentStyle?: ViewStyle;
  footerStyle?: ViewStyle;
  testID?: string;
}

export default function Card({
  children,
  variant = 'default',
  title,
  subtitle,
  action,
  headerActions,
  footerActions,
  padding = 16,
  margin = 0,
  style,
  headerStyle,
  titleStyle,
  subtitleStyle,
  contentStyle,
  footerStyle,
  testID,
}: CardProps) {
  // Use action as headerActions if provided, otherwise use headerActions
  const resolvedHeaderActions = action || headerActions;
  const cardStyles = [
    styles.card,
    styles[`card_${variant}`],
    { 
      padding,
      margin,
    },
    style,
  ];

  const renderHeader = () => {
    if (!title && !subtitle && !resolvedHeaderActions) return null;

    return (
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerContent}>
          {title && (
            <Text style={[styles.title, titleStyle]}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={[styles.subtitle, subtitleStyle]}>
              {subtitle}
            </Text>
          )}
        </View>
        {resolvedHeaderActions && (
          <View style={styles.headerActions}>
            {resolvedHeaderActions}
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    return (
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    );
  };

  const renderFooter = () => {
    if (!footerActions) return null;

    return (
      <View style={[styles.footer, footerStyle]}>
        {footerActions}
      </View>
    );
  };

  return (
    <View style={cardStyles} testID={testID}>
      {renderHeader()}
      {renderContent()}
      {renderFooter()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  
  // Variants
  card_default: {
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  card_elevated: {
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  card_outlined: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: 'transparent',
    elevation: 0,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  
  headerContent: {
    flex: 1,
  },
  
  headerActions: {
    marginLeft: 12,
  },
  
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  
  subtitle: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
  },
  
  content: {
    // Content styles can be customized by parent
  },
  
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
