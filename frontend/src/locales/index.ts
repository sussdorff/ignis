import de from './de.json';
import en from './en.json';
import ru from './ru.json';
import hi from './hi.json';

export const resources = {
  de: { translation: de },
  en: { translation: en },
  ru: { translation: ru },
  hi: { translation: hi },
} as const;

export const supportedLanguages = ['de', 'en', 'ru', 'hi'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  ru: 'Русский',
  hi: 'हिन्दी',
};

export { de, en, ru, hi };
