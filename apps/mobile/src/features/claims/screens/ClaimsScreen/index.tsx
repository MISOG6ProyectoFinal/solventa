import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppText, Button, Card, Screen } from '../../../../shared/ui';
import { texts } from '../../texts';
import styles from './styles';

export default function ClaimsScreen() {
  const navigation = useNavigation();

  return (
    <Screen
      testID="claims-screen"
      withTabBar
      header={{ title: texts.claims.screenTitle, hideBackButton: true }}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card style={styles.empty}>
          <AppText variant="bodySmall" style={styles.emptyMessage}>
            {texts.claims.emptyMessage}
          </AppText>
          <Button
            title={texts.claims.reportButton}
            onPress={() => navigation.navigate('ClaimReport')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
