import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import { ApiError } from '../../../../shared/api/client';
import { AppText, Banner, Button, Card, CheckboxField, Screen } from '../../../../shared/ui';
import { crearIntentoId, payQuote } from '../../api/payQuote';
import { useQuoteStore } from '../../store/useQuoteStore';
import { texts } from '../../texts';
import { SimulacionPago } from '../../types';
import { formatMoney, formatVigenteHasta, quoteReference } from '../../utils';
import styles from './styles';

type PaymentStatus = 'ready' | 'processing' | 'approved' | 'rejected' | 'expired';

export default function QuotePaymentScreen() {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const product = useQuoteStore((state) => state.product);
  const oferta = useQuoteStore((state) => state.oferta);
  const [status, setStatus] = useState<PaymentStatus>('ready');
  const [simulateRejected, setSimulateRejected] = useState(false);
  const [simulateExpired, setSimulateExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const leaving = useRef(false);
  const intentoId = useRef<string | null>(null);

  useEffect(() => {
    if (leaving.current || !focused) {
      return;
    }
    if (!product || !oferta) {
      navigation.goBack();
    }
  }, [focused, navigation, oferta, product]);

  if (!product || !oferta) {
    return null;
  }

  const amount = formatMoney(oferta.prima);
  const simulacion = (): SimulacionPago | undefined => {
    if (simulateExpired) {
      return 'vencida';
    }
    if (simulateRejected) {
      return 'rechazado';
    }
    return undefined;
  };

  const pay = async () => {
    if (inFlight.current || status !== 'ready') {
      return;
    }

    if (!intentoId.current) {
      intentoId.current = crearIntentoId();
    }
    const intento = intentoId.current;
    inFlight.current = true;
    setError(null);
    setStatus('processing');
    try {
      const resultado = await payQuote(oferta.id, intento, simulacion());
      if (resultado.estado === 'aprobado') {
        setStatus('approved');
        return;
      }
      if (resultado.estado === 'rechazado') {
        setStatus('rejected');
        return;
      }
      setStatus('ready');
      setError(texts.payment.failed);
      inFlight.current = false;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setStatus('expired');
        return;
      }
      setStatus('ready');
      setError(cause instanceof ApiError && cause.detail ? cause.detail : texts.payment.failed);
      inFlight.current = false;
    }
  };

  const retry = () => {
    intentoId.current = crearIntentoId();
    setSimulateRejected(false);
    setError(null);
    setStatus('ready');
    inFlight.current = false;
  };

  const requote = () => {
    const current = useQuoteStore.getState().product;
    leaving.current = true;
    useQuoteStore.getState().clear();
    if (current) {
      useQuoteStore.getState().selectProduct(current);
    }
    navigation.navigate('Quote', { screen: 'Form' });
  };

  const showSimulation = status === 'ready' || status === 'expired';

  return (
    <Screen testID="quote-payment-screen" header={{ title: texts.payment.screenTitle }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {status === 'processing' ? (
          <Banner testID="quote-payment-status" variant="info">
            {texts.payment.processing}
          </Banner>
        ) : null}
        {status === 'approved' ? (
          <Banner testID="quote-payment-status" variant="success">
            {texts.payment.approved}
          </Banner>
        ) : null}
        {status === 'rejected' ? (
          <Banner testID="quote-payment-status" variant="error">
            {texts.payment.rejected}
          </Banner>
        ) : null}
        {status === 'expired' ? (
          <Banner testID="quote-payment-status" variant="error">
            {texts.payment.expired}
          </Banner>
        ) : null}
        {error ? <Banner variant="error">{error}</Banner> : null}
        <Card>
          <AppText variant="body" style={styles.title}>
            {product.nombre}
          </AppText>
          <AppText variant="bodySmall">
            {texts.payment.reference(quoteReference(oferta.id), formatVigenteHasta(oferta.vigente_hasta))}
          </AppText>
          <AppText variant="bodySmall">{texts.payment.amountLabel}</AppText>
          <AppText testID="quote-pay-amount" variant="sectionTitle" style={styles.amount}>
            {amount}
          </AppText>
        </Card>
        <Card>
          <AppText variant="body" style={styles.title}>
            {texts.payment.methodTitle}
          </AppText>
          <AppText testID="quote-payment-method" variant="bodySmall">
            {texts.payment.method}
          </AppText>
          {showSimulation ? (
            <View style={styles.checks}>
              <CheckboxField
                testID="simulate-rejected"
                label={texts.payment.simulateRejected}
                checked={simulateRejected}
                onPress={() => {
                  if (status === 'ready') {
                    setSimulateRejected((value) => !value);
                  }
                }}
              />
              <CheckboxField
                testID="simulate-expired"
                label={texts.payment.simulateExpired}
                checked={simulateExpired}
                onPress={() => {
                  if (status === 'ready') {
                    setSimulateExpired((value) => !value);
                  }
                }}
              />
            </View>
          ) : null}
        </Card>
        {status === 'rejected' ? (
          <Button testID="quote-retry" title={texts.payment.retry} onPress={retry} />
        ) : null}
        {status === 'expired' || status === 'rejected' ? (
          <Button testID="quote-requote" title={texts.payment.requote} variant="outlined" onPress={requote} />
        ) : null}
        {status === 'ready' || status === 'processing' ? (
          <Button
            testID="quote-pay"
            title={texts.payment.pay(amount)}
            disabled={status !== 'ready'}
            onPress={() => {
              void pay();
            }}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
