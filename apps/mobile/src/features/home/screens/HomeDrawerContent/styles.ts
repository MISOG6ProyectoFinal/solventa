import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.space.lg,
    gap: theme.space.lg,
  },
  profile: {
    gap: theme.space.xs,
  },
  signOut: {
    marginTop: 'auto',
  },
});
