import { destinos, QuoteFormValues } from './types';
import {
  addDays,
  defaultQuoteForm,
  digitsOnly,
  formatMoney,
  fromApiDate,
  quoteReference,
  toApiDate,
  toDisplayDate,
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

  it('converts dates without shifting a day through UTC', () => {
    expect(toApiDate('10/10/2026')).toBe('2026-10-10');
    expect(fromApiDate('2026-10-24')).toBe('24/10/2026');
    expect(toDisplayDate(new Date(2026, 9, 10))).toBe('10/10/2026');
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
    expect(validateQuoteForm(form({ nombre: '   ' })).nombre).toBe('Obligatorio');
    expect(validateQuoteForm(form({ cedula: '' })).cedula).toBe('Obligatorio');
    expect(validateQuoteForm(form({ cedula: '10A' })).cedula).toBe('Obligatorio');
    expect(validateQuoteForm(form({ destino: '' })).destino).toBe('Obligatorio');
    expect(validateQuoteForm(form({ fechaSalida: '' })).fechaSalida).toBe('Obligatorio');
    expect(validateQuoteForm(form({ fechaRegreso: '' })).fechaRegreso).toBe('Obligatorio');
    expect(validateQuoteForm(form({ viajeros: '' })).viajeros).toBe('Obligatorio');
    expect(validateQuoteForm(form({ viajeros: '0' })).viajeros).toBe('Debe ser un número mayor a 0');
    expect(validateQuoteForm(form({ fechaSalida: toDisplayDate(addDays(new Date(), -1)) })).fechaSalida).toBe(
      'No puede ser anterior a hoy',
    );
    expect(validateQuoteForm(form({ fechaRegreso: defaultQuoteForm().fechaSalida })).fechaRegreso).toBe(
      'Debe ser posterior a la salida',
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
