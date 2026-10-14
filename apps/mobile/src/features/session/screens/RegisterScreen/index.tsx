import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { Banner, Button, Screen, TextField } from '../../../../shared/ui';
import { useSessionStore } from '../../store/useSessionStore';
import { texts } from '../../texts';
import styles from './styles';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const register = useSessionStore((state) => state.register);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstNameEmpty, setFirstNameEmpty] = useState(false);
  const [lastNameEmpty, setLastNameEmpty] = useState(false);
  const [emailEmpty, setEmailEmpty] = useState(false);
  const [passwordEmpty, setPasswordEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const firstNameMissing = firstName.trim() === '';
    const lastNameMissing = lastName.trim() === '';
    const emailMissing = email.trim() === '';
    const passwordMissing = password.trim() === '';
    setFirstNameEmpty(firstNameMissing);
    setLastNameEmpty(lastNameMissing);
    setEmailEmpty(emailMissing);
    setPasswordEmpty(passwordMissing);
    if (firstNameMissing || lastNameMissing || emailMissing || passwordMissing) {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, firstName, lastName);
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
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            required
            error={firstNameEmpty}
          />
          <TextField
            label={texts.register.lastNameLabel}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            required
            error={lastNameEmpty}
          />
          <TextField
            label={texts.register.emailLabel}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            required
            error={emailEmpty}
          />
          <TextField
            label={texts.register.credentialLabel}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            required
            error={passwordEmpty}
          />
          <Button title={texts.register.submit} loading={submitting} onPress={() => void submit()} />
          <Button title={texts.register.signIn} variant="text" onPress={() => navigation.navigate('Login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
