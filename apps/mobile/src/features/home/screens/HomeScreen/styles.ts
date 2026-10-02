import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space.lg,
  },
  surface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.medium,
    padding: theme.space.lg,
    gap: theme.space.md,
    alignItems: 'center',
  },
});
