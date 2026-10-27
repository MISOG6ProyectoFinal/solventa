import { RamoId } from '../../../core/models/ramo.model';

export function mapFormValuesToQuotePayload(
  ramo: RamoId,
  values: Record<string, string>,
): Record<string, unknown> {
  const fullName = (values['nombre'] || '').trim();
  const nameParts = fullName ? fullName.split(' ') : [];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  const clientData = {
    tipo_documento: values['tipoDocumento'] || 'CC',
    numero_documento: values['numeroDocumento'] || values['documento'] || '',
    nombre: values['nombre'] || '',
    apellido: values['apellido'] || lastName,
    email: values['email'] || '',
    telefono: values['telefono'] || '',
  };

  switch (ramo) {
    case 'VIAJE':
      return {
        producto_id: 'viaje-internacional',
        ...clientData,
        destino: values['destino'] ?? 'Estados Unidos',
        fecha_salida: values['fechaSalida'],
        fecha_regreso: values['fechaRegreso'],
        viajeros: Number(values['viajeros']) || 1,
        fecha_nacimiento: values['fechaNacimiento'] || undefined,
      };

    case 'MICROSEGURO_VIDA':
      return {
        producto_id: 'vida-esencial',
        ...clientData,
        fecha_nacimiento: values['fechaNacimiento'],
        suma_asegurada: Number(values['sumaAsegurada']) || 0,
        beneficiario: values['beneficiario'] ?? '',
        parentesco: values['parentesco'] ?? 'Cónyuge',
      };

    case 'VIDA_HIPOTECARIO':
      return {
        producto_id: 'vida-hipotecario',
        ...clientData,
        fecha_nacimiento: values['fechaNacimiento'],
        entidad: values['entidad'] ?? '',
        valor_credito: Number(values['valorCredito']) || 0,
        plazo_anios: Number(values['plazoAnios']) || 1,
        consentimiento_id: values['consentimiento_id'] || undefined,
        cliente_id: values['numeroDocumento'] || values['documento'] || undefined,
      };

    case 'PARAMETRICO':
      return {
        producto_id: 'parametrico-clima-vuelo',
        ...clientData,
        evento: values['evento'] ?? 'Retraso de vuelo',
        referencia: values['referencia'] ?? '',
        fecha_evento: values['fechaEvento'],
        valor_indemnizar: Number(values['valorIndemnizar']) || 0,
      };

    default:
      return {
        producto_id: ramo.toLowerCase().replace('_', '-'),
        ...clientData,
        ...values,
      };
  }
}
