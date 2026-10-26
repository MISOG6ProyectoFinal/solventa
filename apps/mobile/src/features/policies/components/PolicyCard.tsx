import { View } from 'react-native';

import { formatMoney } from '../../quote/utils';
import { AppText, Card, CoverageList, StatusChip } from '../../../shared/ui';
import { useTexts } from '../texts';
import { Policy } from '../types';
import { policyDate } from '../utils';
import styles from './styles';

type PolicyCardProps = {
  policy: Policy;
  productName?: string;
  variant?: 'confirmation' | 'list';
  testID?: string;
};

export function PolicyCard({ policy, productName, variant = 'list', testID }: Readonly<PolicyCardProps>) {
  const texts = useTexts();
  const title = productName ?? policy.producto_id;
  const inicio = texts.policies.start(policyDate(policy.vigencia.desde));
  const fin = texts.policies.end(policyDate(policy.vigencia.hasta));
  const prima = policy.prima ? texts.policies.prima(formatMoney(policy.prima)) : null;
  const coberturas = policy.coberturas.map((cobertura) => cobertura.nombre);

  return (
    <Card testID={testID ?? 'policy-card'}>
      {variant === 'list' ? (
        <View style={styles.titleRow}>
          <AppText variant="body" style={[styles.title, styles.titleInRow]}>
            {title}
          </AppText>
          <StatusChip testID="policy-status" variant="success">
            {texts.policies.statusActive}
          </StatusChip>
        </View>
      ) : (
        <AppText variant="body" style={styles.title}>
          {title}
        </AppText>
      )}
      <AppText testID="policy-number" variant="bodySmall">
        {variant === 'confirmation' ? texts.policies.policyNumber(policy.numero) : policy.numero}
      </AppText>
      {variant === 'confirmation' ? (
        <StatusChip testID="policy-status" variant="success">
          {texts.policies.statusActive}
        </StatusChip>
      ) : null}
      <AppText testID="policy-start" variant="bodySmall">
        {inicio}
      </AppText>
      <AppText testID="policy-end" variant="bodySmall">
        {fin}
      </AppText>
      {prima ? (
        <AppText testID="policy-premium" variant="sectionTitle" style={styles.premium}>
          {prima}
        </AppText>
      ) : null}
      <CoverageList items={coberturas} />
    </Card>
  );
}
