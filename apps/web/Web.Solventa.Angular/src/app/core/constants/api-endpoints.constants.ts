import { environment } from '../../../environments/environment';

/** Endpoints del backend; se resuelven contra `environment.apiBaseUrl`. */
export const API_ENDPOINTS = {
  policies: `${environment.apiBaseUrl}/policies`,
  quotes: `${environment.apiBaseUrl}/quotes`,
  partners: `${environment.apiBaseUrl}/web/socios`,
  partnerConfig: (partnerId: string) => `${environment.apiBaseUrl}/web/socios/${partnerId}/configuracion`,
} as const;
