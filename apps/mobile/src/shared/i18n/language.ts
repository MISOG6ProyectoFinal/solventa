export type Language = 'es' | 'en';

// Each language is named in itself so a wrong choice can always be undone.
export const languageNames: Record<Language, string> = { es: 'Español', en: 'English' };

export const languageOptions = (Object.keys(languageNames) as Language[]).map((id) => ({
  id,
  label: languageNames[id],
}));

export function toLanguage(value: unknown): Language | null {
  return value === 'es' || value === 'en' ? value : null;
}
