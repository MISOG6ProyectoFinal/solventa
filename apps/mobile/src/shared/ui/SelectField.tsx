import { StyleSheet, Text } from 'react-native';

import { theme } from '../theme';
import { FieldFrame } from './FieldFrame';

type SelectFieldProps = {
  label: string;
  value?: string;
  required?: boolean;
  error?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function SelectField({
  label,
  value,
  required = false,
  error = false,
  onPress,
  testID,
}: SelectFieldProps) {
  return (
    <FieldFrame
      label={label}
      required={required}
      error={error}
      testID={testID}
      onPress={onPress}
      trailing={<Text style={styles.icon}>▼</Text>}
    >
      <Text style={value ? styles.value : styles.placeholder}>{value || 'Selecciona'}</Text>
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
    color: theme.colors.textMuted,
    fontSize: theme.type.caption.fontSize,
    marginLeft: theme.space.sm,
  },
});
