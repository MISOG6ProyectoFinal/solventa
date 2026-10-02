import { useEffect } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useAnimatedValue } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
  required?: boolean;
  error?: boolean;
  testID?: string;
};

export function CheckboxField({
  label,
  checked,
  onPress,
  required = false,
  error = false,
  testID,
}: CheckboxFieldProps) {
  const fill = useAnimatedValue(checked ? 1 : 0);
  const mark = useAnimatedValue(checked ? 1 : 0);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: checked ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();

    Animated.timing(mark, {
      toValue: checked ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [checked, fill, mark]);

  const restBorder = error ? theme.colors.danger : theme.colors.border;

  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.row}>
      <Animated.View
        testID={testID}
        style={[
          styles.box,
          {
            backgroundColor: fill.interpolate({
              inputRange: [0, 1],
              outputRange: [theme.colors.surface, theme.colors.navy],
            }),
            borderColor: fill.interpolate({
              inputRange: [0, 1],
              outputRange: [restBorder, theme.colors.navy],
            }),
          },
        ]}
      >
        <Animated.Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[
            styles.mark,
            {
              opacity: mark,
              transform: [{ scale: mark }],
            },
          ]}
        >
          ✓
        </Animated.Text>
      </Animated.View>
      <AppText variant="label">
        {label}
        {required ? (
          <AppText variant="label" style={styles.asterisk}>
            {' *'}
          </AppText>
        ) : null}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.space.xs,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    ...theme.type.caption,
    color: theme.colors.onNavy,
  },
  asterisk: {
    color: theme.colors.danger,
    textTransform: 'none',
  },
});
