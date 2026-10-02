jest.mock('react-native', () => {
  const React = require('react');

  const host = (name: string) => {
    return ({ children, ...props }: { children?: unknown }) =>
      React.createElement(name, props, children);
  };

  const flatten = (style: unknown): Record<string, unknown> => {
    if (Array.isArray(style)) {
      return style.reduce<Record<string, unknown>>(
        (merged, item) => ({ ...merged, ...flatten(item) }),
        {},
      );
    }
    if (style && typeof style === 'object') {
      return style as Record<string, unknown>;
    }
    return {};
  };

  class AnimatedValue {
    value: number;

    constructor(initialValue: number) {
      this.value = initialValue;
    }

    setValue(next: number) {
      this.value = next;
    }

    interpolate(config: { outputRange: string[] }) {
      const outputRange = config.outputRange;
      return this.value >= 1 ? outputRange[outputRange.length - 1] : outputRange[0];
    }
  }

  const startAnimation = { start: () => undefined };

  return {
    View: host('View'),
    Text: host('Text'),
    TextInput: host('TextInput'),
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    StatusBar: () => null,
    Animated: {
      View: host('Animated.View'),
      Text: host('Text'),
      Value: AnimatedValue,
      timing: () => startAnimation,
      spring: () => startAnimation,
    },
    Easing: {
      out: (easing: (value: number) => number) => easing,
      cubic: (value: number) => value,
    },
    useAnimatedValue: (initialValue: number) => {
      const ref = React.useRef(null);
      if (ref.current == null) {
        ref.current = new AnimatedValue(initialValue);
      }
      return ref.current;
    },
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      flatten,
      hairlineWidth: 1,
    },
    Platform: {
      OS: 'android',
      select: (options: { android?: unknown }) => options.android,
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');

  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement('SafeAreaView', props, children),
  };
});
