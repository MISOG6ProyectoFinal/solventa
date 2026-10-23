import { useState } from 'react';
import { StackActions, StaticScreenProps, useNavigation } from '@react-navigation/native';

import { ApiError, errorMessage } from '../../../../shared/api/client';
import { type Place } from '../../../../shared/location';
import { AppText, Button, Card, KeyValue } from '../../../../shared/ui';
import { type AssistanceService, type Asistencia, getAssistance } from '../../api/getAssistance';
import { type Aviso } from '../../api/listAvisos';
import { requestAssistance } from '../../api/requestAssistance';
import { useTexts } from '../../texts';
import { AssistanceLayout } from '../../components/AssistanceLayout';
import detailStyles from '../../components/detailStyles';

type Props = StaticScreenProps<{
  aviso: Aviso;
  service: AssistanceService;
  place: Place;
}>;

export default function AssistanceConfirmScreen({ route }: Readonly<Props>) {
  const texts = useTexts();
  const navigation = useNavigation();
  const { aviso, service, place } = route.params;
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (asistencia: Asistencia) =>
    navigation.dispatch(StackActions.popTo('AvisoDetail', { aviso, asistencia }));

  const existingRequest = async (): Promise<Asistencia | null> => {
    try {
      return await getAssistance(aviso.id);
    } catch {
      return null;
    }
  };

  const confirm = async () => {
    if (requesting) {
      return;
    }
    setRequesting(true);
    setError(null);
    try {
      finish(await requestAssistance(aviso.id, service, place));
    } catch (cause) {
      const existing = cause instanceof ApiError && cause.status === 409 ? await existingRequest() : null;
      if (existing) {
        finish(existing);
        return;
      }
      setError(errorMessage(cause, texts.assistance.requestFailed));
      setRequesting(false);
    }
  };

  return (
    <AssistanceLayout testID="assistance-confirm-screen" policyId={aviso.poliza_id} error={error}>
      <Card>
        <AppText variant="button" style={detailStyles.title}>
          {texts.assistance.confirmTitle}
        </AppText>
        <KeyValue inline label={texts.assistance.serviceLabel} value={texts.assistance.services[service]} />
        <KeyValue inline label={texts.assistance.locationLabel} value={place.address} />
        <KeyValue inline label={texts.assistance.claimLabel} value={aviso.radicado ?? aviso.id} />
      </Card>
      <Button
        title={requesting ? texts.assistance.requesting : texts.assistance.confirmButton}
        variant="accent"
        disabled={requesting}
        onPress={confirm}
      />
    </AssistanceLayout>
  );
}
