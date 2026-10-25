export type Language = 'es' | 'en';

// Each language is named in itself so a wrong choice can always be undone.
export const languageNames: Record<Language, string> = { es: 'Español', en: 'English' };

export function toLanguage(value: unknown): Language | null {
  return value === 'es' || value === 'en' ? value : null;
}
