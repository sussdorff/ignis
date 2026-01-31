import de from './de.json';
import en from './en.json';
import tr from './tr.json';

export const resources = {
  de: { translation: de },
  en: { translation: en },
  tr: { translation: tr },
} as const;

export const supportedLanguages = ['de', 'en', 'tr'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  tr: 'Türkçe',
};

export { de, en, tr };
