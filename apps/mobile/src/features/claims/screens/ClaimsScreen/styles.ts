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
  banners: {
    gap: theme.space.md,
  },
});
