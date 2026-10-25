import { toApiDate, toDisplayDate } from '../../shared/date';
import { type Language } from '../../shared/i18n/language';
import { useLanguageStore } from '../../shared/i18n/useLanguageStore';
import { textsFor } from './texts';
import { QuoteFormError, QuoteFormValues } from './types';

const thousandsSeparator: Record<Language, string> = { es: '.', en: ',' };

function thousands(digits: string, separator: string): string {
  const groups: string[] = [];
  let rest = digits;

  while (rest.length > 3) {
    groups.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  groups.unshift(rest);

  return groups.join(separator);
}

/** COP without decimals: $120.000 in Spanish, $120,000 in English. */
export function formatMoney(value: string | number, language = useLanguageStore.getState().language): string {
  const amount = Math.round(Number(value));
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${thousands(String(Math.abs(amount)), thousandsSeparator[language])}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function defaultQuoteForm(): QuoteFormValues {
  const today = new Date();
  return {
    nombre: 'María Rodríguez',
    cedula: '1020304050',
    destino: 'España',
    fechaSalida: toDisplayDate(today),
    fechaRegreso: toDisplayDate(addDays(today, 14)),
    viajeros: '1',
  };
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Muestra el límite que ya calculó el backend, sin volver a decidir la hora de corte. */
export function formatVigenteHasta(
  iso: string,
  now = new Date(),
  language = useLanguageStore.getState().language,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) {
    return iso;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const clock = `${match[4]}:${match[5]}`;
  const sameDay = now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
  if (sameDay) {
    return `${textsFor(language).result.today} ${clock}`;
  }

  return `${match[3]}/${match[2]}/${match[1]} ${clock}`;
}

/** Referencia visual estable derivada del id de la oferta, estilo COT-M-XXXXX. */
export function quoteReference(ofertaId: string): string {
  let hash = 0;
  for (const char of ofertaId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90000;
  }
  return `COT-M-${10000 + hash}`;
}

/** Reglas del formulario de viaje; devuelve un mensaje por campo inválido. */
export function validateQuoteForm(values: QuoteFormValues): Partial<Record<keyof QuoteFormValues, QuoteFormError>> {
  const errors: Partial<Record<keyof QuoteFormValues, QuoteFormError>> = {};
  const today = toApiDate(toDisplayDate(new Date()));

  if (values.nombre.trim() === '') {
    errors.nombre = 'required';
  }

  if (values.cedula.trim() === '' || !/^\d+$/.test(values.cedula)) {
    errors.cedula = 'required';
  }

  if (values.destino === '') {
    errors.destino = 'required';
  }

  if (values.fechaSalida === '') {
    errors.fechaSalida = 'required';
  } else if (toApiDate(values.fechaSalida) < today) {
    errors.fechaSalida = 'departureInPast';
  }

  if (values.fechaRegreso === '') {
    errors.fechaRegreso = 'required';
  } else if (values.fechaSalida !== '' && toApiDate(values.fechaRegreso) <= toApiDate(values.fechaSalida)) {
    errors.fechaRegreso = 'returnBeforeDeparture';
  }

  const travelers = Number(values.viajeros);
  if (values.viajeros.trim() === '') {
    errors.viajeros = 'required';
  } else if (!Number.isInteger(travelers) || travelers < 1) {
    errors.viajeros = 'travelersAtLeastOne';
  }

  return errors;
}
