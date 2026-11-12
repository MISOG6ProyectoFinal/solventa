import { CONTRACTS } from '../../../core/testing/ramos.fixtures';
import { contractFields, toCamelCase, toSnakeCase } from './contract-fields';

describe('contract fields', () => {
  const byTitle = (_key: string, title: string): string => title;

  it('turns each field of the published contract into a form field, in order', () => {
    expect(contractFields(CONTRACTS['viaje-internacional'], byTitle)).toEqual([
      expect.objectContaining({ key: 'destino', type: 'select', required: true, options: ['Estados Unidos', 'España', 'México', 'Otro país'] }),
      expect.objectContaining({ key: 'fechaSalida', type: 'date', required: true, numeric: false }),
      expect.objectContaining({ key: 'fechaRegreso', type: 'date', required: true }),
      expect.objectContaining({ key: 'viajeros', type: 'text', required: true, numeric: true }),
    ]);
  });

  it('leaves out what the channel fills in and nested objects', () => {
    const keys = contractFields(CONTRACTS['vida-hipotecario'], byTitle).map((field) => field.key);

    expect(keys).toEqual(['fechaNacimiento', 'entidad', 'valorCredito', 'plazoAnios']);
  });

  it('treats a field without required list as optional and uses the given label', () => {
    const [field] = contractFields({ properties: { valor: { type: 'number', title: 'Valor' } } }, (key) => `label:${key}`);

    expect(field).toEqual(expect.objectContaining({ key: 'valor', label: 'label:valor', required: false, numeric: true }));
  });

  it('converts between the form keys and the contract names', () => {
    expect(toCamelCase('valor_indemnizar')).toBe('valorIndemnizar');
    expect(toSnakeCase('valorIndemnizar')).toBe('valor_indemnizar');
  });
});
