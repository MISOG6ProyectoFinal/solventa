import { apiClient } from '../../../shared/api/client';
import { ResultadoPago, SimulacionPago } from '../types';

export function payQuote(
  cotizacionId: string,
  intentoId: string,
  simulacion?: SimulacionPago,
): Promise<ResultadoPago> {
  return apiClient.post(`/movil/cotizaciones/${cotizacionId}/pagos`, {
    intento_id: intentoId,
    ...(simulacion ? { simulacion } : {}),
  });
}
