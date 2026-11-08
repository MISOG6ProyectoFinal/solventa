import { AppText, Banner, Button, Card, CoverageList, StatusChip } from '../../../../shared/ui';
import { useTexts } from '../../texts';
import { RenewalResult } from '../../types';
import { policyDate } from '../../utils';
import styles from './styles';

type Props = {
  confirmation: RenewalResult;
  productName?: string;
  onViewPolicy: () => void;
};

export default function RenewalConfirmation({ confirmation, productName, onViewPolicy }: Readonly<Props>) {
  const texts = useTexts();
  const nombre = productName ?? confirmation.producto_id;

  return (
    <>
      <Banner testID="renewal-confirmed" variant="success">
        {texts.renewal.successAlert}
      </Banner>
      <Card>
        <AppText variant="body" style={styles.title}>
          {nombre}
        </AppText>
        <AppText variant="bodySmall">{confirmation.numero_poliza}</AppText>
        <StatusChip testID="renewal-status" variant="success">
          {texts.policies.statusActive}
        </StatusChip>
        <AppText testID="renewal-new-start" variant="bodySmall">
          {texts.renewal.newStart(policyDate(confirmation.vigencia_nueva.desde))}
        </AppText>
        <AppText testID="renewal-new-end" variant="bodySmall">
          {texts.renewal.newEnd(policyDate(confirmation.vigencia_nueva.hasta))}
        </AppText>
        <CoverageList items={confirmation.coberturas.map((cobertura) => cobertura.nombre)} />
      </Card>
      <Button testID="renewal-view-policy" title={texts.renewal.viewUpdated} onPress={onViewPolicy} />
    </>
  );
}
