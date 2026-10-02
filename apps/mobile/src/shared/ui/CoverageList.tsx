import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type CoverageListProps = {
  items: string[];
};

export function CoverageList({ items }: CoverageListProps) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Text key={item} style={theme.type.body}>
          {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.space.sm,
  },
});
