import { apiClient } from '../../../shared/api/client';
import { ResultadoPago, SimulacionPago } from '../types';

export function payQuote(cotizacionId: string, simulacion?: SimulacionPago): Promise<ResultadoPago> {
  return apiClient.post(`/movil/cotizaciones/${cotizacionId}/pagos`, simulacion ? { simulacion } : {});
}
