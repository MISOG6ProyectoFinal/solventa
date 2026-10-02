import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppText, Button, Card, Screen, StatusChip } from '../../../../shared/ui';
import { homeSummary, type HomeDestination } from '../../homeSummary';
import styles from './styles';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { renewal } = homeSummary;

  const openDestination = (destination: HomeDestination) => {
    navigation.navigate('Main', { screen: destination });
  };

  return (
    <Screen
      testID="home-screen"
      withTabBar
      header={{
        title: homeSummary.greeting,
        subtitle: 'Tu cobertura',
        leadingIcon: {
          icon: 'menu',
          label: 'Menú',
          onLongPress: __DEV__ ? () => navigation.navigate('Components') : undefined,
        },
      }}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card variant="inverse">
          <View style={styles.coverageCopy}>
            <AppText variant="label" style={styles.coverageLabel}>
              {homeSummary.coverageLabel}
            </AppText>
            <AppText variant="sectionTitle" style={styles.onNavy}>
              {homeSummary.policyCount} pólizas
            </AppText>
          </View>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title="Ver pólizas" variant="secondary" onPress={() => openDestination('Policies')} />
            </View>
            <View style={styles.action}>
              <Button title="Comprar" variant="accent" onPress={() => openDestination('Buy')} />
            </View>
          </View>
        </Card>
        <View style={styles.shortcuts}>
          {homeSummary.shortcuts.map((shortcut) => (
            <Card
              key={shortcut.id}
              onPress={() => openDestination(shortcut.destination)}
              style={styles.shortcut}
            >
              <View style={styles.shortcutCopy}>
                <AppText variant="body" style={styles.shortcutTitle}>
                  {shortcut.title}
                </AppText>
                <AppText variant="bodySmall">{shortcut.hint}</AppText>
              </View>
            </Card>
          ))}
        </View>
        <Card>
          <StatusChip variant="pending">{renewal.badge}</StatusChip>
          <AppText variant="subtitle">{renewal.productName}</AppText>
          <AppText variant="bodySmall">
            {renewal.policyNumber} · Vence {renewal.validUntil}
          </AppText>
          <Button title="Ver oferta de renovación" variant="secondary" />
        </Card>
      </ScrollView>
    </Screen>
  );
}
