import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useAnimatedValue,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconColor } from './Icon';
import { type IconName } from './icons';

type TabId = 'Home' | 'Policies' | 'Claims' | 'Buy';

const tabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'Home', label: 'Inicio', icon: 'inicio' },
  { id: 'Policies', label: 'Pólizas', icon: 'polizas' },
  { id: 'Claims', label: 'Siniestros', icon: 'siniestros' },
  { id: 'Buy', label: 'Comprar', icon: 'comprar' },
];

type TabBarProps = {
  value: string;
  onChange: (id: TabId) => void;
};

export function TabBar({ value, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const selectedIndex = Math.max(
    tabs.findIndex((tab) => tab.id === value),
    0,
  );
  const slide = useAnimatedValue(selectedIndex);
  const itemWidth = barWidth / tabs.length;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: selectedIndex,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, slide]);

  const onLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      testID="tab-bar"
      onLayout={onLayout}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.space.sm) }]}
    >
      {barWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicatorSlot,
            { width: itemWidth },
            {
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, tabs.length - 1],
                    outputRange: [0, itemWidth * (tabs.length - 1)],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.indicator} />
        </Animated.View>
      ) : null}
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const color: IconColor = selected ? 'onNavy' : 'onNavyMuted';

        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={styles.item}
          >
            <Icon name={tab.icon} size={20} color={color} />
            <AppText
              variant="caption"
              style={{ color: selected ? theme.colors.onNavy : theme.colors.onNavyMuted }}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.navy,
    paddingTop: theme.space.sm,
  },
  indicatorSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
  },
  indicator: {
    width: 20,
    height: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.onNavy,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: theme.space.xs,
  },
});
