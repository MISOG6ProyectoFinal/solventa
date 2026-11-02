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
    detailTitle: 'My policy',
    renewalOfferAvailable: 'Renewal offer available',
    renewalOfferTitle: 'Renewal offer',
    renewalOfferBody: (days) =>
      `Your policy expires in ${days} days. Viewing the offer does not change your current policy.`,
    seeRenewalOffer: 'See renewal offer',
  },
  renewal: {
    screenTitle: 'Renewal offer',
    loading: 'Loading',
    loadFailed: 'Could not load the renewal offer.',
    retryButton: 'Retry',
    disclaimer: 'Viewing this offer does not change your current policy.',
    currentPremium: 'Current premium',
    newPremium: 'New premium',
    newValidityPrefix: 'New term:',
  },
};
