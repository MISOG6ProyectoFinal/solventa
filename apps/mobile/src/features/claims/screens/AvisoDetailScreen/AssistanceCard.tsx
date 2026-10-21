import { AppText, Card, StatusChip } from '../../../../shared/ui';
import { type Asistencia } from '../../api/getAssistance';
import { texts } from '../../texts';
import detailStyles from '../../components/detailStyles';

export function AssistanceCard({ asistencia }: Readonly<{ asistencia: Asistencia; }>) {
  return (
    <Card>
      <StatusChip variant="info">{texts.assistance.statusRequested}</StatusChip>
      <AppText variant="button" style={detailStyles.title}>
        {texts.assistance.services[asistencia.servicio]}
      </AppText>
      <AppText variant="bodySmall">{texts.assistance.requestId(asistencia.numero)}</AppText>
      <AppText variant="bodySmall">{texts.assistance.eta(asistencia.eta_min, asistencia.eta_max)}</AppText>
    </Card>
  );
}
