import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useHomeStore } from '../../store';
import { AppHeader, AppText, Button, Screen } from '../../../../shared/ui';
import styles from './styles';

export default function HomeScreen() {
  const navigation = useNavigation();
  const counter = useHomeStore((state) => state.counter);
  const increaseCounter = useHomeStore((state) => state.increaseCounter);

  return (
    <Screen testID="home-screen" withHeader withTabBar>
      <AppHeader
        variant="home"
        greeting="Hola, María"
        onMenuLongPress={__DEV__ ? () => navigation.navigate('Components') : undefined}
      />
      <View style={styles.inset}>
        <AppText variant="body">Contador - {counter}</AppText>
        <Button title="Aumentar" onPress={increaseCounter} />
      </View>
    </Screen>
  );
}
