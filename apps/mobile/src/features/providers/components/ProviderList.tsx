import { ScrollView, StyleSheet } from 'react-native';

import { theme } from '../../../shared/theme';
import { Card } from '../../../shared/ui';
import { type NearbyProvider } from '../types';
import { ProviderSummary } from './ProviderSummary';

// Screen reader friendly alternative to the map, ordered from the closest provider.
export function ProviderList({ providers }: Readonly<{ providers: NearbyProvider[] }>) {
  const sorted = [...providers].sort((a, b) => a.distanceKm - b.distanceKm);

  return (
    <ScrollView testID="provider-list" contentContainerStyle={styles.list}>
      {sorted.map((provider) => (
        <Card key={provider.id} testID={`provider-item-${provider.id}`}>
          <ProviderSummary provider={provider} />
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: theme.space.sm,
    gap: theme.space.sm,
  },
});
