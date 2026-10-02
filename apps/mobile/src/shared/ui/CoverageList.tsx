import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type CoverageListProps = {
  items: string[];
};

export function CoverageList({ items }: CoverageListProps) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <AppText key={item} variant="body">
          {item}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.space.sm,
  },
});
