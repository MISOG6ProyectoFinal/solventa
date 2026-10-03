import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';
import { outfitFont } from '../../../../shared/theme/fonts';

export default StyleSheet.create({
  body: {
    flex: 1,
    padding: theme.space.lg,
    gap: theme.space.lg,
  },
  preview: {
    flex: 1,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.navyDeep,
  },
  camera: {
    flex: 1,
  },
  photo: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  cameraLabel: {
    color: theme.colors.onNavy,
    textAlign: 'center',
  },
  hint: {
    color: theme.colors.onNavyMuted,
    textAlign: 'center',
  },
  gps: {
    color: theme.colors.onNavyMuted,
    textAlign: 'center',
    ...outfitFont('400'),
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  action: {
    flex: 1,
  },
});
