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
  title: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    color: theme.colors.text,
  },
  compare: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  column: {
    flex: 1,
    gap: theme.space.xs,
  },
  proposed: {
    color: theme.colors.navy,
  },
});
