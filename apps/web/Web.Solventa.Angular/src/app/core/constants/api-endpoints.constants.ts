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
  policyEndorsements: (policyId: string) =>
    `${environment.apiBaseUrl}/web/polizas/${encodeURIComponent(policyId)}/endosos`,
  policyCancellation: (policyId: string) =>
    `${environment.apiBaseUrl}/web/polizas/${encodeURIComponent(policyId)}/cancelacion`,
  policyCancellationQuote: (policyId: string) =>
    `${environment.apiBaseUrl}/web/polizas/${encodeURIComponent(policyId)}/cancelacion/calculo`,
  simulator: (provider: string) => `${environment.apiBaseUrl}/simuladores/${provider}`,
  webPolicies: `${environment.apiBaseUrl}/web/polizas`,
  quotes: `${environment.apiBaseUrl}/web/cotizaciones`,
  ramos: `${environment.apiBaseUrl}/web/ramos`,
  productContract: (productId: string) =>
    `${environment.apiBaseUrl}/web/productos/${encodeURIComponent(productId)}/contrato`,
  documentTypes: `${environment.apiBaseUrl}/web/tipos-documento`,
  policyStatuses: `${environment.apiBaseUrl}/web/polizas/estados`,
  cancellationCauses: `${environment.apiBaseUrl}/web/polizas/causas-cancelacion`,
  partnerTypes: `${environment.apiBaseUrl}/web/socios/tipos`,
  partnerScopes: `${environment.apiBaseUrl}/web/socios/alcances`,
  partners: `${environment.apiBaseUrl}/web/socios`,
  partnerConfig: (partnerId: string) => `${environment.apiBaseUrl}/web/socios/${partnerId}/configuracion`,
  consentimientos: {
    solicitar: `${environment.apiBaseUrl}/web/consentimientos/solicitar`,
    validar: `${environment.apiBaseUrl}/web/consentimientos/validar`,
    consultar: (id: string) => `${environment.apiBaseUrl}/web/consentimientos/${id}`,
  },
} as const;
