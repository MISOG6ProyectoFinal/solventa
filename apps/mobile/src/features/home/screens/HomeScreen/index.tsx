import { StatusBar, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useHomeStore } from '../../store';
import { AppText, Banner, Button, Card, Screen, StatusChip } from '../../../../shared/ui';
import styles from './styles';

const HomeScreen: React.FunctionComponent = () => {
  const navigation = useNavigation();
  const counter = useHomeStore((state) => state.counter);
  const increaseCounter = useHomeStore((state) => state.increaseCounter);

  return (
    <Screen testID="home-screen">
      <StatusBar barStyle="dark-content" />
      <View style={styles.inset}>
        <Card testID="home-surface">
          <AppText variant="body">Contador - {counter}</AppText>
          <Banner testID="home-banner" variant="success">
            Tu póliza fue emitida y tu seguro ya está activo
          </Banner>
          <StatusChip testID="home-chip" variant="online">
            En línea
          </StatusChip>
          <Button testID="home-primary" title="Aumentar" onPress={increaseCounter} />
          <Button
            testID="home-confirm"
            title="Ver detalle"
            variant="confirm"
            onPress={() => navigation.navigate('Details')}
          />
          <Button
            title="Ver campos"
            variant="secondary"
            onPress={() => navigation.navigate('Fields')}
          />
          <Button
            title="Ver filas"
            variant="secondary"
            onPress={() => navigation.navigate('Rows')}
          />
        </Card>
      </View>
    </Screen>
  );
};

export default HomeScreen;
