import { Animated, Easing, Pressable, StyleSheet, useAnimatedValue, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { Icon, IconColor } from './Icon';
import { type IconName } from './icons';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'outlined'
  | 'primaryOutline'
  | 'text'
  | 'accentLink'
  | 'danger';

type ButtonProps = {
  title: string;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
};

const iconColor: Record<ButtonVariant, IconColor> = {
  primary: 'onNavy',
  secondary: 'onNavy',
  accent: 'onNavy',
  outlined: 'dark',
  primaryOutline: 'primary',
  text: 'primary',
  accentLink: 'accent',
  danger: 'onNavy',
};

export function Button({
  title,
  variant = 'primary',
  icon,
  disabled = false,
  onPress,
  testID,
}: ButtonProps) {
  const pressed = useAnimatedValue(0);

  const animatePressed = (toValue: number) => {
    Animated.timing(pressed, {
      toValue,
      duration: toValue === 0 ? 160 : 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.press,
        {
          opacity: pressed.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.85],
          }),
          transform: [
            {
              scale: pressed.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.97],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          if (!disabled) animatePressed(1);
        }}
        onPressOut={() => animatePressed(0)}
        style={[styles.base, containerStyles[variant], disabled && styles.disabled]}
      >
        <View style={styles.content}>
          {icon ? (
            <Icon name={icon} size={20} color={disabled ? 'gray' : iconColor[variant]} />
          ) : null}
          <AppText variant="button" style={[labelStyles[variant], disabled && styles.disabledLabel]}>
            {title}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  press: {
    alignSelf: 'stretch',
  },
  base: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: theme.radius.medium,
    paddingVertical: 10,
    paddingHorizontal: theme.space.lg,
  },
  disabled: {
    backgroundColor: theme.colors.border,
    borderWidth: 0,
  },
  disabledLabel: {
    color: theme.colors.textMuted,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
});

const containerStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.colors.navy,
  },
  secondary: {
    backgroundColor: theme.colors.blue,
  },
  accent: {
    backgroundColor: theme.colors.teal,
  },
  outlined: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryOutline: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.navy,
  },
  text: {
    backgroundColor: 'transparent',
  },
  accentLink: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
});

const labelStyles = StyleSheet.create({
  primary: { color: theme.colors.onNavy },
  secondary: { color: theme.colors.onNavy },
  accent: { color: theme.colors.onNavy },
  outlined: { color: theme.colors.text },
  primaryOutline: { color: theme.colors.navy },
  text: { color: theme.colors.navy },
  accentLink: { color: theme.colors.teal },
  danger: { color: theme.colors.onNavy },
});
