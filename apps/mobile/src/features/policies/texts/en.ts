import { type Texts } from './es';

export const en: Texts = {
  policies: {
    screenTitle: 'Policies',
    emptyMessage: 'You do not have active policies yet.',
    loadFailed: 'Could not load the policies.',
    statusActive: 'ACTIVE',
    issued: 'Your policy was issued and your insurance is now active',
    issueFailed:
      'The purchase could not be completed: the payment was approved but the policy was not issued, so you do not have active coverage. Contact support.',
    policyNumber: (numero) => `Policy ${numero}`,
    start: (fecha) => `Start ${fecha}`,
    end: (fecha) => `End ${fecha}`,
    prima: (amount) => `Premium ${amount}`,
    viewPolicy: 'View my policy',
  },
};
