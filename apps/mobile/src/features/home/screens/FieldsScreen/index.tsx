import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  CheckboxField,
  DateField,
  Screen,
  SelectField,
  TextField,
} from '../../../../shared/ui';
import styles from './styles';

const FieldsScreen = () => {
  const [name, setName] = useState('');
  const [checked, setChecked] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <Screen>
      <View style={styles.inset}>
        <Card>
          <TextField
            label="Nombre completo"
            required
            value={name}
            onChangeText={setName}
            error={submitted && name.trim() === ''}
            testID="fields-name"
          />
          <SelectField label="Destino" required value="España" testID="fields-select" />
          <DateField
            label="Fecha de salida"
            required
            value="10/10/2026"
            testID="fields-date"
          />
          <CheckboxField
            label="Simular pago rechazado"
            checked={checked}
            onPress={() => setChecked((current) => !current)}
            testID="fields-checkbox"
          />
          <Button testID="fields-submit" title="Enviar" onPress={() => setSubmitted(true)} />
        </Card>
      </View>
    </Screen>
  );
};

export default FieldsScreen;
