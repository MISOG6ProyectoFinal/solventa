import { useState } from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useHomeStore } from '../../store';
import {
  AppText,
  Banner,
  Button,
  Card,
  Indicator,
  Screen,
  Stat,
  StatusChip,
  Switch,
} from '../../../../shared/ui';
import styles from './styles';

const HomeScreen: React.FunctionComponent = () => {
  const navigation = useNavigation();
  const counter = useHomeStore((state) => state.counter);
  const increaseCounter = useHomeStore((state) => state.increaseCounter);
  const [notices, setNotices] = useState(false);

  return (
    <Screen testID="home-screen">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.inset}>
        <Card testID="home-surface">
          <Stat
            testID="home-stat"
            variant="inverse"
            label="Pólizas activas"
            value="3"
            detail="Vida hipotecario"
          />
          <Stat label="Próxima prima" value="$ 154.167" detail="Vence el 15 oct 2026" />
          <AppText variant="body">Contador - {counter}</AppText>
          <Banner testID="home-banner" variant="success" icon="exito">
            Tu póliza fue emitida y tu seguro ya está activo
          </Banner>
          <View style={styles.chips}>
            <StatusChip testID="home-chip" variant="tag">
              En línea
            </StatusChip>
            <StatusChip testID="home-chip-active" variant="active">
              Activa
            </StatusChip>
            <StatusChip testID="home-chip-paid" variant="paid">
              Pagado
            </StatusChip>
            <StatusChip testID="home-chip-pending" variant="pending">
              Pendiente
            </StatusChip>
          </View>
          <Button testID="home-primary" title="Aumentar" onPress={increaseCounter} />
          <Button title="Calcular cotización" icon="cotizacion" />
          <Button title="Tomar foto" icon="camara" variant="outlined" />
          <Button testID="home-secondary" title="Continuar" variant="secondary" />
          <Button
            testID="home-accent"
            title="Ver detalle"
            variant="accent"
            onPress={() => navigation.navigate('Details')}
          />
          <Button
            testID="home-outlined"
            title="Ver campos"
            variant="outlined"
            onPress={() => navigation.navigate('Fields')}
          />
          <Button
            title="Ver filas"
            variant="primaryOutline"
            onPress={() => navigation.navigate('Rows')}
          />
          <Button title="Omitir" variant="text" />
          <Button title="Ayuda" variant="accentLink" />
          <Button testID="home-disabled" title="No disponible" disabled />
          <View style={styles.switchRow}>
            <AppText variant="bodySmall">Avisos</AppText>
            <Switch testID="home-switch" value={notices} onValueChange={setNotices} />
          </View>
          <Indicator tone="primary">Principal</Indicator>
          <Indicator tone="secondary">Secundaria</Indicator>
          <Indicator tone="accent">Acento</Indicator>
        </Card>
      </ScrollView>
    </Screen>
  );
};

export default HomeScreen;
