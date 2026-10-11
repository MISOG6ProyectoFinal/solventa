import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppText, Button, Card, CoverageList, Screen, StatusChip } from '../../../../shared/ui';
import { useQuoteStore } from '../../store/useQuoteStore';
import { texts } from '../../texts';
import { formatMoney, fromApiDate, quoteReference } from '../../utils';
import styles from './styles';

function remainOnQuoteResult() {
  return undefined;
}

export default function QuoteResultScreen() {
  const navigation = useNavigation();
  const product = useQuoteStore((state) => state.product);
  const oferta = useQuoteStore((state) => state.oferta);

  useEffect(() => {
    if (!product || !oferta) {
      navigation.goBack();
    }
  }, [navigation, oferta, product]);

  if (!product || !oferta) {
    return null;
  }

  return (
    <Screen testID="quote-result-screen" header={{ title: texts.result.screenTitle }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card>
          <StatusChip variant="info">{texts.result.validBadge}</StatusChip>
          <AppText variant="body" style={styles.title}>
            {product.nombre}
          </AppText>
          <AppText variant="bodySmall">{texts.result.reference(quoteReference(oferta.id))}</AppText>
          <AppText variant="sectionTitle" style={styles.premium}>
            {formatMoney(oferta.prima)}
          </AppText>
          <AppText variant="caption" style={styles.taxes}>
            {texts.result.taxesIncluded}
          </AppText>
          <AppText variant="bodySmall">
            {texts.result.validity(
              fromApiDate(oferta.vigencia_propuesta.desde),
              fromApiDate(oferta.vigencia_propuesta.hasta),
            )}
          </AppText>
          <CoverageList items={oferta.coberturas.map((cobertura) => cobertura.nombre)} />
        </Card>
        <Button
          testID="quote-continue-pay"
          title={texts.result.continueButton}
          variant="accent"
          onPress={remainOnQuoteResult}
        />
      </ScrollView>
    </Screen>
  );
}
