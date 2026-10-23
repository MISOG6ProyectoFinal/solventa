import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { theme } from '../../../../shared/theme';
import { BrandLogo, Screen } from '../../../../shared/ui';
import { useSessionStore } from '../../store/useSessionStore';
import { useTexts } from '../../texts';
import styles from './styles';

export default function CheckingScreen() {
  const texts = useTexts();
  const restore = useSessionStore((state) => state.restore);

  useEffect(() => {
    const load = async () => {
      await restore();
    };
    void load();
  }, [restore]);

  return (
    <Screen testID="session-checking" header={{ hide: true }}>
      <View style={styles.content}>
        <BrandLogo />
        <ActivityIndicator accessibilityLabel={texts.checking.loading} color={theme.colors.blue} />
      </View>
    </Screen>
  );
}
