import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';

import { AppText, Button, Card, Screen, StatusChip } from '../../../../shared/ui';
import { listPolicies } from '../../../policies/api/listPolicies';
import { POLICY_STATUS, Policy } from '../../../policies/types';
import { policyDate } from '../../../policies/utils';
import { getProducts } from '../../../quote/api/getProducts';
import { ProductoMovil } from '../../../quote/types';
import { useSessionStore } from '../../../session/store/useSessionStore';
import { homeSummary, type HomeShortcutDestination } from '../../homeSummary';
import { useTexts } from '../../texts';
import styles from './styles';

export default function HomeScreen() {
  const texts = useTexts();
  const navigation = useNavigation();
  const firstName = useSessionStore((state) => state.firstName);
  const [renewablePolicy, setRenewablePolicy] = useState<Policy | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [productName, setProductName] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setRenewablePolicy(null);

      Promise.all([listPolicies(), getProducts().catch(() => [] as ProductoMovil[])])
        .then(([policies, products]) => {
          if (cancelled) {
            return;
          }
          const policy = policies.find((item) => item.estado === POLICY_STATUS.active && item.renovable === true) ?? null;
          const names = Object.fromEntries(products.map((product) => [product.id, product.nombre]));
          setActiveCount(policies.filter((item) => item.estado === POLICY_STATUS.active).length);
          setRenewablePolicy(policy);
          setProductName(policy ? names[policy.producto_id] : undefined);
        })
        .catch(() => {
          if (!cancelled) {
            setRenewablePolicy(null);
            setActiveCount(null);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openDestination = (destination: HomeShortcutDestination) => {
    if (destination === 'NearbyProviders') {
      navigation.navigate(destination);
      return;
    }
    navigation.navigate('Main', { screen: destination });
  };

  return (
    <Screen
      testID="home-screen"
      withTabBar
      header={{
        title: firstName ? texts.home.greeting(firstName) : texts.home.greetingWithoutName,
        subtitle: texts.home.screenSubtitle,
        leadingIcon: {
          icon: 'menu',
          label: texts.home.menuLabel,
          onPress: () => navigation.dispatch(DrawerActions.openDrawer()),
          onLongPress: __DEV__ ? () => navigation.navigate('DevTools') : undefined,
        },
      }}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card variant="inverse">
          <View style={styles.coverageCopy}>
            <AppText variant="label" style={styles.coverageLabel}>
              {texts.home.coverageLabel}
            </AppText>
            {activeCount === null ? null : (
              <AppText variant="sectionTitle" style={styles.onNavy}>
                {texts.home.policyCount(activeCount)}
              </AppText>
            )}
          </View>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title={texts.home.policiesButton} variant="secondary" onPress={() => openDestination('Policies')} />
            </View>
            <View style={styles.action}>
              <Button title={texts.home.buyButton} variant="accent" onPress={() => openDestination('Buy')} />
            </View>
          </View>
        </Card>
        <View style={styles.shortcuts}>
          {homeSummary.shortcuts.map((shortcut) => {
            const label = texts.home.shortcuts[shortcut.id];

            return (
              <Card
                key={shortcut.id}
                onPress={() => openDestination(shortcut.destination)}
                style={styles.shortcut}
              >
                <View style={styles.shortcutCopy}>
                  <AppText variant="body" style={styles.shortcutTitle}>
                    {label.title}
                  </AppText>
                  <AppText variant="bodySmall">{label.hint}</AppText>
                </View>
              </Card>
            );
          })}
        </View>
        {renewablePolicy ? (
          <Card>
            <StatusChip variant="pending">{texts.home.renewalBadge}</StatusChip>
            <AppText variant="subtitle">{productName ?? renewablePolicy.producto_id}</AppText>
            <AppText variant="bodySmall">
              {renewablePolicy.numero} · {texts.home.expiresLabel} {policyDate(renewablePolicy.vigencia.hasta)}
            </AppText>
            <Button
              testID="home-renewal-offer"
              title={texts.home.renewalButton}
              variant="secondary"
              onPress={() =>
                navigation.navigate('PolicyDetail', {
                  policy: renewablePolicy,
                  productName,
                })
              }
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
