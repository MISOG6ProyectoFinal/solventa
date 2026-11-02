import { ScrollView } from 'react-native';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';

import { AppText, Button, Card, Screen } from '../../../../shared/ui';
import { PolicyCard } from '../../components/PolicyCard';
import { useTexts } from '../../texts';
import { Policy } from '../../types';
import { daysUntil } from '../../utils';
import styles from './styles';

type Props = StaticScreenProps<{
  policy: Policy;
  productName?: string;
}>;

export default function PolicyDetailScreen({ route }: Readonly<Props>) {
  const { policy, productName } = route.params;
  const texts = useTexts();
  const navigation = useNavigation();

  return (
    <Screen testID="policy-detail-screen" header={{ title: texts.policies.detailTitle }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <PolicyCard policy={policy} productName={productName} />
        {policy.renovable ? (
          <Card>
            <AppText variant="subtitle">{texts.policies.renewalOfferTitle}</AppText>
            <AppText variant="bodySmall">{texts.policies.renewalOfferBody(daysUntil(policy.vigencia.hasta))}</AppText>
            <Button
              testID="policy-renewal-offer-button"
              title={texts.policies.seeRenewalOffer}
              variant="secondary"
              onPress={() => navigation.navigate('RenewalOffer', { policyId: policy.id, productName })}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
