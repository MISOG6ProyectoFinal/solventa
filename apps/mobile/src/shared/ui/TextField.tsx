import { StyleSheet, TextInput } from 'react-native';

import { theme } from '../theme';
import { FieldFrame } from './FieldFrame';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  error?: boolean;
  testID?: string;
};

export function TextField({
  label,
  value,
  onChangeText,
  required = false,
  error = false,
  testID,
}: TextFieldProps) {
  return (
    <FieldFrame
      label={label}
      required={required}
      error={error}
      message={error ? 'Obligatorio' : undefined}
      testID={testID}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={theme.colors.textMuted}
      />
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  input: {
    ...theme.type.body,
    paddingVertical: theme.space.md,
  },
});
