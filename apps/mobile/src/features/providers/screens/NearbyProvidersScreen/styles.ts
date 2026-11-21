import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  content: {
    flex: 1,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  pending: {
    color: theme.colors.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
