import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { isPastDate } from '../../../../shared/date';
import { Banner, Button, DateField, Screen, SelectField, TextField } from '../../../../shared/ui';
import { useSessionStore } from '../../store/useSessionStore';
import { useTexts } from '../../texts';
import { type DocumentType, type RegisterValues } from '../../types';
import styles from './styles';

const documentTypes: DocumentType[] = ['CC', 'CE', 'Pasaporte'];

const emptyValues: RegisterValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  documentType: 'CC',
  documentNumber: '',
  phone: '',
  birthDate: '',
};

type TextKey = Exclude<keyof RegisterValues, 'documentType'>;

const requiredKeys: TextKey[] = ['firstName', 'lastName', 'email', 'documentNumber', 'phone', 'birthDate', 'password'];

export default function RegisterScreen() {
  const texts = useTexts();
  const navigation = useNavigation();
  const register = useSessionStore((state) => state.register);
  const [values, setValues] = useState<RegisterValues>(emptyValues);
  const [missing, setMissing] = useState<TextKey[]>([]);
  const [birthDateInvalid, setBirthDateInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const change = (key: keyof RegisterValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const isMissing = (key: TextKey) => missing.includes(key);

  const submit = async () => {
    const empty = requiredKeys.filter((key) => values[key].trim() === '');
    const futureBirthDate = values.birthDate !== '' && !isPastDate(values.birthDate);
    setMissing(empty);
    setBirthDateInvalid(futureBirthDate);
    if (empty.length > 0 || futureBirthDate) {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await register(values);
    } catch (cause) {
      setError(errorMessage(cause, texts.register.failed));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen testID="register-screen" header={{ title: texts.register.title, hideBackButton: true }}>
      <KeyboardAvoidingView style={styles.avoiding} behavior="padding">
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {error ? <Banner variant="error">{error}</Banner> : null}
          <TextField
            label={texts.register.firstNameLabel}
            value={values.firstName}
            onChangeText={change('firstName')}
            autoCapitalize="words"
            required
            error={isMissing('firstName')}
          />
          <TextField
            label={texts.register.lastNameLabel}
            value={values.lastName}
            onChangeText={change('lastName')}
            autoCapitalize="words"
            required
            error={isMissing('lastName')}
          />
          <TextField
            label={texts.register.emailLabel}
            value={values.email}
            onChangeText={change('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            required
            error={isMissing('email')}
          />
          <SelectField
            label={texts.register.documentTypeLabel}
            value={values.documentType}
            options={documentTypes.map((value) => ({ value, label: texts.register.documentTypes[value] }))}
            onChange={change('documentType')}
            required
          />
          <TextField
            label={texts.register.documentNumberLabel}
            value={values.documentNumber}
            onChangeText={change('documentNumber')}
            autoCapitalize="characters"
            required
            error={isMissing('documentNumber')}
          />
          <TextField
            label={texts.register.phoneLabel}
            value={values.phone}
            onChangeText={change('phone')}
            keyboardType="phone-pad"
            required
            error={isMissing('phone')}
          />
          <DateField
            label={texts.register.birthDateLabel}
            value={values.birthDate}
            onChange={change('birthDate')}
            required
            error={isMissing('birthDate')}
            errorMessage={birthDateInvalid ? texts.register.birthDateInvalid : undefined}
          />
          <TextField
            label={texts.register.credentialLabel}
            value={values.password}
            onChangeText={change('password')}
            autoCapitalize="none"
            secureTextEntry
            required
            error={isMissing('password')}
          />
          <Button title={texts.register.submit} loading={submitting} onPress={() => void submit()} />
          <Button title={texts.register.signIn} variant="text" onPress={() => navigation.navigate('Login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
