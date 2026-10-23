import { type Texts } from './es';

export const en: Texts = {
  home: {
    greeting: (firstName) => `Hello, ${firstName}`,
    greetingWithoutName: 'Hello',
    screenSubtitle: 'Your coverage',
    menuLabel: 'Menu',
    coverageLabel: 'Active coverage',
    policyCountSuffix: 'policies',
    policiesButton: 'View policies',
    buyButton: 'Buy',
    shortcuts: {
      claims: {
        title: 'Claims',
        hint: 'Check and report',
      },
      buy: {
        title: 'Buy insurance',
        hint: 'Get a quote and pay in minutes',
      },
      nearbyProviders: {
        title: 'Nearby assistance',
        hint: 'Partner providers near you',
      },
    },
    renewalBadge: 'Renewal due soon',
    expiresLabel: 'Expires',
    renewalButton: 'View renewal offer',
    signOutButton: 'Sign out',
    settingsButton: 'Settings',
  },
};
