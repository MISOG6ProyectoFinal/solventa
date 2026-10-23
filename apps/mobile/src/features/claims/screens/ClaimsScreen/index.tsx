import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { theme } from '../../../../shared/theme';
import { Banner, EmptyState, ErrorState, LoadingState, Screen } from '../../../../shared/ui';
import { listAvisos, type Aviso } from '../../api/listAvisos';
import { listReports, type StoredReport } from '../../offline/listReports';
import { getTexts, useTexts } from '../../texts';
import { ClaimRow, claimKey, type ClaimItem } from './ClaimRow';
import styles from './styles';

export default function ClaimsScreen() {
  const texts = useTexts();
  const navigation = useNavigation();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [pending, setPending] = useState<StoredReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const report = () => navigation.navigate('ClaimReport');

  const load = useCallback((mode: 'replace' | 'refresh') => {
    const id = requestId.current + 1;
    requestId.current = id;
    if (mode === 'replace') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const saved = listReports().catch(() => [] as StoredReport[]);

    listAvisos()
      .then((items) => {
        if (requestId.current !== id) {
          return;
        }
        setAvisos(items);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (requestId.current !== id) {
          return;
        }
        if (mode === 'replace') {
          setAvisos([]);
        }
        setError(errorMessage(cause, getTexts().claims.loadFailed));
      })
      .finally(() => {
        saved.then((reports) => {
          if (requestId.current !== id) {
            return;
          }
          setPending(reports);
          setLoading(false);
          setRefreshing(false);
        });
      });
  }, []);

  const items = useMemo<ClaimItem[]>(
    () => [
      ...pending.map((saved): ClaimItem => ({ kind: 'pending', report: saved })),
      ...avisos.map((aviso): ClaimItem => ({ kind: 'filed', aviso })),
    ],
    [pending, avisos],
  );

  const openClaim = useCallback(
    (item: ClaimItem) => {
      if (item.kind === 'pending') {
        navigation.navigate('ClaimReport');
      } else {
        navigation.navigate('AvisoDetail', { aviso: item.aviso });
      }
    },
    [navigation],
  );

  const renderClaim = useCallback(
    ({ item }: { item: ClaimItem }) => <ClaimRow item={item} onOpen={openClaim} />,
    [openClaim],
  );

  useFocusEffect(
    useCallback(() => {
      load('replace');
      return () => {
        requestId.current += 1;
      };
    }, [load]),
  );

  return (
    <Screen
      testID="claims-screen"
      withTabBar
      header={{
        title: texts.claims.screenTitle,
        hideBackButton: true,
        action: avisos.length > 0 || pending.length > 0 ? { title: texts.claims.reportShort, onPress: report } : undefined,
      }}
    >
      {loading ? (
        <LoadingState testID="claims-loading" label={texts.claims.loading} />
      ) : (
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.content}
          data={items}
          keyExtractor={claimKey}
          renderItem={renderClaim}
          refreshControl={
            <RefreshControl
              testID="claims-refresh"
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={theme.colors.teal}
              colors={[theme.colors.teal]}
            />
          }
          ListHeaderComponent={
            error || pending.length > 0 ? (
              <View style={styles.banners}>
                {error ? (
                  <ErrorState
                    message={error}
                    retry={{ label: texts.claims.retryButton, onPress: () => load('replace') }}
                  />
                ) : null}
                {pending.length > 0 ? <Banner variant="info">{texts.claims.savedOnDevice}</Banner> : null}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            error === null ? (
              <EmptyState
                message={texts.claims.emptyMessage}
                action={{ label: texts.claims.reportButton, onPress: report }}
              />
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}
