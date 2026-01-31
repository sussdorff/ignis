import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, supportedLanguages } from './locales';

// Detect browser language
function detectLanguage(): string {
  const browserLang = navigator.language.split('-')[0];
  if (supportedLanguages.includes(browserLang as any)) {
    return browserLang;
  }
  return 'de'; // Default to German
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'de',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
