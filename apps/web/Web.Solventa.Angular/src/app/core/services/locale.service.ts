import { Injectable, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys.constants';

export type Locale = 'es' | 'en';

const DICTIONARY: Record<Locale, Record<string, string>> = {
  es: {
    'web.nav.ops': 'Operaciones y Pólizas',
    'web.nav.partners': 'Socios e Integraciones',
    'web.header.menu': 'Menú',
    'web.header.notifications': 'Notificaciones',
    'web.header.back': 'Volver a inicio',
    'web.profile.menu': 'Menú de perfil',
    'web.profile.settings': 'Ajustes',
    'web.profile.designSystem': 'Sistema de diseño',
    'web.sidebar.userRole': 'Administrador',
    'web.sidebar.userOrg': 'Solventa Central',
    'remote.pending': 'Módulo remoto (Micro Frontend) pendiente de integrar.',
    'settings.back': 'Volver',
    'settings.title': 'Ajustes',
    'settings.language': 'Idioma',
    'settings.languageDesc': 'Elige el idioma de la interfaz.',
    'settings.languageLabel': 'Idioma de la interfaz',
    'settings.language.es': 'Español',
    'settings.language.en': 'English',
    'ds.title': 'Sistema de diseño',
    'ds.subtitle': 'Colores · Tipografía · Componentes · Íconos',
  },
  en: {
    'web.nav.ops': 'Operations & Policies',
    'web.nav.partners': 'Partners & Integrations',
    'web.header.menu': 'Menu',
    'web.header.notifications': 'Notifications',
    'web.header.back': 'Back to home',
    'web.profile.menu': 'Profile menu',
    'web.profile.settings': 'Settings',
    'web.profile.designSystem': 'Design system',
    'web.sidebar.userRole': 'Administrator',
    'web.sidebar.userOrg': 'Solventa Central',
    'remote.pending': 'Remote module (Micro Frontend) pending integration.',
    'settings.back': 'Back',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.languageDesc': 'Choose the interface language.',
    'settings.languageLabel': 'Interface language',
    'settings.language.es': 'Español',
    'settings.language.en': 'English',
    'ds.title': 'Design system',
    'ds.subtitle': 'Colors · Typography · Components · Icons',
  },
};

/** Idioma activo (signal) y traducción. `t()` lee el signal, por lo que las plantillas se actualizan solas. */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly _locale = signal<Locale>(this.initial());

  readonly locale = this._locale.asReadonly();

  setLocale(locale: Locale): void {
    this._locale.set(locale);
    localStorage.setItem(STORAGE_KEYS.locale, locale);
  }

  t(key: string): string {
    return DICTIONARY[this._locale()][key] ?? key;
  }

  private initial(): Locale {
    const saved = localStorage.getItem(STORAGE_KEYS.locale);
    return saved === 'en' || saved === 'es' ? saved : 'es';
  }
}
