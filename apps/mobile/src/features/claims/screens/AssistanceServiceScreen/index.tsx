import { useState } from 'react';
import { View } from 'react-native';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';

import { useLocation } from '../../../../shared/useLocation';
import { AppText, Button, Card, IconButton, OptionList } from '../../../../shared/ui';
import { type AssistanceService } from '../../api/getAssistance';
import { type Aviso } from '../../api/listAvisos';
import { texts } from '../../texts';
import { AssistanceLayout } from '../../components/AssistanceLayout';
import styles from './styles';

type Props = StaticScreenProps<{ aviso: Aviso }>;

const options = (Object.keys(texts.assistance.services) as AssistanceService[]).map((id) => ({
  id,
  label: texts.assistance.services[id],
}));

export default function AssistanceServiceScreen({ route }: Readonly<Props>) {
  const navigation = useNavigation();
  const aviso = route.params.aviso;
  const [service, setService] = useState<AssistanceService>('grua');
  const { location, failed, refresh } = useLocation();

  const next = () => {
    if (!location) {
      return;
    }
    navigation.navigate('AssistanceConfirm', {
      aviso,
      service,
      place: location,
    });
  };

  return (
    <AssistanceLayout testID="assistance-service-screen" policyId={aviso.poliza_id}>
      <Card>
        <OptionList options={options} value={service} onChange={(id) => setService(id as AssistanceService)} />
      </Card>
      <Card>
        <View style={styles.locationHeader}>
          <AppText variant="caption" style={styles.locationLabel}>
            {texts.assistance.currentLocation}
          </AppText>
          {failed ? (
            <IconButton label={texts.report.refreshLocation} icon="sincronizar" color="primary" onPress={refresh} />
          ) : null}
        </View>
        <AppText variant="bodySmall" style={styles.address}>
          {location?.address ?? (failed ? texts.report.locationUnavailable : texts.report.locationPending)}
        </AppText>
        {location ? (
          <AppText variant="caption" style={styles.gps}>
            {location.gps}
          </AppText>
        ) : null}
      </Card>
      <Button title={texts.assistance.continueButton} disabled={!location} onPress={next} />
    </AssistanceLayout>
  );
}
