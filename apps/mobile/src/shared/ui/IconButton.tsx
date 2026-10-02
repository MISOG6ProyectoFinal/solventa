import { Animated, Easing, Pressable, StyleSheet, useAnimatedValue } from 'react-native';

import { theme } from '../theme';
import { Icon, iconColor, type IconColor } from './Icon';
import { type IconName } from './icons';

type IconButtonProps = {
  label: string;
  icon: IconName;
  color?: IconColor;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function IconButton({ label, icon, color = 'onNavy', onPress, onLongPress }: IconButtonProps) {
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animatePressed(1)}
      onPressOut={() => animatePressed(0)}
      style={styles.hit}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.feedback,
          { backgroundColor: iconColor[color] },
          {
            opacity: pressed.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.24],
            }),
            transform: [
              {
                scale: pressed.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={{
          opacity: pressed.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.65],
          }),
          transform: [
            {
              scale: pressed.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.88],
              }),
            },
          ],
        }}
      >
        <Icon name={icon} size={20} color={color} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
  },
});
