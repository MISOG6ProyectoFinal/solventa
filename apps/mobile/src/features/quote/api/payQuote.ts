import { apiClient } from '../../../shared/api/client';
import { ResultadoPago, SimulacionPago } from '../types';

export function crearIntentoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
