import { useEffect } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useAnimatedValue } from 'react-native';

import { theme } from '../theme';
import { motionDuration } from './motion';

type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  testID?: string;
};

export function Switch({ value, onValueChange, label, testID }: Readonly<SwitchProps>) {
  const knob = useAnimatedValue(value ? 1 : 0);

  useEffect(() => {
    Animated.timing(knob, {
      toValue: value ? 1 : 0,
      duration: motionDuration(160),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [knob, value]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value && styles.on]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            transform: [
              {
                translateX: knob.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 24],
                }),
              },
            ],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 24,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.borderStrong,
    padding: theme.space.xs,
    justifyContent: 'center',
  },
  on: {
    backgroundColor: theme.colors.teal,
  },
  knob: {
    width: 16,
    height: 16,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
  },
});
