import { ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useAnimatedValue,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '../theme';

type CardProps = {
  children: ReactNode;
  variant?: 'default' | 'inverse';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Card({ children, variant = 'default', onPress, style, testID }: CardProps) {
  const pressed = useAnimatedValue(0);
  const surface = [styles.card, variant === 'inverse' && styles.inverse];

  if (!onPress) {
    return (
      <View testID={testID} style={[surface, style]}>
        {children}
      </View>
    );
  }

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
        style,
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
        onPress={onPress}
        onPressIn={() => animatePressed(1)}
        onPressOut={() => animatePressed(0)}
        style={[surface, styles.fill]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  inverse: {
    backgroundColor: theme.colors.navy,
    borderWidth: 0,
  },
  fill: {
    flexGrow: 1,
  },
});
