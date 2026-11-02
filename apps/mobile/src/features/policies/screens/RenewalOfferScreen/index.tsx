import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StaticScreenProps } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { AppText, Banner, Card, CoverageList, ErrorState, LoadingState, Screen } from '../../../../shared/ui';
import { formatMoney } from '../../../quote/utils';
import { getRenewalOffer } from '../../api/getRenewalOffer';
import { getTexts, useTexts } from '../../texts';
import { RenewalOffer } from '../../types';
import { policyDate } from '../../utils';
import styles from './styles';

type Props = StaticScreenProps<{
  policyId: string;
  productName?: string;
}>;

export default function RenewalOfferScreen({ route }: Readonly<Props>) {
  const { policyId, productName } = route.params;
  const texts = useTexts();
  const [offer, setOffer] = useState<RenewalOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getRenewalOffer(policyId)
      .then((value) => {
        if (!cancelled) {
          setOffer(value);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setOffer(null);
          setError(errorMessage(cause, getTexts().renewal.loadFailed));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [policyId, attempt]);

  return (
    <Screen testID="renewal-offer-screen" header={{ title: texts.renewal.screenTitle }}>
      {loading ? (
        <LoadingState testID="renewal-offer-loading" label={texts.renewal.loading} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {error || offer === null ? (
            <ErrorState
              message={error ?? texts.renewal.loadFailed}
              retry={{ label: texts.renewal.retryButton, onPress: () => setAttempt((count) => count + 1) }}
            />
          ) : (
            <OfferBody offer={offer} productName={productName} />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function OfferBody({ offer, productName }: Readonly<{ offer: RenewalOffer; productName?: string }>) {
  const texts = useTexts();
  const inicio = policyDate(offer.vigencia_propuesta.desde);
  const fin = policyDate(offer.vigencia_propuesta.hasta);

  return (
    <>
      <Banner testID="renewal-readonly-message" variant="info" icon="info">
        {texts.renewal.disclaimer}
      </Banner>
      <Card>
        <AppText variant="body" style={styles.title}>
          {productName ?? offer.producto_id}
        </AppText>
        <View style={styles.compare}>
          <View style={styles.column}>
            <AppText variant="caption">{texts.renewal.currentPremium}</AppText>
            <AppText testID="renewal-current-premium" variant="subtitle">
              {formatMoney(offer.prima_actual)}
            </AppText>
          </View>
          <View style={styles.column}>
            <AppText variant="caption">{texts.renewal.newPremium}</AppText>
            <AppText testID="renewal-proposed-premium" variant="subtitle" style={styles.proposed}>
              {formatMoney(offer.prima_propuesta)}
            </AppText>
          </View>
        </View>
        <AppText variant="bodySmall">
          {`${texts.renewal.newValidityPrefix} `}
          <AppText testID="renewal-start" variant="bodySmall">
            {inicio}
          </AppText>
          {' - '}
          <AppText testID="renewal-end" variant="bodySmall">
            {fin}
          </AppText>
        </AppText>
        <View testID="renewal-coverages">
          <CoverageList items={offer.coberturas_propuestas.map((cobertura) => cobertura.nombre)} />
        </View>
      </Card>
    </>
  );
}
