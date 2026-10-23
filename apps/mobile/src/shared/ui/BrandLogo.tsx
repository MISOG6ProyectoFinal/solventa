import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import Logo from '../brand/solventa-logo.svg';
import { theme } from '../theme';
import { AppText } from './AppText';

type BrandLogoProps = {
  style?: StyleProp<ViewStyle>;
};

export function BrandLogo({ style }: Readonly<BrandLogoProps>) {
  return (
    <View style={[styles.logo, style]}>
      <Logo width={88} height={103} />
      <AppText variant="sectionTitle">Solventa</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: theme.space.sm,
  },
});
