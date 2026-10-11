import { useState } from 'react';
import { StyleSheet, TextInput, type KeyboardTypeOptions } from 'react-native';

import { theme } from '../theme';
import { FieldFrame } from './FieldFrame';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  keyboardType?: KeyboardTypeOptions;
  testID?: string;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  required = false,
  error = false,
  errorMessage,
  keyboardType,
  testID,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const failed = error || errorMessage != null;

  return (
    <FieldFrame
      label={label}
      required={required}
      error={failed}
      focused={focused}
      message={errorMessage ?? (error ? 'Obligatorio' : undefined)}
      testID={testID}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'auto'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, multiline && styles.multiline]}
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
  multiline: {
    minHeight: 64,
  },
});
