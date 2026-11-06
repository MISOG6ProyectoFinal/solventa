import { environment } from '../../../environments/environment';

/** Endpoints del backend; se resuelven contra `environment.apiBaseUrl`. */
export const API_ENDPOINTS = {
  session: {
    login: `${environment.apiBaseUrl}/web/sesiones`,
    current: `${environment.apiBaseUrl}/web/sesion`,
  },
  operators: `${environment.apiBaseUrl}/web/operadores`,
  operator: (operatorId: string) => `${environment.apiBaseUrl}/web/operadores/${encodeURIComponent(operatorId)}`,
  policies: `${environment.apiBaseUrl}/web/polizas`,
  policy: (policyId: string) => `${environment.apiBaseUrl}/web/polizas/${encodeURIComponent(policyId)}`,
  simulator: (provider: string) => `${environment.apiBaseUrl}/simuladores/${provider}`,
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
