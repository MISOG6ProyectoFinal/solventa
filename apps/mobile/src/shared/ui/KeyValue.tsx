import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type KeyValueProps = {
  label: string;
  value: string;
};

export function KeyValue({ label, value }: KeyValueProps) {
  return (
    <View style={styles.row}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="value">{value}</AppText>
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
});
