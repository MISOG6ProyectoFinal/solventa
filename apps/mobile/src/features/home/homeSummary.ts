export type HomeDestination = 'Policies' | 'Claims' | 'Buy';

// A tab of the main navigator, or a screen of the root stack.
export type HomeShortcutDestination = HomeDestination | 'NearbyProviders';

export type HomeShortcutId = 'claims' | 'buy' | 'nearbyProviders';

export type HomeShortcut = {
  id: HomeShortcutId;
  destination: HomeShortcutDestination;
};

export type HomeSummary = {
  shortcuts: HomeShortcut[];
};

export const homeSummary: HomeSummary = {
  shortcuts: [
    { id: 'claims', destination: 'Claims' },
    { id: 'buy', destination: 'Buy' },
    { id: 'nearbyProviders', destination: 'NearbyProviders' },
  ],
};
