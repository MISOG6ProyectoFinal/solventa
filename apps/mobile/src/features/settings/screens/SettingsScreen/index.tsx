import { StyleSheet } from 'react-native';

import { type Language, languageNames, toLanguage } from '../../../../shared/i18n/language';
import { useLanguageStore } from '../../../../shared/i18n/useLanguageStore';
import { theme } from '../../../../shared/theme';
import { AppText, Card, OptionList, Screen } from '../../../../shared/ui';
import { useTexts } from '../../texts';

const options = (Object.keys(languageNames) as Language[]).map((id) => ({ id, label: languageNames[id] }));

export default function SettingsScreen() {
  const texts = useTexts();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const change = (id: string) => {
    const next = toLanguage(id);
    if (next) {
      setLanguage(next);
    }
  };

  return (
    <Screen testID="settings-screen" header={{ title: texts.settings.screenTitle }}>
      <Card style={styles.card}>
        <AppText variant="subtitle">{texts.settings.languageTitle}</AppText>
        <OptionList options={options} value={language} onChange={change} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: theme.space.lg,
    gap: theme.space.md,
  },
});
