jest.mock('react-native', () => {
  const React = require('react');

  const host = (name: string) => {
    return ({ children, ...props }: { children?: unknown }) =>
      React.createElement(name, props, children);
  };

  return {
    View: host('View'),
    Text: host('Text'),
    Button: ({ title, onPress }: { title: string; onPress?: () => void }) =>
      React.createElement('Button', { title, onPress }),
    StatusBar: () => null,
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      flatten: (style: unknown) => style,
      hairlineWidth: 1,
    },
    Platform: {
      OS: 'android',
      select: (options: { android?: unknown }) => options.android,
    },
  };
});
