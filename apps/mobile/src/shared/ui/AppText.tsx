import { Text as NativeText, TextProps as NativeTextProps } from 'react-native';

import { theme } from '../theme';

type AppTextVariant = keyof typeof theme.type;

type AppTextProps = NativeTextProps & {
  variant?: AppTextVariant;
};

const headingVariants: AppTextVariant[] = ['screenTitle', 'sectionTitle'];

export function AppText({ variant = 'body', style, accessibilityRole, ...rest }: AppTextProps) {
  const role = accessibilityRole ?? (headingVariants.includes(variant) ? 'header' : undefined);

  return <NativeText {...rest} accessibilityRole={role} style={[theme.type[variant], style]} />;
}
