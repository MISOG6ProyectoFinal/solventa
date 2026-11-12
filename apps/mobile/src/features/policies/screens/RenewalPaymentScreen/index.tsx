import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { crearIntentoId } from '../../../../shared/payments/crearIntentoId';
import { AppText, Banner, Button, Card, CheckboxField, ErrorState, LoadingState, Screen } from '../../../../shared/ui';
import { formatMoney } from '../../../quote/utils';
import { applyRenewal } from '../../api/applyRenewal';
import { getRenewalOffer } from '../../api/getRenewalOffer';
import { payRenewal } from '../../api/payRenewal';
import { getTexts, useTexts } from '../../texts';
import { POLICY_STATUS, Policy, RenewalOffer, RenewalResult } from '../../types';
import { policyDate } from '../../utils';
import RenewalConfirmation from '../RenewalConfirmation';
import styles from './styles';
import { PAYMENT_STATUS } from '../../../../shared/payments/paymentStatus';

type Props = StaticScreenProps<{
  policyId: string;
  productName?: string;
}>;

type PaymentStatus = 'ready' | 'processing' | 'rejected' | 'error' | 'applying' | 'applied' | 'applyError';

export default function RenewalPaymentScreen({ route }: Readonly<Props>) {
  const { policyId, productName } = route.params;
  const texts = useTexts();
  const navigation = useNavigation();
  const [offer, setOffer] = useState<RenewalOffer | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('ready');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [renewal, setRenewal] = useState<RenewalResult | null>(null);
  const [simulateRejected, setSimulateRejected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  const intentoId = useRef<string | null>(null);
  const paymentId = useRef<string | null>(null);

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

  const apply = async (cobroId: string) => {
    setApplyError(null);
    setStatus('applying');
    try {
      const result = await applyRenewal(policyId, cobroId);
      setRenewal(result);
      setStatus('applied');
    } catch {
      setRenewal(null);
      setStatus('applyError');
      setApplyError(texts.renewal.applyFailed);
    }
  };

  const pay = async (attemptMode: 'new' | 'reuse') => {
    if (
      inFlight.current ||
      status === 'processing' ||
      status === 'applying' ||
      status === 'applied' ||
      status === 'applyError' ||
      offer === null
    ) {
      return;
    }

    const intento = attemptMode === 'new' || intentoId.current === null ? crearIntentoId() : intentoId.current;
    intentoId.current = intento;
    inFlight.current = true;
    setPaymentError(null);
    setStatus('processing');

    try {
      const resultado = await payRenewal(policyId, intento, simulateRejected ? 'rechazado' : undefined);
      if (resultado.estado === PAYMENT_STATUS.approved) {
        paymentId.current = resultado.id;
        await apply(resultado.id);
        return;
      }
      if (resultado.estado === PAYMENT_STATUS.rejected) {
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

  const retryApply = async () => {
    if (inFlight.current || paymentId.current === null) {
      return;
    }
    inFlight.current = true;
    try {
      await apply(paymentId.current);
    } finally {
      inFlight.current = false;
    }
  };

  const viewPolicy = () => {
    if (renewal === null) {
      return;
    }
    navigation.navigate('PolicyDetail', {
      policy: policyFromRenewal(renewal),
      productName,
    });
  };

  if (status === 'applied' && renewal !== null) {
    return (
      <Screen
        testID="renewal-confirmation-screen"
        header={{ title: texts.renewal.successTitle, hideBackButton: true }}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <RenewalConfirmation confirmation={renewal} productName={productName} onViewPolicy={viewPolicy} />
        </ScrollView>
      </Screen>
    );
  }

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
              applyError={applyError}
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
              onRetryApply={() => {
                void retryApply();
              }}
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function policyFromRenewal(renewal: RenewalResult): Policy {
  return {
    id: renewal.poliza_id,
    numero: renewal.numero_poliza,
    cotizacion_id: '',
    cobro_id: renewal.cobro_id,
    producto_id: renewal.producto_id,
    prima: '',
    estado: POLICY_STATUS.active,
    vigencia: renewal.vigencia_anterior,
    coberturas: renewal.coberturas,
    renovable: false,
    renovacion: {
      estado: 'aplicada',
      cobro_id: renewal.cobro_id,
      vigencia_nueva: renewal.vigencia_nueva,
    },
  };
}

function PaymentBody({
  offer,
  productName,
  status,
  paymentError,
  applyError,
  simulateRejected,
  onToggleSimulation,
  onPay,
  onRetry,
  onRetryApply,
}: Readonly<{
  offer: RenewalOffer;
  productName?: string;
  status: PaymentStatus;
  paymentError: string | null;
  applyError: string | null;
  simulateRejected: boolean;
  onToggleSimulation: () => void;
  onPay: () => void;
  onRetry: () => void;
  onRetryApply: () => void;
}>) {
  const texts = useTexts();
  const amount = formatMoney(offer.prima_propuesta);
  const nombre = productName ?? offer.producto_id;
  const busy = status === 'processing' || status === 'applying';

  return (
    <>
      {status === 'processing' ? (
        <Banner testID="renewal-payment-status" variant="info">
          {texts.renewal.processing}
        </Banner>
      ) : null}
      {status === 'applying' ? (
        <Banner testID="renewal-applying" variant="info">
          {texts.renewal.applying}
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
      {status === 'applyError' ? (
        <Banner testID="renewal-apply-error" variant="error">
          {applyError ?? texts.renewal.applyFailed}
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
        {busy || status === 'applyError' ? null : (
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
        {busy || status === 'applyError' ? null : (
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
      {status === 'applyError' ? (
        <Button testID="renewal-apply-retry" title={texts.renewal.retryApply} onPress={onRetryApply} />
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
