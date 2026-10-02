import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type FieldFrameProps = {
  label: string;
  required?: boolean;
  error?: boolean;
  message?: string;
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
  testID,
  trailing,
  onPress,
  children,
}: FieldFrameProps) {
  const control = (
    <View testID={testID} style={[styles.control, error && styles.error]}>
      <View style={styles.body}>{children}</View>
      {trailing}
    </View>
  );

  return (
    <View style={styles.field}>
      <AppText variant="label">
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
    paddingHorizontal: theme.space.md,
    minHeight: 48,
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
