import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  type ApiTarget,
  defaultCustomUrl,
  getApiBaseUrl,
  getApiTarget,
  getBuildApiBaseUrl,
  getCustomApiUrl,
  normalizeApiUrl,
  selectBuildApi,
  selectCustomApi,
} from '../../../../shared/api/apiBaseUrl';
import { theme } from '../../../../shared/theme';
import { AppText, Button, Card, OptionList, Screen, TextField } from '../../../../shared/ui';

const options = [
  { id: 'build', label: 'Del build' },
  { id: 'custom', label: 'Personalizada' },
];

export default function DevToolsScreen() {
  const navigation = useNavigation();
  const buildUrl = getBuildApiBaseUrl();
  const [target, setTarget] = useState(getApiTarget());
  const [customUrl, setCustomUrl] = useState(getCustomApiUrl());
  const [activeUrl, setActiveUrl] = useState(getApiBaseUrl());
  const invalid = target === 'custom' && normalizeApiUrl(customUrl) === null;

  const apply = (nextTarget: ApiTarget, url: string) => {
    if (nextTarget === 'build') {
      selectBuildApi();
    } else if (!selectCustomApi(url)) {
      return;
    }
    setActiveUrl(getApiBaseUrl());
  };

  const changeTarget = (id: string) => {
    const next = id as ApiTarget;
    setTarget(next);
    apply(next, customUrl);
  };

  const changeCustomUrl = (url: string) => {
    setCustomUrl(url);
    apply('custom', url);
  };

  return (
    <Screen header={{ title: 'Herramientas de desarrollo' }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="subtitle">URL base de la API</AppText>
          <OptionList options={options} value={target} onChange={changeTarget} />
          {target === 'custom' ? (
            <TextField
              label="URL"
              value={customUrl}
              onChangeText={changeCustomUrl}
              placeholder={defaultCustomUrl}
              keyboardType="url"
              autoCapitalize="none"
              error={invalid}
              errorMessage={invalid ? 'Ingresa una URL que empiece por http:// o https://' : undefined}
            />
          ) : null}
          <AppText variant="caption">En uso: {activeUrl}</AppText>
          <AppText variant="caption">URL del build: {buildUrl}</AppText>
          <AppText variant="caption">
            Emulador Android: http://10.0.2.2:8000. Dispositivo físico: la IP de tu PC. Simulador iOS: http://localhost:8000.
          </AppText>
        </Card>
        <Button title="Componentes" variant="secondary" onPress={() => navigation.navigate('Components')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.space.lg,
    gap: theme.space.md,
  },
});
