import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type KeyValueProps = {
  label: string;
  value: string;
  // The label and the value share one line, with the value in bold.
  inline?: boolean;
};

export function KeyValue({ label, value, inline = false }: Readonly<KeyValueProps>) {
  if (inline) {
    return (
      <AppText variant="bodySmall">
        {label} <AppText variant="bodySmall" style={styles.inlineValue}>{value}</AppText>
      </AppText>
    );
  }

  return (
    <View style={styles.row}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  inlineValue: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    color: theme.colors.text,
  },
});
