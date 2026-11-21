import { ReactNode, useEffect } from 'react';
import { Animated, Easing, StyleSheet, useAnimatedValue, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { theme } from '../theme';
import { motionDuration } from './motion';
import { useTexts } from '../texts';
import { AppText } from './AppText';

export function fieldHint(required: boolean, message: string | undefined, requiredText: string) {
  const parts = [required ? requiredText : undefined, message].filter(Boolean);
  return parts.length > 0 ? parts.join('. ') : undefined;
}

type FieldFrameProps = {
  label: string;
  required?: boolean;
  error?: boolean;
  message?: string;
  value?: string;
  focused?: boolean;
  testID?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  children: ReactNode;
};

export function FieldFrame({
  label,
  required = false,
  error = false,
  message,
  value,
  focused = false,
  testID,
  trailing,
  onPress,
  children,
}: Readonly<FieldFrameProps>) {
  const texts = useTexts();
  const active = focused && !error;
  const focus = useAnimatedValue(active ? 1 : 0);

  useEffect(() => {
    Animated.timing(focus, {
      toValue: active ? 1 : 0,
      duration: motionDuration(180),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, focus]);

  const control = (
    <Animated.View
      testID={onPress ? undefined : testID}
      style={[
        styles.control,
        {
          borderColor: error
            ? theme.colors.danger
            : focus.interpolate({
                inputRange: [0, 1],
                outputRange: [theme.colors.borderStrong, theme.colors.blue],
              }),
          borderWidth: focus.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 2],
          }),
        },
      ]}
    >
      <View style={styles.body}>{children}</View>
      {trailing}
    </Animated.View>
  );

  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        {label}
        {required ? (
          <AppText variant="label" style={styles.asterisk}>
            {' *'}
          </AppText>
        ) : null}
      </AppText>
      {onPress ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={value ? { text: value } : undefined}
          accessibilityHint={fieldHint(required, message, texts.required)}
          onPress={onPress}
        >
          {control}
        </Pressable>
      ) : (
        control
      )}
      {message ? (
        <AppText variant="caption" style={styles.message}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: theme.space.xs,
  },
  label: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    letterSpacing: 0.6,
  },
  asterisk: {
    color: theme.colors.danger,
    textTransform: 'none',
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.medium,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  body: {
    flex: 1,
  },
  message: {
    color: theme.colors.danger,
  },
});
