import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { type StaticScreenProps } from '@react-navigation/native';

import { useLocation } from '../../../../shared/useLocation';
import {
  AppText,
  Banner,
  Button,
  ChipSelector,
  IconButton,
  PinMap,
  Screen,
  Sheet,
  type SheetHandle,
} from '../../../../shared/ui';
import { listNearbyProviders } from '../../api/listNearbyProviders';
import { Legend } from '../../components/Legend';
import { categories } from '../../categories';
import { formatDecimal } from '../../formatDecimal';
import { texts } from '../../texts';
import { type NearbyProvider, type ProviderFilter, type ProviderType } from '../../types';
import styles from './styles';

type Status = 'loading' | 'ready' | 'error';

// The request flow opens the map already filtered to the service being requested.
type Props = StaticScreenProps<{ filter?: ProviderType } | undefined>;

const filterOptions = (Object.keys(texts.providers.filters) as ProviderFilter[]).map((id) => ({
  id,
  label: texts.providers.filters[id],
}));

export default function NearbyProvidersScreen({ route }: Readonly<Props>) {
  const { location, failed, refresh } = useLocation();
  const [filter, setFilter] = useState<ProviderFilter>(route.params?.filter ?? 'all');
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheet = useRef<SheetHandle>(null);
  const request = useRef(0);

  const load = useCallback(() => {
    if (!location) {
      return;
    }
    const current = ++request.current;
    setStatus('loading');
    listNearbyProviders(location, filter === 'all' ? undefined : filter)
      .then((items) => {
        if (request.current === current) {
          setProviders(items);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (request.current === current) {
          setStatus('error');
        }
      });
  }, [location, filter]);

  // A newer request, or leaving the screen, makes the previous answer irrelevant.
  useEffect(() => {
    const counter = request;
    load();
    return () => {
      counter.current++;
    };
  }, [load]);

  const changeFilter = useCallback((id: string) => {
    sheet.current?.dismiss();
    setSelectedId(null);
    setFilter(id as ProviderFilter);
  }, []);

  const selectPin = useCallback((id: string) => {
    setSelectedId(id);
    sheet.current?.present();
  }, []);

  const dismissSummary = useCallback(() => sheet.current?.dismiss(), []);
  const clearSelection = useCallback(() => setSelectedId(null), []);

  // The map only redraws the pins that changed when these keep their identity between renders.
  const pins = useMemo(
    () =>
      providers.map((provider) => ({
        id: provider.id,
        latitude: provider.latitude,
        longitude: provider.longitude,
        color: categories[provider.type].color,
        icon: categories[provider.type].icon,
        label: provider.name,
      })),
    [providers],
  );
  const selected = useMemo(() => providers.find((provider) => provider.id === selectedId), [providers, selectedId]);
  const emptyScope = filter === 'all' ? texts.providers.emptyScope : texts.providers.filters[filter].toLowerCase();

  return (
    <Screen
      testID="nearby-providers-screen"
      header={{
        title: texts.providers.screenTitle,
        action: { title: texts.providers.refreshButton, onPress: refresh },
      }}
    >
      <View style={styles.content}>
        {location ? (
          <>
            <ChipSelector options={filterOptions} value={filter} onChange={changeFilter} />
            <Legend />
            {status === 'error' ? (
              <>
                <Banner variant="error">{texts.providers.loadFailed}</Banner>
                <Button title={texts.providers.retryButton} variant="outlined" onPress={load} />
              </>
            ) : null}
            <View style={styles.mapArea}>
              <PinMap
                center={location}
                pins={pins}
                selectedId={selectedId}
                onPinPress={selectPin}
                onMapPress={dismissSummary}
              />
              {status === 'loading' ? (
                <View style={styles.overlay}>
                  <AppText variant="bodySmall">{texts.providers.loading}</AppText>
                </View>
              ) : null}
              {status === 'ready' && providers.length === 0 ? (
                <View style={styles.overlay}>
                  <AppText variant="bodySmall">{texts.providers.empty(emptyScope)}</AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption">{texts.providers.attribution}</AppText>
          </>
        ) : null}
        {!location && !failed ? (
          <AppText variant="bodySmall" style={styles.pending}>
            {texts.providers.locationPending}
          </AppText>
        ) : null}
        {!location && failed ? (
          <View style={styles.locationRow}>
            <AppText variant="bodySmall">{texts.providers.locationUnavailable}</AppText>
            <IconButton label={texts.providers.refreshLocation} icon="sincronizar" color="primary" onPress={refresh} />
          </View>
        ) : null}
      </View>
      <Sheet ref={sheet} testID="provider-summary" onClose={clearSelection}>
        {selected ? (
          <View style={styles.summary}>
            <AppText variant="subtitle" style={styles.summaryName}>
              {selected.name}
            </AppText>
            <AppText variant="bodySmall">{texts.providers.categories[selected.type]}</AppText>
            <AppText variant="body">{texts.providers.distance(formatDecimal(selected.distanceKm))}</AppText>
            <AppText variant="body">{texts.providers.eta(selected.etaMin)}</AppText>
            <AppText variant="body">
              {selected.rating === null
                ? texts.providers.noRating
                : texts.providers.rating(formatDecimal(selected.rating))}
            </AppText>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
