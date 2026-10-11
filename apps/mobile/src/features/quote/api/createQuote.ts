import { apiClient } from '../../../shared/api/client';
import { OfertaCotizacion, QuoteFormValues } from '../types';
import { toApiDate } from '../utils';

export function createQuote(productoId: string, values: QuoteFormValues): Promise<OfertaCotizacion> {
  return apiClient.post('/movil/cotizaciones', {
    producto_id: productoId,
    nombre: values.nombre.trim(),
    cedula: values.cedula,
    destino: values.destino,
    fecha_salida: toApiDate(values.fechaSalida),
    fecha_regreso: toApiDate(values.fechaRegreso),
    viajeros: Number(values.viajeros),
  });
}
