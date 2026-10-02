import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type KeyValueProps = {
  label: string;
  value: string;
};

export function KeyValue({ label, value }: KeyValueProps) {
  return (
    <View style={styles.row}>
      <Text style={theme.type.caption}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
  value: {
    fontSize: theme.type.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
