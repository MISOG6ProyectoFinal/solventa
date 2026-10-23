import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { theme } from '../../../../shared/theme';
import { AppText, Banner, Card, EmptyState, ErrorState, LoadingState, Screen, StatusChip } from '../../../../shared/ui';
import { listAvisos, type Aviso } from '../../api/listAvisos';
import { listReports, type StoredReport } from '../../offline/listReports';
import { texts } from '../../texts';
import styles from './styles';

function claimStatus(estado: string): { label: string; variant: 'pending' | 'success' } {
  if (estado === 'radicado') {
    return { label: texts.claims.statusFiled, variant: 'success' };
  }
  return { label: texts.claims.statusDraft, variant: 'pending' };
}

export default function ClaimsScreen() {
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
        setError(errorMessage(cause, texts.claims.loadFailed));
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              testID="claims-refresh"
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={theme.colors.teal}
              colors={[theme.colors.teal]}
            />
          }
        >
          {error ? (
            <ErrorState message={error} retry={{ label: texts.claims.retryButton, onPress: () => load('replace') }} />
          ) : null}
          {pending.length > 0 ? <Banner variant="info">{texts.claims.savedOnDevice}</Banner> : null}
          {avisos.length === 0 && pending.length === 0 && error === null ? (
            <EmptyState
              message={texts.claims.emptyMessage}
              action={{ label: texts.claims.reportButton, onPress: report }}
            />
          ) : (
            <>
              {pending.map((saved) => (
                <Card
                  key={`pending-${saved.poliza_id}`}
                  testID="claim-item"
                  onPress={() => navigation.navigate('ClaimReport')}
                >
                  <View style={styles.titleRow}>
                    <AppText variant="button" style={styles.title}>
                      {saved.tipo}
                    </AppText>
                    <StatusChip variant="pending">{texts.claims.statusPendingSync}</StatusChip>
                  </View>
                  <AppText variant="bodySmall">{saved.poliza_id}</AppText>
                </Card>
              ))}
              {avisos.map((aviso) => {
                const status = claimStatus(aviso.estado);

                return (
                  <Card
                    key={aviso.id}
                    testID="claim-item"
                    onPress={() => navigation.navigate('AvisoDetail', { aviso })}
                  >
                    <View style={styles.titleRow}>
                      <AppText variant="button" style={styles.title}>
                        {aviso.tipo}
                      </AppText>
                      <StatusChip variant={status.variant}>{status.label}</StatusChip>
                    </View>
                    <AppText variant="bodySmall">{aviso.poliza_id}</AppText>
                  </Card>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
