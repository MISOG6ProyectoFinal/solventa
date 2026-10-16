import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  empty: {
    padding: theme.space.xl,
    gap: theme.space.lg,
  },
  emptyMessage: {
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  title: {
    flex: 1,
    color: theme.colors.text,
  },
});
