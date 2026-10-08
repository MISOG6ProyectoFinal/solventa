import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';
import { outfitFont } from '../../../../shared/theme/fonts';

export default StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.space.lg,
    gap: theme.space.md,
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
  description: {
    color: theme.colors.text,
  },
  thumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  thumb: {
    width: '31%',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    padding: theme.space.sm,
    gap: theme.space.xs,
  },
  thumbLabel: {
    color: theme.colors.text,
    fontSize: 10,
    lineHeight: 14,
    ...outfitFont('400'),
  },
  thumbTime: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    ...outfitFont('400'),
  },
});
