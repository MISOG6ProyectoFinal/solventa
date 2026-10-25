import { StyleSheet, View } from 'react-native';

import { useLanguageStore } from '../../../shared/i18n/useLanguageStore';
import { theme } from '../../../shared/theme';
import { AppText } from '../../../shared/ui';
import { formatDecimal } from '../formatDecimal';
import { useTexts } from '../texts';
import { type NearbyProvider } from '../types';

export function ProviderSummary({ provider }: Readonly<{ provider: NearbyProvider }>) {
  const texts = useTexts();
  const language = useLanguageStore((state) => state.language);
  const rating =
    provider.rating === null
      ? texts.providers.noRating
      : texts.providers.rating(formatDecimal(provider.rating, language));

  return (
    <View style={styles.summary}>
      <AppText variant="subtitle" style={styles.name}>
        {provider.name}
      </AppText>
      <AppText variant="bodySmall">{texts.providers.categories[provider.type]}</AppText>
      <AppText variant="body">{texts.providers.distance(formatDecimal(provider.distanceKm, language))}</AppText>
      <AppText variant="body">{texts.providers.eta(provider.etaMin)}</AppText>
      <AppText variant="body">{rating}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: theme.space.xs,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
  },
});
