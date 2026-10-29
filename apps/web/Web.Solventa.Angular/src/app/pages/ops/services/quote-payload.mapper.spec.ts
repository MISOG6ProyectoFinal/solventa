import { RamoId } from '../../../core/models/ramo.model';
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

  it('aplica valores por defecto en Viaje cuando los campos no obligatorios faltan', () => {
    const payload = mapFormValuesToQuotePayload('VIAJE', { fechaSalida: '2026-10-10', fechaRegreso: '2026-10-20' });
    expect(payload['destino']).toBe('Estados Unidos');
    expect(payload['viajeros']).toBe(1);
    expect(payload['fecha_nacimiento']).toBeUndefined();
  });

  it('aplica valores por defecto en Microseguro, Hipotecario y Paramétrico con valores vacíos', () => {
    const micro = mapFormValuesToQuotePayload('MICROSEGURO_VIDA', {});
    expect(micro['suma_asegurada']).toBe(0);
    expect(micro['beneficiario']).toBe('');
    expect(micro['parentesco']).toBe('Cónyuge');

    const hipo = mapFormValuesToQuotePayload('VIDA_HIPOTECARIO', {});
    expect(hipo['entidad']).toBe('');
    expect(hipo['valor_credito']).toBe(0);
    expect(hipo['plazo_anios']).toBe(1);

    const param = mapFormValuesToQuotePayload('PARAMETRICO', {});
    expect(param['evento']).toBe('Retraso de vuelo');
    expect(param['referencia']).toBe('');
    expect(param['valor_indemnizar']).toBe(0);
  });

  it('usa la rama default para ramos no reconocidos', () => {
    const payload = mapFormValuesToQuotePayload('OTRO_RAMO' as unknown as RamoId, { extra: 'dato' });
    expect(payload['producto_id']).toBe('otro-ramo');
    expect(payload['extra']).toBe('dato');
  });

  it('incluye siempre los datos del cliente capturados en el formulario', () => {
    const values = {
      tipoDocumento: 'CE',
      numeroDocumento: '88776655',
      nombre: 'Valeria',
      apellido: 'Duarte',
      email: 'valeria@test.com',
      telefono: '3123456789',
      fechaSalida: '2026-10-10',
      fechaRegreso: '2026-10-20',
    };
    const payload = mapFormValuesToQuotePayload('VIAJE', values);
    expect(payload['tipo_documento']).toBe('CE');
    expect(payload['numero_documento']).toBe('88776655');
    expect(payload['nombre']).toBe('Valeria');
    expect(payload['apellido']).toBe('Duarte');
    expect(payload['email']).toBe('valeria@test.com');
    expect(payload['telefono']).toBe('3123456789');
  });
});
