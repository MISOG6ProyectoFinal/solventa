import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StaticScreenProps } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { crearIntentoId } from '../../../../shared/payments/crearIntentoId';
import { AppText, Banner, Button, Card, CheckboxField, ErrorState, LoadingState, Screen } from '../../../../shared/ui';
import { formatMoney } from '../../../quote/utils';
import { getRenewalOffer } from '../../api/getRenewalOffer';
import { payRenewal } from '../../api/payRenewal';
import { getTexts, useTexts } from '../../texts';
import { RenewalOffer } from '../../types';
import { policyDate } from '../../utils';
import styles from './styles';

type Props = StaticScreenProps<{
  policyId: string;
  productName?: string;
}>;

type PaymentStatus = 'ready' | 'processing' | 'rejected' | 'approved' | 'error';

export default function RenewalPaymentScreen({ route }: Readonly<Props>) {
  const { policyId, productName } = route.params;
  const texts = useTexts();
  const [offer, setOffer] = useState<RenewalOffer | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('ready');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [simulateRejected, setSimulateRejected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  const intentoId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingOffer(true);
    setOfferError(null);

    getRenewalOffer(policyId)
      .then((value) => {
        if (!cancelled) {
          setOffer(value);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setOffer(null);
          setOfferError(errorMessage(cause, getTexts().renewal.loadFailed));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOffer(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [policyId, attempt]);

  const pay = async (attemptMode: 'new' | 'reuse') => {
    if (inFlight.current || status === 'processing' || status === 'approved' || offer === null) {
      return;
    }

    const intento = attemptMode === 'new' || intentoId.current === null ? crearIntentoId() : intentoId.current;
    intentoId.current = intento;
    inFlight.current = true;
    setPaymentError(null);
    setStatus('processing');

    try {
      const resultado = await payRenewal(policyId, intento, simulateRejected ? 'rechazado' : undefined);
      if (resultado.estado === 'aprobado') {
        setStatus('approved');
        return;
      }
      if (resultado.estado === 'rechazado') {
        setStatus('rejected');
        return;
      }
      setStatus('error');
      setPaymentError(texts.renewal.paymentFailed);
    } catch (cause) {
      setStatus('error');
      setPaymentError(errorMessage(cause, texts.renewal.paymentFailed));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Screen testID="renewal-payment-screen" header={{ title: texts.renewal.payTitle }}>
      {loadingOffer ? (
        <LoadingState testID="renewal-payment-loading" label={texts.renewal.loading} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {offerError || offer === null ? (
            <ErrorState
              message={offerError ?? texts.renewal.loadFailed}
              retry={{ label: texts.renewal.retryButton, onPress: () => setAttempt((count) => count + 1) }}
            />
          ) : (
            <PaymentBody
              offer={offer}
              productName={productName}
              status={status}
              paymentError={paymentError}
              simulateRejected={simulateRejected}
              onToggleSimulation={() => {
                if (status === 'ready' || status === 'rejected') {
                  setSimulateRejected((value) => !value);
                }
              }}
              onPay={() => {
                void pay(status === 'rejected' ? 'new' : 'reuse');
              }}
              onRetry={() => {
                void pay('reuse');
              }}
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function PaymentBody({
  offer,
  productName,
  status,
  paymentError,
  simulateRejected,
  onToggleSimulation,
  onPay,
  onRetry,
}: Readonly<{
  offer: RenewalOffer;
  productName?: string;
  status: PaymentStatus;
  paymentError: string | null;
  simulateRejected: boolean;
  onToggleSimulation: () => void;
  onPay: () => void;
  onRetry: () => void;
}>) {
  const texts = useTexts();
  const amount = formatMoney(offer.prima_propuesta);
  const nombre = productName ?? offer.producto_id;
  const approved = status === 'approved';

  return (
    <>
      {status === 'processing' ? (
        <Banner testID="renewal-payment-status" variant="info">
          {texts.renewal.processing}
        </Banner>
      ) : null}
      {status === 'rejected' ? (
        <Banner testID="renewal-payment-status" variant="error">
          {texts.renewal.rejected}
        </Banner>
      ) : null}
      {status === 'error' ? (
        <Banner testID="renewal-payment-status" variant="error">
          {paymentError ?? texts.renewal.paymentFailed}
        </Banner>
      ) : null}
      {approved ? (
        <Banner testID="renewal-payment-status" variant="success">
          {texts.renewal.approved}
        </Banner>
      ) : null}
      <Card>
        <AppText variant="body" style={styles.title}>
          {texts.renewal.paySummary}
        </AppText>
        <AppText variant="bodySmall">
          {nombre} · {offer.numero_poliza}
        </AppText>
        <AppText testID="renewal-pay-amount" variant="sectionTitle" style={styles.amount}>
          {amount}
        </AppText>
        {approved ? null : (
          <AppText variant="bodySmall">
            {texts.renewal.payValidity(
              policyDate(offer.vigencia_propuesta.desde),
              policyDate(offer.vigencia_propuesta.hasta),
            )}
          </AppText>
        )}
        <AppText testID="renewal-payment-method" variant="bodySmall">
          {texts.renewal.method}
        </AppText>
        {approved ? null : (
          <View style={styles.checks}>
            <CheckboxField
              testID="renewal-simulate-reject"
              label={texts.renewal.simulateRejected}
              checked={simulateRejected}
              onPress={onToggleSimulation}
            />
          </View>
        )}
      </Card>
      {status === 'error' ? (
        <Button testID="renewal-payment-retry" title={texts.renewal.retryButton} onPress={onRetry} />
      ) : null}
      {status === 'ready' || status === 'processing' || status === 'rejected' ? (
        <Button
          testID="renewal-pay"
          title={status === 'processing' ? texts.renewal.processingButton : texts.renewal.pay(amount)}
          disabled={status === 'processing'}
          onPress={onPay}
        />
      ) : null}
    </>
  );
}
