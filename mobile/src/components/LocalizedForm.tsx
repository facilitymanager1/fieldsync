import React from 'react';
import { ScrollView, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from '../hooks/useLocalization';
import LocalizedText from './LocalizedText';
import LocalizedInput from './LocalizedInput';
import LanguageSwitcher from './LanguageSwitcher';

interface LocalizedFormProps {
  titleKey?: string;
  titleParams?: Record<string, any>;
  fallbackTitle?: string;
  showLanguageSwitcher?: boolean;
  languageSwitcherPosition?: 'top' | 'bottom';
  children: React.ReactNode;
  style?: any;
  contentContainerStyle?: any;
  headerStyle?: any;
  footerStyle?: any;
  enableKeyboardAvoid?: boolean;
}

const LocalizedForm: React.FC<LocalizedFormProps> = ({
  titleKey,
  titleParams,
  fallbackTitle,
  showLanguageSwitcher = true,
  languageSwitcherPosition = 'top',
  children,
  style,
  contentContainerStyle,
  headerStyle,
  footerStyle,
  enableKeyboardAvoid = true,
}) => {
  const { isRTL } = useTranslation();

  const renderHeader = () => (
    <View style={[styles.header, headerStyle, isRTL && styles.rtlContainer]}>
      {titleKey && (
        <LocalizedText
          translationKey={titleKey}
          params={titleParams}
          fallback={fallbackTitle}
          style={[styles.title, isRTL && styles.rtlText]}
        />
      )}
      
      {showLanguageSwitcher && languageSwitcherPosition === 'top' && (
        <View style={styles.languageSwitcherContainer}>
          <LanguageSwitcher />
        </View>
      )}
    </View>
  );

  const renderFooter = () => (
    showLanguageSwitcher && languageSwitcherPosition === 'bottom' && (
      <View style={[styles.footer, footerStyle, isRTL && styles.rtlContainer]}>
        <LanguageSwitcher />
      </View>
    )
  );

  const FormContent = () => (
    <ScrollView
      style={[styles.container, style, isRTL && styles.rtlContainer]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {renderHeader()}
      
      <View style={[styles.content, isRTL && styles.rtlContainer]}>
        {children}
      </View>
      
      {renderFooter()}
    </ScrollView>
  );

  if (enableKeyboardAvoid) {
    return (
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <FormContent />
      </KeyboardAvoidingView>
    );
  }

  return <FormContent />;
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  languageSwitcherContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  rtlContainer: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default LocalizedForm;