import { StyleSheet } from 'react-native';

import { theme } from '../../../shared/theme';

export default StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  title: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    color: theme.colors.text,
  },
  titleInRow: {
    flex: 1,
  },
  premium: {
    color: theme.colors.navy,
  },
});
