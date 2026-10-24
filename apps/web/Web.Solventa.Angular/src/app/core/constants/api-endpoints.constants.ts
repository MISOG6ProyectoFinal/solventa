import { environment } from '../../../environments/environment';

/** Endpoints del backend; se resuelven contra `environment.apiBaseUrl`. */
export const API_ENDPOINTS = {
  policies: `${environment.apiBaseUrl}/policies`,
  quotes: `${environment.apiBaseUrl}/web/cotizaciones`,
  ramos: `${environment.apiBaseUrl}/web/ramos`,
  partners: `${environment.apiBaseUrl}/web/socios`,
  partnerConfig: (partnerId: string) => `${environment.apiBaseUrl}/web/socios/${partnerId}/configuracion`,
  consentimientos: {
    solicitar: `${environment.apiBaseUrl}/web/consentimientos/solicitar`,
    validar: `${environment.apiBaseUrl}/web/consentimientos/validar`,
    consultar: (id: string) => `${environment.apiBaseUrl}/web/consentimientos/${id}`,
  },
} as const;
