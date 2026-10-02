export type HomeDestination = 'Policies' | 'Claims' | 'Buy';

export type HomeShortcutId = 'claims' | 'buy';

export type HomeShortcut = {
  id: HomeShortcutId;
  destination: HomeDestination;
};

export type HomeRenewal = {
  productName: string;
  policyNumber: string;
  validUntil: string;
};

export type HomeSummary = {
  policyCount: number;
  shortcuts: HomeShortcut[];
  renewal: HomeRenewal;
};

export const homeSummary: HomeSummary = {
  policyCount: 3,
  shortcuts: [
    { id: 'claims', destination: 'Claims' },
    { id: 'buy', destination: 'Buy' },
  ],
  renewal: {
    productName: 'Protección Celular',
    policyNumber: 'SLV-2025-01820',
    validUntil: '2026-10-05',
  },
};
