import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type BannerVariant = 'success' | 'info' | 'warning' | 'error';

type BannerProps = {
  variant: BannerVariant;
  children: ReactNode;
  testID?: string;
};

export function Banner({ variant, children, testID }: BannerProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors[variant].background,
          borderColor: theme.colors[variant].border,
        },
      ]}
    >
      <AppText variant="body" style={{ color: theme.colors[variant].text }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: theme.radius.medium,
    padding: theme.space.md,
  },
});
