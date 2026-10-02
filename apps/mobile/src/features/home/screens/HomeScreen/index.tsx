import { StatusBar, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useHomeStore } from '../../store';
import { AppText, Button, Screen } from '../../../../shared/ui';
import styles from './styles';

export default function HomeScreen() {
  const navigation = useNavigation();
  const counter = useHomeStore((state) => state.counter);
  const increaseCounter = useHomeStore((state) => state.increaseCounter);

  return (
    <Screen testID="home-screen">
      <StatusBar barStyle="dark-content" />
      <View style={styles.inset}>
        <AppText variant="body">Contador - {counter}</AppText>
        <Button title="Aumentar" onPress={increaseCounter} />
        <Button title="Componentes" variant="outlined" onPress={() => navigation.navigate('Components')} />
      </View>
    </Screen>
  );
}
