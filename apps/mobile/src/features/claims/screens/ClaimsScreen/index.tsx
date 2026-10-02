import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppHeader, AppText, Button, Card, Screen } from '../../../../shared/ui';
import { claimsSummary } from '../../claimsSummary';
import styles from './styles';

export default function ClaimsScreen() {
  const navigation = useNavigation();

  return (
    <Screen testID="claims-screen" withHeader withTabBar>
      <AppHeader
        variant="flow"
        title={claimsSummary.title}
        onBackPress={() => navigation.navigate('Main', { screen: 'Home' })}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card style={styles.empty}>
          <AppText variant="bodySmall" style={styles.emptyMessage}>
            {claimsSummary.emptyMessage}
          </AppText>
          <Button
            title={claimsSummary.reportAction}
            onPress={() => navigation.navigate('ClaimReport')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
