import { mapFormValuesToQuotePayload } from './quote-payload.mapper';

describe('mapFormValuesToQuotePayload', () => {
  it('mapea correctamente los datos de Viaje', () => {
    const values = {
      destino: 'España',
      fechaSalida: '2026-10-10',
      fechaRegreso: '2026-10-24',
      viajeros: '2',
      fechaNacimiento: '1990-01-01',
    };

    const payload = mapFormValuesToQuotePayload('VIAJE', values);

    expect(payload['producto_id']).toBe('viaje-internacional');
    expect(payload['destino']).toBe('España');
    expect(payload['fecha_salida']).toBe('2026-10-10');
    expect(payload['fecha_regreso']).toBe('2026-10-24');
    expect(payload['viajeros']).toBe(2);
    expect(payload['fecha_nacimiento']).toBe('1990-01-01');
  });

  it('mapea correctamente los datos de Microseguros', () => {
    const values = {
      fechaNacimiento: '1996-01-01',
      sumaAsegurada: '15000000',
      beneficiario: 'Carlos Pérez',
      parentesco: 'Hijo(a)',
    };

    const payload = mapFormValuesToQuotePayload('MICROSEGURO_VIDA', values);

    expect(payload['producto_id']).toBe('vida-esencial');
    expect(payload['fecha_nacimiento']).toBe('1996-01-01');
    expect(payload['suma_asegurada']).toBe(15000000);
    expect(payload['beneficiario']).toBe('Carlos Pérez');
    expect(payload['parentesco']).toBe('Hijo(a)');
  });

  it('mapea correctamente los datos de Vida Hipotecario', () => {
    const values = {
      fechaNacimiento: '1986-01-01',
      entidad: 'Banco Aurora',
      valorCredito: '250000000',
      plazoAnios: '15',
    };

    const payload = mapFormValuesToQuotePayload('VIDA_HIPOTECARIO', values);

    expect(payload['producto_id']).toBe('vida-hipotecario');
    expect(payload['fecha_nacimiento']).toBe('1986-01-01');
    expect(payload['entidad']).toBe('Banco Aurora');
    expect(payload['valor_credito']).toBe(250000000);
    expect(payload['plazo_anios']).toBe(15);
  });

  it('mapea correctamente los datos de Paramétrico', () => {
    const values = {
      evento: 'Retraso de vuelo',
      referencia: 'AN-412',
      fechaEvento: '2026-11-15',
      valorIndemnizar: '500000',
    };

    const payload = mapFormValuesToQuotePayload('PARAMETRICO', values);

    expect(payload['producto_id']).toBe('parametrico-clima-vuelo');
    expect(payload['evento']).toBe('Retraso de vuelo');
    expect(payload['referencia']).toBe('AN-412');
    expect(payload['fecha_evento']).toBe('2026-11-15');
    expect(payload['valor_indemnizar']).toBe(500000);
  });
});
