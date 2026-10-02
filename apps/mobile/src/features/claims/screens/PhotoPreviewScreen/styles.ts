import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  body: {
    flex: 1,
    padding: theme.space.lg,
    gap: theme.space.lg,
  },
  frame: {
    flex: 1,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.navyDeep,
  },
  photo: {
    flex: 1,
  },
});
