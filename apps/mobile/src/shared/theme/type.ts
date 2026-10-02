import { TextStyle } from 'react-native';

import { colors } from './colors';

export const type = {
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onNavy,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
  },
} as const satisfies Record<string, TextStyle>;
