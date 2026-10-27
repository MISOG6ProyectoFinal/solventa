import { toLanguage, type Language } from './language';

export function getDeviceLanguage(): Language {
  const { locale } = Intl.DateTimeFormat().resolvedOptions();
  return toLanguage(locale.slice(0, 2).toLowerCase()) ?? 'es';
}
