import { Locale } from '../../core/services/locale.service';

/** Formatea una fecha ISO (`YYYY-MM-DD`) de forma legible según el idioma. */
export function formatDate(iso: string, locale: Locale = 'es'): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

const MS_PER_DAY = 86_400_000;

/** Días enteros entre dos fechas ISO (`YYYY-MM-DD`). Negativo si `to` es anterior a `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}
