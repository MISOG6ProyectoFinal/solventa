import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, useAnimatedValue } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type Option = {
  id: string;
  label: string;
};

type ChipSelectorProps = {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
};

type ChipProps = {
  option: Option;
  selected: boolean;
  onPress: () => void;
};

const PRESSED_SCALE = 0.94;

function Chip({ option, selected, onPress }: Readonly<ChipProps>) {
  const progress = useAnimatedValue(selected ? 1 : 0);
  const scale = useAnimatedValue(1);
  const skipIntro = useRef(true);

  const animateScale = (toValue: number, duration: number) => {
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (skipIntro.current) {
      skipIntro.current = false;
      return;
    }
    // A chip that just became selected pops back from slightly smaller.
    if (selected) {
      scale.setValue(PRESSED_SCALE);
      Animated.timing(scale, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [progress, scale, selected]);

  return (
    <Pressable
      testID={`chip-${option.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => animateScale(PRESSED_SCALE, 80)}
      onPressOut={() => animateScale(1, 160)}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View
          style={[
            styles.chip,
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
          <AppText variant="bodySmall" style={selected ? styles.selectedLabel : null}>
            {option.label}
          </AppText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export const ChipSelector = memo(function ChipSelector({ options, value, onChange }: Readonly<ChipSelectorProps>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => (
        <Chip key={option.id} option={option} selected={option.id === value} onPress={() => onChange(option.id)} />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  // A ScrollView grows to fill a column by default, which would stretch the chips vertically.
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    gap: theme.space.sm,
  },
  chip: {
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  selectedLabel: {
    color: theme.colors.info.text,
  },
});
