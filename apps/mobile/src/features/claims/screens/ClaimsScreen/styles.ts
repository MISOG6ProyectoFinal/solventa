import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
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
});
