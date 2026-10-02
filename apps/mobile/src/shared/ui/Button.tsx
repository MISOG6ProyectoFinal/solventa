import { Animated, Easing, Pressable, StyleSheet, useAnimatedValue } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'confirm' | 'secondary' | 'danger';

type ButtonProps = {
  title: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function Button({
  title,
  variant = 'primary',
  disabled = false,
  onPress,
  testID,
}: ButtonProps) {
  const looksDisabled = disabled && variant === 'primary';
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
        style={[styles.base, containerStyles[variant], looksDisabled && styles.disabled]}
      >
        <AppText variant="button" style={labelStyles[variant]}>
          {title}
        </AppText>
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
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  disabled: {
    opacity: 0.45,
  },
});

const containerStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.colors.navy,
  },
  confirm: {
    backgroundColor: theme.colors.teal,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
});

const labelStyles = StyleSheet.create({
  primary: { color: theme.colors.onNavy },
  confirm: { color: theme.colors.onNavy },
  secondary: { color: theme.colors.navy },
  danger: { color: theme.colors.onNavy },
});
