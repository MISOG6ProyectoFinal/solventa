import { RamoId } from '../../../core/models/ramo.model';

export function mapFormValuesToQuotePayload(ramo: RamoId, values: Record<string, string>): Record<string, unknown> {
  switch (ramo) {
    case 'VIAJE':
      return {
        producto_id: 'viaje-internacional',
        destino: values['destino'] ?? 'Estados Unidos',
        fecha_salida: values['fechaSalida'],
        fecha_regreso: values['fechaRegreso'],
        viajeros: Number(values['viajeros']) || 1,
        fecha_nacimiento: values['fechaNacimiento'] || undefined,
      };

    case 'MICROSEGURO_VIDA':
      return {
        producto_id: 'vida-esencial',
        fecha_nacimiento: values['fechaNacimiento'],
        suma_asegurada: Number(values['sumaAsegurada']) || 0,
        beneficiario: values['beneficiario'] ?? '',
        parentesco: values['parentesco'] ?? 'Cónyuge',
      };

    case 'VIDA_HIPOTECARIO':
      return {
        producto_id: 'vida-hipotecario',
        fecha_nacimiento: values['fechaNacimiento'],
        entidad: values['entidad'] ?? '',
        valor_credito: Number(values['valorCredito']) || 0,
        plazo_anios: Number(values['plazoAnios']) || 1,
      };

    case 'PARAMETRICO':
      return {
        producto_id: 'parametrico-clima-vuelo',
        evento: values['evento'] ?? 'Retraso de vuelo',
        referencia: values['referencia'] ?? '',
        fecha_evento: values['fechaEvento'],
        valor_indemnizar: Number(values['valorIndemnizar']) || 0,
      };

    default:
      return {
        producto_id: ramo.toLowerCase().replace('_', '-'),
        ...values,
      };
  }
}
