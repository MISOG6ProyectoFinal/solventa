import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../../../shared/theme';
import { AppText, Icon } from '../../../shared/ui';
import { categories, providerTypes } from '../categories';
import { useTexts } from '../texts';

// Static, so it is built once instead of on every render of the screen.
export const Legend = memo(function Legend() {
  const texts = useTexts();
  return (
    <View style={styles.legend}>
      {providerTypes.map((type) => (
        <View key={type} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: categories[type].color }]}>
            <Icon name={categories[type].icon} size={16} color="onNavy" />
          </View>
          <AppText variant="caption">{texts.providers.categories[type]}</AppText>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  dot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
});
