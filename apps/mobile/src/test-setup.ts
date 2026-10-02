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
    Modal: ({ children, visible, ...props }: { children?: unknown; visible?: boolean }) =>
      visible ? React.createElement('Modal', props, children) : null,
    StatusBar: () => null,
    Animated: {
      View: host('Animated.View'),
      Text: host('Text'),
      Value: AnimatedValue,
      timing: () => startAnimation,
      spring: () => startAnimation,
      createAnimatedComponent: (component: unknown) => component,
    },
    Easing: {
      in: (easing: (value: number) => number) => easing,
      out: (easing: (value: number) => number) => easing,
      inOut: (easing: (value: number) => number) => easing,
      cubic: (value: number) => value,
      linear: (value: number) => value,
      ease: (value: number) => value,
      poly: () => (value: number) => value,
      bezier: () => (value: number) => value,
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
    Dimensions: {
      get: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
      addEventListener: () => ({ remove: () => undefined }),
    },
    I18nManager: {
      getConstants: () => ({ isRTL: false }),
      allowRTL: () => undefined,
      forceRTL: () => undefined,
    },
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const host = (name: string) => {
    return ({ children, ...props }: { children?: unknown }) =>
      React.createElement(name, props, children);
  };
  const tags = ['Svg', 'Path', 'Circle', 'Rect', 'Line', 'Polyline', 'Polygon', 'Ellipse', 'G'];
  const api: Record<string, unknown> = { __esModule: true };

  for (const tag of tags) {
    api[tag] = host(tag);
  }

  api.default = api.Svg;
  return api;
});

jest.mock('react-native-screens', () => {
  const React = require('react');
  const View = ({ children, ...props }: { children?: unknown }) =>
    React.createElement('View', props, children);

  return {
    enableScreens: () => undefined,
    screensEnabled: () => false,
    Screen: View,
    ScreenContainer: View,
    NativeScreen: View,
    NativeScreenContainer: View,
    ScreenStack: View,
    ScreenStackItem: View,
    FullWindowOverlay: View,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };

  return {
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement('SafeAreaView', props, children),
    SafeAreaInsetsContext: React.createContext(insets),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets,
    },
    useSafeAreaInsets: () => insets,
  };
});

global.__DEV__ = true;
