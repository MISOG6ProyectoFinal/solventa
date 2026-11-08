import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StaticScreenProps, useFocusEffect, useNavigation } from '@react-navigation/native';

import { AppText, Button, Card, Screen } from '../../../../shared/ui';
import { listPolicies } from '../../api/listPolicies';
import { PolicyCard } from '../../components/PolicyCard';
import { useTexts } from '../../texts';
import { Policy } from '../../types';
import { daysUntil, policyDate } from '../../utils';
import styles from './styles';

type Props = StaticScreenProps<{
  policy: Policy;
  productName?: string;
}>;

export default function PolicyDetailScreen({ route }: Readonly<Props>) {
  const { productName } = route.params;
  const texts = useTexts();
  const navigation = useNavigation();
  const [policy, setPolicy] = useState(route.params.policy);

  useEffect(() => {
    setPolicy(route.params.policy);
  }, [route.params.policy]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listPolicies()
        .then((items) => {
          if (cancelled) {
            return;
          }
          const fresh = items.find((item) => item.id === route.params.policy.id);
          if (fresh) {
            setPolicy(fresh);
          }
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [route.params.policy.id]),
  );

  return (
    <Screen testID="policy-detail-screen" header={{ title: texts.policies.detailTitle }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <PolicyCard policy={policy} productName={productName} />
        {policy.renovacion ? (
          <Card>
            <AppText testID="policy-renewed-start" variant="bodySmall">
              {texts.renewal.newStart(policyDate(policy.renovacion.vigencia_nueva.desde))}
            </AppText>
            <AppText testID="policy-renewed-end" variant="bodySmall">
              {texts.renewal.newEnd(policyDate(policy.renovacion.vigencia_nueva.hasta))}
            </AppText>
          </Card>
        ) : null}
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
      <View style={styles.footer}>
        <Button
          testID="policy-go-home"
          title={texts.policies.goHome}
          variant="secondary"
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
        />
      </View>
    </Screen>
  );
}
