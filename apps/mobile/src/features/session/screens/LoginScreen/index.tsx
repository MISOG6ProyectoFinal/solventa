import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '../../../../shared/api/client';
import { theme } from '../../../../shared/theme';
import { Banner, BrandLogo, Button, IconButton, LanguageSelector, Screen, TextField } from '../../../../shared/ui';
import { useSessionStore } from '../../store/useSessionStore';
import { useTexts } from '../../texts';
import styles from './styles';

export default function LoginScreen() {
  const texts = useTexts();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const signIn = useSessionStore((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailEmpty, setEmailEmpty] = useState(false);
  const [passwordEmpty, setPasswordEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardOpen(true);
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const submit = async () => {
    const emailMissing = email.trim() === '';
    const passwordMissing = password.trim() === '';
    setEmailEmpty(emailMissing);
    setPasswordEmpty(passwordMissing);
    if (emailMissing || passwordMissing) {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(errorMessage(cause, texts.login.failed));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen testID="login-screen" header={{ hide: true }}>
      <KeyboardAvoidingView style={styles.avoiding} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, keyboardOpen && styles.contentWithKeyboard]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <BrandLogo style={styles.logo} />
          {error ? <Banner variant="error">{error}</Banner> : null}
          <TextField
            label={texts.login.emailLabel}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            required
            error={emailEmpty}
          />
          <TextField
            label={texts.login.credentialLabel}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            required
            error={passwordEmpty}
          />
          <Button title={texts.login.submit} loading={submitting} onPress={() => void submit()} />
          <Button
            title={texts.login.createAccount}
            variant="text"
            onPress={() => navigation.navigate('Register')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.languageToggle, { top: insets.top + theme.space.sm }]}>
        <LanguageSelector />
      </View>
      {__DEV__ ? (
        <View style={[styles.devTools, { top: insets.top + theme.space.sm }]}>
          <IconButton
            label={texts.login.devToolsLabel}
            icon="api"
            color="primary"
            onPress={() => navigation.navigate('DevTools')}
          />
        </View>
      ) : null}
    </Screen>
  );
}
