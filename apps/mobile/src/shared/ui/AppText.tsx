import { Text as NativeText, TextProps as NativeTextProps } from 'react-native';

import { theme } from '../theme';

type AppTextVariant = keyof typeof theme.type;

type AppTextProps = NativeTextProps & {
  variant?: AppTextVariant;
};

export function AppText({ variant = 'body', style, ...rest }: AppTextProps) {
  return <NativeText {...rest} style={[theme.type[variant], style]} />;
}
