import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.space.lg,
    gap: theme.space.lg,
  },
  coverageCopy: {
    gap: theme.space.xs,
  },
  coverageLabel: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    color: theme.colors.onNavyMuted,
  },
  onNavy: {
    color: theme.colors.onNavy,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  action: {
    flex: 1,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  shortcut: {
    flex: 1,
  },
  shortcutCopy: {
    gap: 2,
  },
  shortcutTitle: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    color: theme.colors.text,
  },
});
