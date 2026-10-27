import 'react-native-get-random-values';

import { apiClient } from '../../../shared/api/client';
import { ResultadoPago, SimulacionPago } from '../types';

// Un id por intento de pago. crypto.getRandomValues es la fuente criptográfica del dispositivo.
export function crearIntentoId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const aleatorio = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${Date.now().toString(36)}-${aleatorio}`;
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
