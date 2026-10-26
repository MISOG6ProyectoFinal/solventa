import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { theme } from '../../../../shared/theme';
import { AppText, Banner, Card, Screen } from '../../../../shared/ui';
import { getProducts } from '../../../quote/api/getProducts';
import { ProductoMovil } from '../../../quote/types';
import { listPolicies } from '../../api/listPolicies';
import { PolicyCard } from '../../components/PolicyCard';
import { useTexts } from '../../texts';
import { Policy } from '../../types';
import styles from './styles';

export default function PoliciesScreen() {
  const texts = useTexts();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback((mode: 'replace' | 'refresh') => {
    const id = requestId.current + 1;
    requestId.current = id;
    if (mode === 'replace') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    Promise.all([listPolicies(), getProducts().catch(() => [] as ProductoMovil[])])
      .then(([items, products]) => {
        if (requestId.current !== id) {
          return;
        }
        setPolicies(items.filter((policy) => policy.estado === 'activa'));
        setProductNames(Object.fromEntries(products.map((product) => [product.id, product.nombre])));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (requestId.current !== id) {
          return;
        }
        if (mode === 'replace') {
          setPolicies([]);
        }
        setError(errorMessage(cause, texts.policies.loadFailed));
      })
      .finally(() => {
        if (requestId.current !== id) {
          return;
        }
        setLoading(false);
        setRefreshing(false);
      });
  }, [texts]);

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
      testID="policies-screen"
      withTabBar
      header={{ title: texts.policies.screenTitle, hideBackButton: true }}
    >
      {loading ? (
        <ActivityIndicator testID="policies-loading" style={styles.loading} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              testID="policies-refresh"
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={theme.colors.teal}
              colors={[theme.colors.teal]}
            />
          }
        >
          {error ? <Banner variant="error">{error}</Banner> : null}
          {policies.length === 0 && error === null ? (
            <Card style={styles.empty}>
              <AppText variant="bodySmall" style={styles.emptyMessage}>
                {texts.policies.emptyMessage}
              </AppText>
            </Card>
          ) : (
            policies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} productName={productNames[policy.producto_id]} />
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
