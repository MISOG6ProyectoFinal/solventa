export type Language = 'es' | 'en';

export function toLanguage(value: unknown): Language | null {
  return value === 'es' || value === 'en' ? value : null;
}
