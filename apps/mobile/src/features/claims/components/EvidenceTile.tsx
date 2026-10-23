import { type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { theme } from '../../../shared/theme';
import { outfitFont } from '../../../shared/theme/fonts';
import { AppText } from '../../../shared/ui';
import { formatFileSize } from '../photo';

type EvidenceTileProps = {
  label: string;
  bytes: number;
  onPress: () => void;
  children: ReactNode;
};

// The preview is an image or a video icon, which the shared Thumbnail cannot show.
export function EvidenceTile({ label, bytes, onPress, children }: Readonly<EvidenceTileProps>) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.tile} onPress={onPress}>
      {children}
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="caption" style={styles.size}>
        {formatFileSize(bytes)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    padding: theme.space.sm,
    gap: theme.space.xs,
  },
  label: {
    color: theme.colors.text,
    fontSize: 10,
    lineHeight: 14,
    ...outfitFont('400'),
  },
  size: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    ...outfitFont('400'),
  },
});
