import { StyleSheet } from 'react-native';

import { theme } from '../../../../shared/theme';

export default StyleSheet.create({
  content: {
    flex: 1,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  pending: {
    color: theme.colors.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapArea: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  overlay: {
    position: 'absolute',
    top: theme.space.sm,
    left: theme.space.sm,
    right: theme.space.sm,
    padding: theme.space.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  summary: {
    gap: theme.space.xs,
  },
  summaryName: {
    color: theme.colors.text,
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
  },
});
