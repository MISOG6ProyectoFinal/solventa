import { PolicyStatus } from '../../../core/models/policy.model';

/** Fecha de referencia de la demo (equivale a `TODAY` de los mockups). */
export const OPS_TODAY = '2026-09-12';

export const OPS_FILTER_ALL = '';

export const POLICY_STATUS_OPTIONS: readonly PolicyStatus[] = ['Activa', 'Vencida', 'Cancelada'];

export const CANCEL_CAUSES: readonly string[] = [
  'Retracto',
  'Venta del bien asegurado',
  'Insatisfacción con el servicio',
  'Pago anticipado del crédito asociado',
  'Impago de prima',
];

/** Única causa que no genera devolución de prima. */
export const NON_REFUNDABLE_CAUSE = 'Impago de prima';

export interface EndorsementType {
  readonly id: string;
  readonly label: string;
}

export const ENDORSEMENT_TYPES: readonly EndorsementType[] = [{ id: 'contacto', label: 'Datos del asegurado' }];

export const CONSENT_CHANNELS: readonly { id: string; label: string }[] = [
  { id: 'sms', label: 'SMS al celular registrado' },
  { id: 'email', label: 'Correo electrónico registrado' },
];

export const PROVIDER_SCENARIOS: readonly { id: string; label: string }[] = [
  { id: 'normal', label: 'Proveedores responden con normalidad' },
  { id: 'degradado', label: 'Proveedor degradado (usa perfil en caché)' },
  { id: 'caida', label: 'Proveedores caídos' },
];

export const DETAIL_TABS = [
  { id: 'asegurado', label: 'Datos del asegurado' },
  { id: 'coberturas', label: 'Coberturas' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'siniestros', label: 'Siniestros' },
] as const;

export const OPS_TABS = [
  { id: 'cotizar', label: 'Cotización' },
  { id: 'polizas', label: 'Consulta de pólizas' },
] as const;
