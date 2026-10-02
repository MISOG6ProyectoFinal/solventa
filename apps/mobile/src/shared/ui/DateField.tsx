import { StyleSheet } from 'react-native';

import { theme } from '../theme';
import { FieldFrame } from './FieldFrame';
import { AppText } from './AppText';

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
      trailing={
        <AppText variant="body" style={styles.icon}>
          📅
        </AppText>
      }
    >
      <AppText variant="bodySmall" style={value ? styles.value : styles.placeholder}>
        {value || 'dd/mm/aaaa'}
      </AppText>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  value: {
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
  icon: {
    marginLeft: theme.space.sm,
  },
});
