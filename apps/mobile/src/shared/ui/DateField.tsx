import { StyleSheet, Text } from 'react-native';

import { theme } from '../theme';
import { FieldFrame } from './FieldFrame';

type DateFieldProps = {
  label: string;
  value?: string;
  required?: boolean;
  error?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function DateField({
  label,
  value,
  required = false,
  error = false,
  onPress,
  testID,
}: DateFieldProps) {
  return (
    <FieldFrame
      label={label}
      required={required}
      error={error}
      testID={testID}
      onPress={onPress}
      trailing={<Text style={styles.icon}>📅</Text>}
    >
      <Text style={value ? styles.value : styles.placeholder}>{value || 'dd/mm/aaaa'}</Text>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  value: {
    color: theme.colors.text,
    fontSize: theme.type.body.fontSize,
    paddingVertical: theme.space.md,
  },
  placeholder: {
    color: theme.colors.textMuted,
    fontSize: theme.type.body.fontSize,
    paddingVertical: theme.space.md,
  },
  icon: {
    marginLeft: theme.space.sm,
    fontSize: theme.type.body.fontSize,
  },
});
