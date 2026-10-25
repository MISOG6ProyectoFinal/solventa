import { toDisplayDate } from '../../shared/date';
import { destinos, QuoteFormValues } from './types';
import {
  addDays,
  defaultQuoteForm,
  digitsOnly,
  formatMoney,
  formatVigenteHasta,
  quoteReference,
  validateQuoteForm,
} from './utils';

function form(overrides: Partial<QuoteFormValues> = {}): QuoteFormValues {
  return { ...defaultQuoteForm(), ...overrides };
}

describe('quote utils', () => {
  it('formats COP without decimals using es-CO thousands', () => {
    expect(formatMoney('120000')).toBe('$120.000');
    expect(formatMoney('250000')).toBe('$250.000');
    expect(formatMoney('96000')).toBe('$96.000');
    expect(formatMoney('149940.00')).toBe('$149.940');
  });

  it('uses the thousands separator of the English language', () => {
    expect(formatMoney('120000', 'en')).toBe('$120,000');
    expect(formatMoney('149940.00', 'en')).toBe('$149,940');
  });

  it('says today in English for a same-day payment deadline', () => {
    const today = new Date(2026, 9, 19, 15, 0, 0);
    expect(formatVigenteHasta('2026-10-19T23:59:59-05:00', today, 'en')).toBe('today 23:59');
  });

  it('formats the backend payment deadline without inventing the cutoff', () => {
    const today = new Date(2026, 9, 19, 15, 0, 0);
    expect(formatVigenteHasta('2026-10-19T23:59:59-05:00', today)).toBe('hoy 23:59');
    expect(formatVigenteHasta('2026-10-18T23:59:59-05:00', today)).toBe('18/10/2026 23:59');
    expect(formatVigenteHasta('sin-fecha', today)).toBe('sin-fecha');
  });

  it('adds days to a local date', () => {
    expect(toDisplayDate(addDays(new Date(2026, 9, 10), 14))).toBe('24/10/2026');
  });

  it('defaults the viaje form like the prototype, with live dates', () => {
    const today = new Date();
    const values = defaultQuoteForm();

    expect(values.nombre).toBe('María Rodríguez');
    expect(values.cedula).toBe('1020304050');
    expect(values.destino).toBe('España');
    expect(values.viajeros).toBe('1');
    expect(values.fechaSalida).toBe(toDisplayDate(today));
    expect(values.fechaRegreso).toBe(toDisplayDate(addDays(today, 14)));
    expect(destinos).toEqual(['Estados Unidos', 'España', 'México', 'Otro país']);
  });

  it('validates the viaje form', () => {
    expect(validateQuoteForm(form())).toEqual({});
    expect(validateQuoteForm(form({ nombre: '   ' })).nombre).toBe('required');
    expect(validateQuoteForm(form({ cedula: '' })).cedula).toBe('required');
    expect(validateQuoteForm(form({ cedula: '10A' })).cedula).toBe('required');
    expect(validateQuoteForm(form({ destino: '' })).destino).toBe('required');
    expect(validateQuoteForm(form({ fechaSalida: '' })).fechaSalida).toBe('required');
    expect(validateQuoteForm(form({ fechaRegreso: '' })).fechaRegreso).toBe('required');
    expect(validateQuoteForm(form({ viajeros: '' })).viajeros).toBe('required');
    expect(validateQuoteForm(form({ viajeros: '0' })).viajeros).toBe('travelersAtLeastOne');
    expect(validateQuoteForm(form({ fechaSalida: toDisplayDate(addDays(new Date(), -1)) })).fechaSalida).toBe(
      'departureInPast',
    );
    expect(validateQuoteForm(form({ fechaRegreso: defaultQuoteForm().fechaSalida })).fechaRegreso).toBe(
      'returnBeforeDeparture',
    );
  });

  it('derives a stable COT-M reference from the offer id', () => {
    expect(quoteReference('oferta-1')).toMatch(/^COT-M-\d{5}$/);
    expect(quoteReference('oferta-1')).toBe(quoteReference('oferta-1'));
  });

  it('keeps only digits', () => {
    expect(digitsOnly('10A203B')).toBe('10203');
  });
});
