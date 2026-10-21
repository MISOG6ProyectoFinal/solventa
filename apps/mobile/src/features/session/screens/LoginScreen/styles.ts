import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  avoiding: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  contentWithKeyboard: {
    justifyContent: 'flex-start',
  },
  devTools: {
    position: 'absolute',
    right: theme.space.lg,
  },
  logo: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: theme.space.sm,
    paddingBottom: theme.space.lg,
  },
});
