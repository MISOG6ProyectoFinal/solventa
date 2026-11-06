import { Injectable, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys.constants';
import { EN } from '../i18n/en';
import { ES, TextKey } from '../i18n/es';

export type Locale = 'es' | 'en';
export type TextParams = Record<string, string | number>;

const DICTIONARY: Record<Locale, Record<string, string>> = { es: ES, en: EN };

/** Idioma activo (signal) y traducción. `t()` lee el signal, por lo que las plantillas se actualizan solas. */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly _locale = signal<Locale>(this.initial());

  readonly locale = this._locale.asReadonly();

  setLocale(locale: Locale): void {
    this._locale.set(locale);
    localStorage.setItem(STORAGE_KEYS.locale, locale);
  }

  t(key: TextKey, params?: TextParams): string {
    return this.format(DICTIONARY[this._locale()][key] ?? key, params);
  }

  /** Texto de un valor del dominio (estado, causa, opción). Sin traducción se muestra `fallback`, por defecto el valor. */
  label(group: string, value: string, fallback: string = value): string {
    return DICTIONARY[this._locale()][`${group}.${value}`] ?? fallback;
  }

  private format(text: string, params?: TextParams): string {
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
  }

  private initial(): Locale {
    const saved = localStorage.getItem(STORAGE_KEYS.locale);
    return saved === 'en' || saved === 'es' ? saved : 'es';
  }
}
