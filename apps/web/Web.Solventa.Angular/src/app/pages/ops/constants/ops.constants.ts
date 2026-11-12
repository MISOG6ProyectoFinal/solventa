import { TextKey } from '../../../core/i18n/es';


export const OPS_FILTER_ALL = '';

export const CONSENT_CHANNELS: readonly { id: 'sms' | 'email'; labelKey: TextKey }[] = [
  { id: 'sms', labelKey: 'consent.channel.sms' },
  { id: 'email', labelKey: 'consent.channel.email' },
];

export const DETAIL_TABS: readonly { id: string; labelKey: TextKey }[] = [
  { id: 'asegurado', labelKey: 'policy.tab.insured' },
  { id: 'coberturas', labelKey: 'policy.tab.coverages' },
  { id: 'pagos', labelKey: 'policy.tab.payments' },
  { id: 'siniestros', labelKey: 'policy.tab.claims' },
];
