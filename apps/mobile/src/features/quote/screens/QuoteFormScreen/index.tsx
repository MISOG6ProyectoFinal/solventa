import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import {
  AppText,
  Banner,
  Button,
  Card,
  DateField,
  LoadingState,
  Screen,
  SelectField,
  TextField,
} from '../../../../shared/ui';
import { createQuote } from '../../api/createQuote';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useTexts } from '../../texts';
import { destinos, type QuoteFormError, QuoteFormValues } from '../../types';
import { defaultQuoteForm, digitsOnly, validateQuoteForm } from '../../utils';
import styles from './styles';

export default function QuoteFormScreen() {
  const texts = useTexts();
  const fieldError = (key?: QuoteFormError) => (key ? texts.form[key] : undefined);
  const navigation = useNavigation();
  const product = useQuoteStore((state) => state.product);
  const setOferta = useQuoteStore((state) => state.setOferta);
  const [values, setValues] = useState<QuoteFormValues>(defaultQuoteForm);
  const [errors, setErrors] = useState<ReturnType<typeof validateQuoteForm>>({});
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) {
      navigation.goBack();
    }
  }, [navigation, product]);

  const submit = async () => {
    if (calculating || !product) {
      return;
    }

    const nextErrors = validateQuoteForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setError(null);
    setCalculating(true);
    try {
      const oferta = await createQuote(product.id, values);
      setOferta(oferta);
      navigation.navigate('Quote', { screen: 'Result' });
    } catch (cause) {
      setError(errorMessage(cause, texts.form.quoteFailed));
    } finally {
      setCalculating(false);
    }
  };

  if (!product) {
    return null;
  }

  if (calculating) {
    return (
      <Screen
        testID="quote-form-screen"
        header={{ title: texts.products.screenTitle, subtitle: texts.products.screenSubtitle }}
      >
        <LoadingState testID="quote-loading" label={texts.form.calculating} />
      </Screen>
    );
  }

  return (
    <Screen
      testID="quote-form-screen"
      header={{ title: texts.products.screenTitle, subtitle: texts.products.screenSubtitle }}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <Banner variant="error">{error}</Banner> : null}
        <Card>
          <AppText variant="body" style={styles.title}>
            {product.nombre}
          </AppText>
          <AppText variant="bodySmall">{product.descripcion}</AppText>
          <TextField
            label={texts.form.nameLabel}
            value={values.nombre}
            onChangeText={(nombre) => setValues((current) => ({ ...current, nombre }))}
            required
            errorMessage={fieldError(errors.nombre)}
            testID="quote-nombre"
          />
          <TextField
            label={texts.form.documentLabel}
            value={values.cedula}
            onChangeText={(cedula) => setValues((current) => ({ ...current, cedula: digitsOnly(cedula) }))}
            keyboardType="number-pad"
            required
            errorMessage={fieldError(errors.cedula)}
            testID="quote-documento"
          />
          <SelectField
            label={texts.form.destinationLabel}
            value={values.destino}
            options={destinos.map((destino) => ({ value: destino, label: destino }))}
            onChange={(destino) => setValues((current) => ({ ...current, destino }))}
            required
            errorMessage={fieldError(errors.destino)}
            testID="quote-field-destino"
          />
          <DateField
            label={texts.form.departureLabel}
            value={values.fechaSalida}
            onChange={(fechaSalida) => setValues((current) => ({ ...current, fechaSalida }))}
            required
            errorMessage={fieldError(errors.fechaSalida)}
            testID="quote-field-fechaSalida"
          />
          <DateField
            label={texts.form.returnLabel}
            value={values.fechaRegreso}
            onChange={(fechaRegreso) => setValues((current) => ({ ...current, fechaRegreso }))}
            required
            errorMessage={fieldError(errors.fechaRegreso)}
            testID="quote-field-fechaRegreso"
          />
          <TextField
            label={texts.form.travelersLabel}
            value={values.viajeros}
            onChangeText={(viajeros) => setValues((current) => ({ ...current, viajeros: digitsOnly(viajeros) }))}
            keyboardType="number-pad"
            required
            errorMessage={fieldError(errors.viajeros)}
            testID="quote-field-viajeros"
          />
        </Card>
        <Button
          testID="quote-calc"
          title={texts.form.calculateButton}
          onPress={() => {
            void submit();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
