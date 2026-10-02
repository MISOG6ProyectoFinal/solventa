import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useAnimatedValue, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type Option = {
  id: string;
  label: string;
};

type OptionListProps = {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
};

type OptionRowProps = {
  option: Option;
  selected: boolean;
  onPress: () => void;
};

function OptionRow({ option, selected, onPress }: OptionRowProps) {
  const progress = useAnimatedValue(selected ? 1 : 0);
  const scale = useAnimatedValue(1);
  const skipIntro = useRef(true);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (skipIntro.current) {
      skipIntro.current = false;
      return;
    }

    if (!selected) {
      return;
    }

    scale.setValue(0.96);
    Animated.timing(scale, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, scale, selected]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.hit}
    >
      <Animated.View
        style={{
          opacity: scale.interpolate({
            inputRange: [0.96, 1],
            outputRange: [0.55, 1],
          }),
          transform: [{ scale }],
        }}
      >
        <Animated.View
          testID={`option-${option.id}`}
          style={[
            styles.option,
            {
              backgroundColor: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [theme.colors.surface, theme.colors.info.background],
              }),
              borderColor: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [theme.colors.border, theme.colors.borderSelected],
              }),
            },
          ]}
        >
          <AppText variant="bodySmall" style={styles.label}>
            {option.label}
          </AppText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export function OptionList({ options, value, onChange }: OptionListProps) {
  return (
    <View style={styles.list}>
      {options.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          selected={option.id === value}
          onPress={() => onChange(option.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.space.sm,
  },
  hit: {
    alignSelf: 'stretch',
  },
  option: {
    borderWidth: 1,
    borderRadius: theme.radius.medium,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  label: {
    fontFamily: theme.type.subtitle.fontFamily,
    fontWeight: theme.type.subtitle.fontWeight,
    color: theme.colors.text,
    textAlign: 'left',
  },
});
