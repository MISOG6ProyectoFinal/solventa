export type HomeDestination = 'Policies' | 'Claims' | 'Buy';

// A tab of the main navigator, or a screen of the root stack.
export type HomeShortcutDestination = HomeDestination | 'NearbyProviders';

export type HomeShortcutId = 'claims' | 'buy' | 'nearbyProviders';

export type HomeShortcut = {
  id: HomeShortcutId;
  destination: HomeShortcutDestination;
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
    { id: 'nearbyProviders', destination: 'NearbyProviders' },
  ],
  renewal: {
    productName: 'Protección Celular',
    policyNumber: 'SLV-2025-01820',
    validUntil: '2026-10-05',
  },
};
