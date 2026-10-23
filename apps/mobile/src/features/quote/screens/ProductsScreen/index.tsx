import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { AppText, Card, ErrorState, LoadingState, Screen, StatusChip } from '../../../../shared/ui';
import { getProducts } from '../../api/getProducts';
import { useQuoteStore } from '../../store/useQuoteStore';
import { texts } from '../../texts';
import { ProductoMovil } from '../../types';
import { formatMoney } from '../../utils';
import styles from './styles';

export default function ProductsScreen() {
  const navigation = useNavigation();
  const selectProduct = useQuoteStore((state) => state.selectProduct);
  const [products, setProducts] = useState<ProductoMovil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getProducts()
      .then((items) => {
        if (!cancelled) {
          setProducts(items);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(errorMessage(cause, texts.products.loadFailed));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const openProduct = (product: ProductoMovil) => {
    if (!product.disponible) {
      return;
    }

    selectProduct(product);
    navigation.navigate('Quote');
  };

  return (
    <Screen
      testID="products-screen"
      withTabBar
      header={{
        title: texts.products.screenTitle,
        subtitle: texts.products.screenSubtitle,
        hideBackButton: true,
      }}
    >
      {loading ? (
        <LoadingState testID="products-loading" label={texts.products.loading} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {error ? (
            <ErrorState
              message={error}
              retry={{ label: texts.products.retryButton, onPress: () => setAttempt((count) => count + 1) }}
            />
          ) : null}
          {products.map((product) => (
            <Card
              key={product.id}
              testID={`product-${product.id}`}
              disabled={!product.disponible}
              onPress={product.disponible ? () => openProduct(product) : undefined}
            >
              <AppText variant="body" style={styles.title}>
                {product.nombre}
              </AppText>
              {product.disponible ? null : (
                <StatusChip variant="pending">{texts.products.comingSoon}</StatusChip>
              )}
              <AppText variant="bodySmall">{product.descripcion}</AppText>
              <AppText variant="body" style={styles.price}>
                {texts.products.fromPrice(formatMoney(product.precio_desde))}
              </AppText>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
