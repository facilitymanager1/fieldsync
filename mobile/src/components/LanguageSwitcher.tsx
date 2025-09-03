import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalization } from '../hooks/useLocalization';
import { SupportedLanguage } from '../services/localizationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface LanguageSwitcherProps {
  style?: any;
  buttonStyle?: any;
  textStyle?: any;
  showNativeName?: boolean;
  showFlag?: boolean;
  iconSize?: number;
  modalTitle?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  style,
  buttonStyle,
  textStyle,
  showNativeName = true,
  showFlag = true,
  iconSize = 24,
  modalTitle,
}) => {
  const {
    currentLanguage,
    languageConfig,
    supportedLanguages,
    loading,
    translate,
    setLanguage
  } = useLocalization();

  const [modalVisible, setModalVisible] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleLanguageSelect = async (language: SupportedLanguage) => {
    if (language === currentLanguage) {
      setModalVisible(false);
      return;
    }

    try {
      setSwitching(true);
      await setLanguage(language);
      setModalVisible(false);
      
      // Show success message
      setTimeout(() => {
        Alert.alert(
          translate('common.success'),
          translate('language.changed', { language: getLanguageDisplayName(language) })
        );
      }, 100);
    } catch (error) {
      Alert.alert(
        translate('common.error'),
        translate('errors.languageChangeError')
      );
      console.error('Error changing language:', error);
    } finally {
      setSwitching(false);
    }
  };

  const getLanguageDisplayName = (language: SupportedLanguage): string => {
    const langConfig = supportedLanguages.find(lang => lang.code === language);
    if (!langConfig) return language;
    
    if (showNativeName && langConfig.nativeName !== langConfig.name) {
      return `${langConfig.name} (${langConfig.nativeName})`;
    }
    
    return langConfig.name;
  };

  const getLanguageFlag = (language: SupportedLanguage): string => {
    // Map language codes to flag emojis
    const flagMap: Record<SupportedLanguage, string> = {
      en: '🇺🇸',
      hi: '🇮🇳',
      kn: '🇮🇳',
      ta: '🇮🇳',
      te: '🇮🇳',
      ml: '🇮🇳',
      gu: '🇮🇳',
      mr: '🇮🇳',
      bn: '🇮🇳'
    };
    
    return flagMap[language] || '🌐';
  };

  const getCurrentDisplayText = (): string => {
    if (showNativeName && languageConfig.nativeName !== languageConfig.name) {
      return languageConfig.nativeName;
    }
    return languageConfig.name;
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.button, buttonStyle]}
        onPress={() => setModalVisible(true)}
        disabled={switching}
      >
        {showFlag && (
          <Text style={styles.flag}>
            {getLanguageFlag(currentLanguage)}
          </Text>
        )}
        
        <Text style={[styles.buttonText, textStyle]}>
          {getCurrentDisplayText()}
        </Text>
        
        <Icon 
          name="keyboard-arrow-down" 
          size={iconSize} 
          color="#666" 
          style={styles.chevron}
        />
        
        {switching && (
          <ActivityIndicator 
            size="small" 
            color="#666" 
            style={styles.loadingIndicator}
          />
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalTitle || translate('language.selectLanguage', undefined, { fallback: 'Select Language' })}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.languagesList}>
            {supportedLanguages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageItem,
                  lang.code === currentLanguage && styles.selectedLanguageItem
                ]}
                onPress={() => handleLanguageSelect(lang.code)}
                disabled={switching}
              >
                {showFlag && (
                  <Text style={styles.languageFlag}>
                    {getLanguageFlag(lang.code)}
                  </Text>
                )}
                
                <View style={styles.languageTextContainer}>
                  <Text style={[
                    styles.languageName,
                    lang.code === currentLanguage && styles.selectedLanguageName
                  ]}>
                    {lang.name}
                  </Text>
                  
                  {showNativeName && lang.nativeName !== lang.name && (
                    <Text style={[
                      styles.languageNativeName,
                      lang.code === currentLanguage && styles.selectedLanguageNativeName
                    ]}>
                      {lang.nativeName}
                    </Text>
                  )}
                </View>

                {lang.code === currentLanguage && (
                  <Icon name="check" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Text style={styles.footerText}>
              {translate('language.footerNote', undefined, { 
                fallback: 'App restart may be required for complete language switch' 
              })}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 120,
  },
  flag: {
    fontSize: 16,
    marginRight: 8,
  },
  buttonText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 4,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  languagesList: {
    flex: 1,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedLanguageItem: {
    backgroundColor: '#E8F5E8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  languageFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  selectedLanguageName: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  languageNativeName: {
    fontSize: 14,
    color: '#666',
  },
  selectedLanguageNativeName: {
    color: '#388E3C',
  },
  modalFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default LanguageSwitcher;