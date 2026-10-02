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

  return {
    View: host('View'),
    Text: host('Text'),
    Pressable: host('Pressable'),
    StatusBar: () => null,
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
