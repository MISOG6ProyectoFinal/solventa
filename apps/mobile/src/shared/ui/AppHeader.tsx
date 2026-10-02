import { Animated, Easing, Pressable, StatusBar, StyleSheet, useAnimatedValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { type IconName } from './icons';

type HomeHeaderProps = {
  variant: 'home';
  greeting: string;
  onMenuPress?: () => void;
  onMenuLongPress?: () => void;
};

type FlowHeaderProps = {
  variant: 'flow';
  title: string;
  onBackPress?: () => void;
};

type AppHeaderProps = HomeHeaderProps | FlowHeaderProps;

type HeaderIconButtonProps = {
  label: string;
  icon: IconName;
  onPress?: () => void;
  onLongPress?: () => void;
};

function HeaderIconButton({ label, icon, onPress, onLongPress }: HeaderIconButtonProps) {
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
        <Icon name={icon} size={20} color="onNavy" />
      </Animated.View>
    </Pressable>
  );
}

export function AppHeader(props: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View testID="app-header" style={[styles.bar, { paddingTop: insets.top + theme.space.md }]}>
      <StatusBar barStyle="light-content" />
      {props.variant === 'home' ? (
        <HeaderIconButton
          label="Menú"
          icon="menu"
          onPress={props.onMenuPress}
          onLongPress={props.onMenuLongPress}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={props.onBackPress}
          style={styles.hit}
        >
          <Icon name="volver" size={20} color="onNavy" />
        </Pressable>
      )}
      <View style={styles.copy}>
        {props.variant === 'home' ? (
          <>
            <AppText variant="screenTitle" numberOfLines={1} style={styles.greeting}>
              {props.greeting}
            </AppText>
            <AppText variant="bodySmall" style={styles.muted}>
              Tu cobertura
            </AppText>
          </>
        ) : (
          <AppText variant="button" style={styles.onNavy}>
            {props.title}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    backgroundColor: theme.colors.navy,
    paddingBottom: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
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
    backgroundColor: theme.colors.onNavy,
  },
  copy: {
    flex: 1,
    gap: theme.space.xs,
  },
  greeting: {
    fontSize: 18,
    lineHeight: 22.5,
    color: theme.colors.onNavy,
  },
  onNavy: {
    color: theme.colors.onNavy,
  },
  muted: {
    color: theme.colors.onNavyMuted,
  },
});
