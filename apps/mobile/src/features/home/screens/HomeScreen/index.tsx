import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppText, Button, Card, Screen, StatusChip } from '../../../../shared/ui';
import { homeSummary, type HomeDestination } from '../../homeSummary';
import { texts } from '../../texts';
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
        title: texts.home.greeting,
        subtitle: texts.home.screenSubtitle,
        leadingIcon: {
          icon: 'menu',
          label: texts.home.menuLabel,
          onLongPress: __DEV__ ? () => navigation.navigate('Components') : undefined,
        },
      }}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card variant="inverse">
          <View style={styles.coverageCopy}>
            <AppText variant="label" style={styles.coverageLabel}>
              {texts.home.coverageLabel}
            </AppText>
            <AppText variant="sectionTitle" style={styles.onNavy}>
              {homeSummary.policyCount} {texts.home.policyCountSuffix}
            </AppText>
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
        <Card>
          <StatusChip variant="pending">{texts.home.renewalBadge}</StatusChip>
          <AppText variant="subtitle">{renewal.productName}</AppText>
          <AppText variant="bodySmall">
            {renewal.policyNumber} · {texts.home.expiresLabel} {renewal.validUntil}
          </AppText>
          <Button title={texts.home.renewalButton} variant="secondary" />
        </Card>
      </ScrollView>
    </Screen>
  );
}
