import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * Hook for questionnaire-specific translations.
 * Provides helper functions to get translated labels and options.
 */
export function useQuestionnaireTranslation() {
  const { t, i18n } = useTranslation();

  /**
   * Get the translated label for a question
   */
  const getQuestionLabel = useCallback(
    (linkId: string, fallback?: string) => {
      const key = `questionnaire.questions.${linkId}.label`;
      const translated = t(key, { defaultValue: '' });
      return translated || fallback || linkId;
    },
    [t]
  );

  /**
   * Get the translated hint for a question (if any)
   */
  const getQuestionHint = useCallback(
    (linkId: string) => {
      const key = `questionnaire.questions.${linkId}.hint`;
      const translated = t(key, { defaultValue: '' });
      return translated || undefined;
    },
    [t]
  );

  /**
   * Get the translated placeholder for a question (if any)
   */
  const getQuestionPlaceholder = useCallback(
    (linkId: string) => {
      const key = `questionnaire.questions.${linkId}.placeholder`;
      const translated = t(key, { defaultValue: '' });
      return translated || undefined;
    },
    [t]
  );

  /**
   * Get the translated option label for a choice question
   */
  const getOptionLabel = useCallback(
    (linkId: string, optionCode: string, fallback?: string) => {
      const key = `questionnaire.questions.${linkId}.options.${optionCode}`;
      const translated = t(key, { defaultValue: '' });
      return translated || fallback || optionCode;
    },
    [t]
  );

  /**
   * Get all translated options for a choice question
   * Returns an array of { code, label } objects
   */
  const getOptions = useCallback(
    (linkId: string, optionCodes: string[], fallbackLabels?: Record<string, string>) => {
      return optionCodes.map((code) => ({
        code,
        label: getOptionLabel(linkId, code, fallbackLabels?.[code]),
      }));
    },
    [getOptionLabel]
  );

  /**
   * Get a translated section title
   */
  const getSectionTitle = useCallback(
    (sectionKey: string) => {
      return t(`questionnaire.sections.${sectionKey}`);
    },
    [t]
  );

  /**
   * Get a translated validation message
   */
  const getValidationMessage = useCallback(
    (validationKey: string, params?: Record<string, string | number>) => {
      return t(`questionnaire.validation.${validationKey}`, params);
    },
    [t]
  );

  return {
    t,
    i18n,
    currentLanguage: i18n.language,
    getQuestionLabel,
    getQuestionHint,
    getQuestionPlaceholder,
    getOptionLabel,
    getOptions,
    getSectionTitle,
    getValidationMessage,
  };
}
