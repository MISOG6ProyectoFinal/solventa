import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type Option = {
  id: string;
  label: string;
};

type OptionListProps = {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
};

export function OptionList({ options, value, onChange }: OptionListProps) {
  return (
    <View style={styles.list}>
      {options.map((option) => {
        const selected = option.id === value;

        return (
          <Pressable
            key={option.id}
            testID={`option-${option.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.option, selected && styles.selected]}
          >
            <AppText variant="bodyMedium">{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
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
    borderColor: theme.colors.borderSelected,
    backgroundColor: theme.colors.info.background,
  },
});
