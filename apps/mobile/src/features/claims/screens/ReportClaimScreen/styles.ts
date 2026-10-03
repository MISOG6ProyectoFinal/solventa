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
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationLabel: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    letterSpacing: 0.6,
  },
  address: {
    marginTop: theme.space.xs,
    color: theme.colors.text,
  },
  detail: {
    fontSize: 10,
    lineHeight: 15,
  },
  evidenceHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidenceTitle: {
    color: theme.colors.text,
  },
  evidenceCount: {
    ...outfitFont('400'),
  },
  thumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  thumb: {
    width: '31%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    padding: theme.space.sm,
    gap: theme.space.xs,
  },
  thumbPhoto: {
    width: '100%',
    height: 72,
    borderRadius: theme.radius.medium,
  },
  thumbLabel: {
    color: theme.colors.text,
    fontSize: 10,
    lineHeight: 14,
    ...outfitFont('400'),
  },
  thumbSize: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    ...outfitFont('400'),
  },
  evidenceError: {
    fontSize: 11,
    lineHeight: 16.5,
    color: theme.colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  action: {
    flex: 1,
  },
});
