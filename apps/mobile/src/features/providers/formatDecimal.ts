import { type Language } from '../../shared/i18n/language';

// One decimal with the separator of the language, as shown to people: 2.4 -> "2,4" in Spanish.
export function formatDecimal(value: number, language: Language): string {
  return language === 'es' ? value.toFixed(1).replace('.', ',') : value.toFixed(1);
}
