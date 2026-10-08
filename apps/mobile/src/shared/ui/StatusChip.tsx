import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type StatusChipVariant = 'tag' | 'active' | 'paid' | 'pending' | 'success';

type StatusChipProps = {
  variant: StatusChipVariant;
  children: ReactNode;
  testID?: string;
};

const medium = {
  fontFamily: theme.type.subtitle.fontFamily,
  fontWeight: theme.type.subtitle.fontWeight,
};

export function StatusChip({ variant, children, testID }: StatusChipProps) {
  return (
    <View testID={testID} style={[styles.chip, containerStyles[variant]]}>
      <AppText variant="bodySmall" style={[labelStyles[variant], variant !== 'tag' && medium]}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
    paddingVertical: 6,
    paddingHorizontal: theme.space.md,
  },
});

const containerStyles = StyleSheet.create({
  tag: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  active: {
    backgroundColor: theme.colors.navy,
  },
  paid: {
    backgroundColor: theme.colors.teal,
  },
  pending: {
    backgroundColor: theme.colors.warning.background,
    borderWidth: 1,
    borderColor: theme.colors.warning.border,
  },
  success: {
    backgroundColor: theme.colors.success.background,
    borderWidth: 1,
    borderColor: theme.colors.success.border,
  },
});

const labelStyles = StyleSheet.create({
  tag: { color: theme.colors.text },
  active: { color: theme.colors.onNavy },
  paid: { color: theme.colors.onNavy },
  pending: { color: theme.colors.warning.text },
  success: { color: theme.colors.success.text },
});
