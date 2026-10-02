import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { AppText } from './AppText';
import { FieldFrame } from './FieldFrame';
import { Icon } from './Icon';

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
  testID?: string;
};

export function SelectField({
  label,
  value,
  options = [],
  onChange,
  required = false,
  error = false,
  testID,
}: SelectFieldProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const shown = selected?.label || value;

  const choose = (next: string) => {
    onChange?.(next);
    setOpen(false);
  };

  return (
    <>
      <FieldFrame
        label={label}
        required={required}
        error={error}
        focused={open}
        message={error ? 'Obligatorio' : undefined}
        testID={testID}
        onPress={options.length > 0 ? () => setOpen(true) : undefined}
        trailing={<Icon name="desplegar" size={16} color="gray" />}
      >
        <AppText variant="bodySmall" style={shown ? styles.value : styles.placeholder}>
          {shown || 'Selecciona'}
        </AppText>
      </FieldFrame>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            accessibilityLabel="Cerrar"
            onPress={() => setOpen(false)}
            style={styles.dismiss}
          />
          <View
            testID="select-sheet"
            style={[styles.sheet, { paddingBottom: insets.bottom + theme.space.lg }]}
          >
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
          </View>
        </View>
      </Modal>
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 42, 69, 0.45)',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.medium,
    borderTopRightRadius: theme.radius.medium,
    padding: theme.space.lg,
    gap: theme.space.sm,
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
