import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '../theme';

type ButtonVariant = 'primary' | 'confirm' | 'secondary' | 'danger';

type ButtonProps = {
  title: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function Button({
  title,
  variant = 'primary',
  disabled = false,
  onPress,
  testID,
}: ButtonProps) {
  const looksDisabled = disabled && variant === 'primary';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, containerStyles[variant], looksDisabled && styles.disabled]}
    >
      <Text style={[theme.type.body, labelStyles[variant], styles.label]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: theme.radius.medium,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  label: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});

const containerStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.colors.navy,
  },
  confirm: {
    backgroundColor: theme.colors.teal,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
});

const labelStyles = StyleSheet.create({
  primary: { color: theme.colors.onNavy },
  confirm: { color: theme.colors.onNavy },
  secondary: { color: theme.colors.navy },
  danger: { color: theme.colors.onNavy },
});
