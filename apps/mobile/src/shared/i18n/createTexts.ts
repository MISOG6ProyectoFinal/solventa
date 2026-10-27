import { type Language } from './language';
import { useLanguageStore } from './useLanguageStore';

// `useTexts` re-renders on a language change. `getTexts` is for code that runs outside render.
// `textsFor` is for code that already holds the language.
export function createTexts<T>(catalog: Record<Language, T>) {
  return {
    useTexts: () => catalog[useLanguageStore((state) => state.language)],
    getTexts: () => catalog[useLanguageStore.getState().language],
    textsFor: (language: Language) => catalog[language],
  };
}
