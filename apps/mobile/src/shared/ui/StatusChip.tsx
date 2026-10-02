import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type StatusChipVariant = 'online' | 'active' | 'filed' | 'pending' | 'assistance';

type StatusChipProps = {
  variant: StatusChipVariant;
  children: ReactNode;
  testID?: string;
};

export function StatusChip({ variant, children, testID }: StatusChipProps) {
  return (
    <View testID={testID} style={[styles.chip, containerStyles[variant]]}>
      <AppText variant="caption" style={labelStyles[variant]}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.md,
  },
});

const containerStyles = StyleSheet.create({
  online: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  active: {
    backgroundColor: theme.colors.success.background,
  },
  filed: {
    backgroundColor: theme.colors.progress.background,
  },
  pending: {
    backgroundColor: theme.colors.warning.background,
  },
  assistance: {
    backgroundColor: theme.colors.info.background,
  },
});

const labelStyles = StyleSheet.create({
  online: { color: theme.colors.navy },
  active: { color: theme.colors.success.text },
  filed: { color: theme.colors.progress.text },
  pending: { color: theme.colors.warning.text },
  assistance: { color: theme.colors.info.text },
});
