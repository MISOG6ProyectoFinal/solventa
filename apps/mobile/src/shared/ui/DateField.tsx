import { StyleSheet } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { FieldFrame } from './FieldFrame';
import { Icon } from './Icon';

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
      trailing={<Icon name="calendario" size={16} color="gray" testID={testID ? `${testID}-icon` : undefined} />}
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
});
