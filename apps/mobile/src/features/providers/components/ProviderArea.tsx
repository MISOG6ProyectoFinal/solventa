import { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../../../shared/theme';
import { AppText, PinMap } from '../../../shared/ui';
import { useTexts } from '../texts';
import { type NearbyProvider } from '../types';
import { ProviderList } from './ProviderList';

type ProviderAreaProps = {
  view: 'map' | 'list';
  status: 'loading' | 'ready' | 'error';
  center: { latitude: number; longitude: number };
  providers: NearbyProvider[];
  pins: ComponentProps<typeof PinMap>['pins'];
  selectedId: string | null;
  emptyScope: string;
  onPinPress: (id: string) => void;
  onMapPress: () => void;
};

type Status = ProviderAreaProps['status'];

function overlayMessage(status: Status, count: number, loading: string, empty: string) {
  if (status === 'loading') {
    return loading;
  }
  return status === 'ready' && count === 0 ? empty : null;
}

// The map or the list, with the loading and empty messages over it.
export function ProviderArea({
  view,
  status,
  center,
  providers,
  pins,
  selectedId,
  emptyScope,
  onPinPress,
  onMapPress,
}: Readonly<ProviderAreaProps>) {
  const texts = useTexts();
  const message = overlayMessage(
    status,
    providers.length,
    texts.providers.loading,
    texts.providers.empty(emptyScope),
  );

  return (
    <View style={styles.area}>
      {view === 'map' ? (
        <PinMap center={center} pins={pins} selectedId={selectedId} onPinPress={onPinPress} onMapPress={onMapPress} />
      ) : (
        <ProviderList providers={providers} />
      )}
      {message ? (
        <View style={styles.overlay}>
          <AppText variant="bodySmall">{message}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  overlay: {
    position: 'absolute',
    top: theme.space.sm,
    left: theme.space.sm,
    right: theme.space.sm,
    padding: theme.space.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
});
