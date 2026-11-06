import { TextKey } from '../../../core/i18n/es';
import { PolicyStatus } from '../../../core/models/policy.model';
import { SimulatorMode } from '../services/simulator.service';


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
  readonly labelKey: TextKey;
}

export const ENDORSEMENT_TYPES: readonly EndorsementType[] = [{ id: 'contacto', labelKey: 'endorsement.type.contacto' }];

export const CONSENT_CHANNELS: readonly { id: 'sms' | 'email'; labelKey: TextKey }[] = [
  { id: 'sms', labelKey: 'consent.channel.sms' },
  { id: 'email', labelKey: 'consent.channel.email' },
];

export const PROVIDER_SCENARIOS: readonly { id: string; mode: SimulatorMode; labelKey: TextKey }[] = [
  { id: 'normal', mode: 'normal', labelKey: 'quote.scenario.normal' },
  { id: 'degradado', mode: 'lento', labelKey: 'quote.scenario.degradado' },
  { id: 'caida', mode: 'caido', labelKey: 'quote.scenario.caida' },
];

export const DETAIL_TABS: readonly { id: string; labelKey: TextKey }[] = [
  { id: 'asegurado', labelKey: 'policy.tab.insured' },
  { id: 'coberturas', labelKey: 'policy.tab.coverages' },
  { id: 'pagos', labelKey: 'policy.tab.payments' },
  { id: 'siniestros', labelKey: 'policy.tab.claims' },
];
