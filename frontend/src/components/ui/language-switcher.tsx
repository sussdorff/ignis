import { useTranslation } from 'react-i18next';
import { languageNames, supportedLanguages, type SupportedLanguage } from '@/locales';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language as SupportedLanguage;

  return (
    <div className="flex gap-1">
      {supportedLanguages.map((lang) => (
        <button
          key={lang}
          onClick={() => i18n.changeLanguage(lang)}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            currentLang === lang
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
          aria-label={`Switch to ${languageNames[lang]}`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
