import { StatusBar, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTexts } from '../texts';
import { theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
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
  action?: {
    title: string;
    onPress: () => void;
  };
};

function leadingControl(
  displayBackBtn: boolean,
  leadingIcon: LeadingIcon | undefined,
  onBack: () => void,
  backLabel: string,
) {
  if (displayBackBtn) {
    return <IconButton label={backLabel} icon="volver" onPress={onBack} />;
  }
  if (!leadingIcon) {
    return null;
  }
  return (
    <IconButton
      label={leadingIcon.label}
      icon={leadingIcon.icon}
      onPress={leadingIcon.onPress}
      onLongPress={leadingIcon.onLongPress}
    />
  );
}

export function AppHeader({ title, subtitle, leadingIcon, hideBackButton, action }: Readonly<AppHeaderProps>) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const texts = useTexts();

  const displayBackBtn = navigation.canGoBack() && !hideBackButton && leadingIcon == null;
  const hasLeadingIcon = leadingIcon != null || displayBackBtn;

  return (
    <View testID="app-header" style={[styles.bar, { paddingTop: insets.top + theme.space.md }]}>
      <StatusBar barStyle="light-content" />
      <View testID="app-header-row" style={styles.row}>
        {leadingControl(displayBackBtn, leadingIcon, () => navigation.goBack(), texts.back)}
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
        {action ? <Button title={action.title} variant="accent" onPress={action.onPress} /> : null}
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
