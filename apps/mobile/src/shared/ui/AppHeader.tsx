import { StatusBar, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { type IconName } from './icons';

type LeadingIcon = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
};

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  leadingIcon?: LeadingIcon;
  hideBackButton?: boolean;
};

export function AppHeader({ title, subtitle, leadingIcon, hideBackButton }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const displayBackBtn = navigation.canGoBack() && !hideBackButton && leadingIcon == null;
  const hasLeadingIcon = displayBackBtn || leadingIcon != null;

  return (
    <View testID="app-header" style={[styles.bar, { paddingTop: insets.top + theme.space.md }]}>
      <StatusBar barStyle="light-content" />
      <View testID="app-header-row" style={styles.row}>
        {displayBackBtn ? (
          <IconButton label="Volver" icon="volver" onPress={() => navigation.goBack()} />
        ) : leadingIcon ? (
          <IconButton
            label={leadingIcon.label}
            icon={leadingIcon.icon}
            onPress={leadingIcon.onPress}
            onLongPress={leadingIcon.onLongPress}
          />
        ) : null}
        <View style={[styles.copy, !hasLeadingIcon && styles.noLeadingSpace]}>
          <AppText variant="screenTitle" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="bodySmall" numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.navy,
    paddingBottom: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    minHeight: 44,
  },
  copy: {
    flex: 1,
    gap: theme.space.xs,
  },
  title: {
    fontSize: 18,
    lineHeight: 22.5,
    color: theme.colors.onNavy,
  },
  subtitle: {
    color: theme.colors.onNavyMuted,
  },
  noLeadingSpace: {
    paddingStart: theme.space.sm,
  },
});
