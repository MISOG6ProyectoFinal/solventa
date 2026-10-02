import { theme } from '../theme';
import { icons, type IconName } from './icons';

export type IconColor =
  | 'dark'
  | 'gray'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'warning'
  | 'error'
  | 'onNavy'
  | 'onNavyMuted';

type IconSize = 16 | 20 | 24 | 32;

type IconProps = {
  name: IconName;
  size?: IconSize;
  color?: IconColor;
  accessibilityLabel?: string;
  testID?: string;
};

const stroke: Record<IconColor, string> = {
  dark: theme.colors.text,
  gray: theme.colors.textMuted,
  primary: theme.colors.navy,
  secondary: theme.colors.blue,
  accent: theme.colors.teal,
  warning: theme.colors.warningSolid,
  error: theme.colors.danger,
  onNavy: theme.colors.onNavy,
  onNavyMuted: theme.colors.onNavyMuted,
};

export function Icon({
  name,
  size = 24,
  color = 'dark',
  accessibilityLabel,
  testID,
}: IconProps) {
  const Glyph = icons[name];

  return (
    <Glyph
      size={size}
      color={stroke[color]}
      strokeWidth={1.5}
      testID={testID}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={accessibilityLabel == null}
      importantForAccessibility={accessibilityLabel == null ? 'no-hide-descendants' : 'yes'}
    />
  );
}

export type { IconName };
