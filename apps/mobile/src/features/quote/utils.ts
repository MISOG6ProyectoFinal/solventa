import { texts } from './texts';
import { QuoteFormValues } from './types';

/** COP sin decimales en es-CO: $120.000, $149.940. */
export function formatMoney(value: string | number): string {
  const amount = Math.round(Number(value));
  const digits = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0 ? '-' : ''}$${digits}`;
}

/** dd/MM/yyyy → yyyy-MM-dd por texto, sin pasar por UTC. */
export function toApiDate(value: string): string {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

/** yyyy-MM-dd → dd/MM/yyyy por texto, sin pasar por UTC. */
export function fromApiDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Fecha local como dd/MM/yyyy, sin pasar por UTC. */
export function toDisplayDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
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

/** Referencia visual estable derivada del id de la oferta, estilo COT-M-XXXXX. */
export function quoteReference(ofertaId: string): string {
  let hash = 0;
  for (const char of ofertaId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90000;
  }
  return `COT-M-${10000 + hash}`;
}

/** Reglas del formulario de viaje; devuelve un mensaje por campo inválido. */
export function validateQuoteForm(values: QuoteFormValues): Partial<QuoteFormValues> {
  const errors: Partial<QuoteFormValues> = {};
  const today = toApiDate(toDisplayDate(new Date()));

  if (values.nombre.trim() === '') {
    errors.nombre = texts.form.required;
  }

  if (values.cedula.trim() === '' || !/^\d+$/.test(values.cedula)) {
    errors.cedula = texts.form.required;
  }

  if (values.destino === '') {
    errors.destino = texts.form.required;
  }

  if (values.fechaSalida === '') {
    errors.fechaSalida = texts.form.required;
  } else if (toApiDate(values.fechaSalida) < today) {
    errors.fechaSalida = texts.form.departureInPast;
  }

  if (values.fechaRegreso === '') {
    errors.fechaRegreso = texts.form.required;
  } else if (values.fechaSalida !== '' && toApiDate(values.fechaRegreso) <= toApiDate(values.fechaSalida)) {
    errors.fechaRegreso = texts.form.returnBeforeDeparture;
  }

  const travelers = Number(values.viajeros);
  if (values.viajeros.trim() === '') {
    errors.viajeros = texts.form.required;
  } else if (!Number.isInteger(travelers) || travelers < 1) {
    errors.viajeros = texts.form.travelersAtLeastOne;
  }

  return errors;
}
