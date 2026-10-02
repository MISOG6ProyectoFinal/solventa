import { useState } from 'react';
import { ScrollView } from 'react-native';

import {
  Amount,
  Card,
  CoverageList,
  KeyValue,
  OptionList,
  Screen,
  Thumbnail,
} from '../../../../shared/ui';
import styles from './styles';

const coverages = [
  'Gastos médicos',
  'Cancelación de viaje',
  'Pérdida de equipaje',
  'Asistencia en viaje',
];

const services = [
  { id: 'grua', label: 'Grúa' },
  { id: 'ambulancia', label: 'Ambulancia' },
  { id: 'perito', label: 'Perito' },
];

const RowsScreen = () => {
  const [service, setService] = useState('perito');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.inset}>
        <Card>
          <Amount value="$ 149.940" />
          <KeyValue label="Prima actual" value="$ 420.000" />
          <KeyValue label="Nueva prima" value="$ 453.600" />
          <CoverageList items={coverages} />
          <OptionList options={services} value={service} onChange={setService} />
          <Thumbnail name="Foto 1" size="1,6 MB" testID="rows-thumbnail" />
        </Card>
      </ScrollView>
    </Screen>
  );
};

export default RowsScreen;
