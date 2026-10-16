import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { theme } from '../../../../shared/theme';
import { AppText, Banner, Button, Card, Screen, StatusChip } from '../../../../shared/ui';
import { listAvisos, type Aviso } from '../../api/listAvisos';
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
        if (requestId.current !== id) {
          return;
        }
        setLoading(false);
        setRefreshing(false);
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
        action: avisos.length > 0 ? { title: texts.claims.reportShort, onPress: report } : undefined,
      }}
    >
      {loading ? (
        <ActivityIndicator testID="claims-loading" style={styles.loading} />
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
          {error ? <Banner variant="error">{error}</Banner> : null}
          {avisos.length === 0 && error === null ? (
            <Card style={styles.empty}>
              <AppText variant="bodySmall" style={styles.emptyMessage}>
                {texts.claims.emptyMessage}
              </AppText>
              <Button title={texts.claims.reportButton} onPress={report} />
            </Card>
          ) : (
            avisos.map((aviso) => {
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
            })
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
