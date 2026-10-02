import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type FieldFrameProps = {
  label: string;
  required?: boolean;
  error?: boolean;
  message?: string;
  focused?: boolean;
  testID?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  children: ReactNode;
};

export function FieldFrame({
  label,
  required = false,
  error = false,
  message,
  focused = false,
  testID,
  trailing,
  onPress,
  children,
}: FieldFrameProps) {
  const control = (
    <View testID={testID} style={[styles.control, focused && !error && styles.focused, error && styles.error]}>
      <View style={styles.body}>{children}</View>
      {trailing}
    </View>
  );

  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        {label}
        {required ? (
          <AppText variant="label" style={styles.asterisk}>
            {' *'}
          </AppText>
        ) : null}
      </AppText>
      {onPress ? <Pressable onPress={onPress}>{control}</Pressable> : control}
      {message ? (
        <AppText variant="caption" style={styles.message}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: theme.space.xs,
  },
  label: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    letterSpacing: 0.6,
  },
  asterisk: {
    color: theme.colors.danger,
    textTransform: 'none',
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  focused: {
    borderWidth: 2,
    borderColor: theme.colors.blue,
  },
  error: {
    borderColor: theme.colors.danger,
  },
  body: {
    flex: 1,
  },
  message: {
    color: theme.colors.danger,
  },
});
