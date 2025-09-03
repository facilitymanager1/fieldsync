import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTranslation } from '../hooks/useLocalization';
import { SupportedLanguage } from '../services/localizationService';

interface LocalizedTextProps extends TextProps {
  translationKey: string;
  params?: Record<string, any>;
  fallback?: string;
  count?: number;
  language?: SupportedLanguage;
  children?: never; // Prevent children since we use translationKey
}

const LocalizedText: React.FC<LocalizedTextProps> = ({
  translationKey,
  params,
  fallback,
  count,
  language,
  style,
  ...textProps
}) => {
  const { translate, isRTL } = useTranslation();

  const translatedText = translate(translationKey, params, {
    count,
    language,
    fallback: fallback || translationKey
  });

  return (
    <Text
      {...textProps}
      style={[
        style,
        isRTL && { textAlign: 'right', writingDirection: 'rtl' }
      ]}
    >
      {translatedText}
    </Text>
  );
};

export default LocalizedText;