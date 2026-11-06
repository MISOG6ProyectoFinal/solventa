import { CONTRACTS } from '../../../core/testing/ramos.fixtures';
import { mapFormValuesToQuotePayload } from './quote-payload.mapper';

describe('mapFormValuesToQuotePayload', () => {
  it('names the product and sends every form value in the contract field names', () => {
    const payload = mapFormValuesToQuotePayload(
      'viaje-internacional',
      { tipoDocumento: 'CE', numeroDocumento: '88776655', destino: 'España', fechaSalida: '2026-10-10' },
      CONTRACTS['viaje-internacional'],
    );

    expect(payload).toEqual({
      producto_id: 'viaje-internacional',
      tipo_documento: 'CE',
      numero_documento: '88776655',
      destino: 'España',
      fecha_salida: '2026-10-10',
    });
  });

  it('sends as numbers what the contract declares as integer', () => {
    const payload = mapFormValuesToQuotePayload('viaje-internacional', { viajeros: '2' }, CONTRACTS['viaje-internacional']);

    expect(payload['viajeros']).toBe(2);
  });

  it('sends as numbers the amounts the contract declares as decimal', () => {
    const payload = mapFormValuesToQuotePayload(
      'vida-hipotecario',
      { valorCredito: '250000000', plazoAnios: '15' },
      CONTRACTS['vida-hipotecario'],
    );

    expect(payload['valor_credito']).toBe(250000000);
    expect(payload['plazo_anios']).toBe(15);
  });

  it('keeps as text the values the contract does not declare as numbers', () => {
    const payload = mapFormValuesToQuotePayload(
      'vida-hipotecario',
      { telefono: '3001234567', consentimiento_id: 'CNS-1' },
      CONTRACTS['vida-hipotecario'],
    );

    expect(payload['telefono']).toBe('3001234567');
    expect(payload['consentimiento_id']).toBe('CNS-1');
  });

  it('leaves out the values the advisor did not fill in', () => {
    const payload = mapFormValuesToQuotePayload(
      'viaje-internacional',
      { destino: '  España ', fechaNacimiento: '', apellido: '   ' },
      CONTRACTS['viaje-internacional'],
    );

    expect(payload).toEqual({ producto_id: 'viaje-internacional', destino: 'España' });
  });
});
