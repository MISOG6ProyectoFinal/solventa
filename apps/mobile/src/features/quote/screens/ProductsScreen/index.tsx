import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ApiError } from '../../../../shared/api/client';
import { AppText, Banner, Card, Screen, StatusChip } from '../../../../shared/ui';
import { getProducts } from '../../api/getProducts';
import { useQuoteStore } from '../../store/useQuoteStore';
import { texts } from '../../texts';
import { ProductoMovil } from '../../types';
import { formatMoney } from '../../utils';
import styles from './styles';

function loadErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.detail ?? texts.products.loadFailed;
  }

  return error instanceof Error && error.message !== '' ? error.message : texts.products.loadFailed;
}

export default function ProductsScreen() {
  const navigation = useNavigation();
  const selectProduct = useQuoteStore((state) => state.selectProduct);
  const [products, setProducts] = useState<ProductoMovil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getProducts()
      .then((items) => {
        if (!cancelled) {
          setProducts(items);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(loadErrorMessage(cause));
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
  }, []);

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
        <ActivityIndicator testID="products-loading" style={styles.loading} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {error ? <Banner variant="error">{error}</Banner> : null}
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
