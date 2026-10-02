import { useState } from 'react';
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
  const [focused, setFocused] = useState(false);

  return (
    <FieldFrame
      label={label}
      required={required}
      error={error}
      focused={focused}
      message={error ? 'Obligatorio' : undefined}
      testID={testID}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
        placeholderTextColor={theme.colors.textMuted}
      />
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  input: {
    ...theme.type.bodySmall,
    color: theme.colors.text,
    paddingVertical: 0,
  },
});
