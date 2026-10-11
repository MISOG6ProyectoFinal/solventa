import { useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { FieldFrame } from './FieldFrame';
import { Icon } from './Icon';
import { Sheet, type SheetHandle } from './Sheet';

export type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value?: string;
  options?: SelectOption[];
  onChange?: (value: string) => void;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  testID?: string;
};

export function SelectField({
  label,
  value,
  options = [],
  onChange,
  required = false,
  error = false,
  errorMessage,
  testID,
}: SelectFieldProps) {
  const sheet = useRef<SheetHandle>(null);
  const [focused, setFocused] = useState(false);
  const selected = options.find((option) => option.value === value);
  const shown = selected?.label || value;
  const failed = error || errorMessage != null;

  const choose = (next: string) => {
    onChange?.(next);
    sheet.current?.dismiss();
  };

  return (
    <>
      <FieldFrame
        label={label}
        required={required}
        error={failed}
        focused={focused}
        message={errorMessage ?? (error ? 'Obligatorio' : undefined)}
        testID={testID}
        onPress={
          options.length > 0
            ? () => {
                setFocused(true);
                sheet.current?.present();
              }
            : undefined
        }
        trailing={<Icon name="desplegar" size={16} color="gray" />}
      >
        <AppText variant="bodySmall" style={shown ? styles.value : styles.placeholder}>
          {shown || 'Selecciona'}
        </AppText>
      </FieldFrame>
      <Sheet ref={sheet} onClose={() => setFocused(false)} testID="select-sheet">
        <AppText variant="subtitle">{label}</AppText>
        {options.map((option) => {
          const selectedOption = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: selectedOption }}
              onPress={() => choose(option.value)}
              style={[styles.option, selectedOption && styles.selected]}
            >
              <AppText variant="bodySmall" style={styles.optionLabel}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  value: {
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
  option: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  selected: {
    backgroundColor: theme.colors.info.background,
    borderColor: theme.colors.borderSelected,
  },
  optionLabel: {
    color: theme.colors.text,
  },
});
