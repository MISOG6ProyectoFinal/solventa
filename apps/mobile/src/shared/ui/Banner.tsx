import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { Icon, IconColor } from './Icon';
import { type IconName } from './icons';

type BannerVariant = 'success' | 'info' | 'warning' | 'error';

type BannerProps = {
  variant: BannerVariant;
  icon?: IconName;
  children: ReactNode;
  testID?: string;
};

const iconColor: Record<BannerVariant, IconColor> = {
  success: 'accent',
  info: 'secondary',
  warning: 'warning',
  error: 'error',
};

export function Banner({ variant, icon, children, testID }: BannerProps) {
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
      {icon ? (
        <Icon
          name={icon}
          size={20}
          color={iconColor[variant]}
          testID={testID ? `${testID}-icon` : undefined}
        />
      ) : null}
      <AppText variant="bodySmall" style={{ color: theme.colors[variant].text }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    borderWidth: 1,
    borderRadius: theme.radius.medium,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
});
