import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type ThumbnailProps = {
  name: string;
  size: string;
  testID?: string;
};

export function Thumbnail({ name, size, testID }: ThumbnailProps) {
  return (
    <View style={styles.item}>
      <View testID={testID} style={styles.preview} />
      <AppText variant="body">{name}</AppText>
      <AppText variant="caption">{size}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    alignSelf: 'flex-start',
    gap: theme.space.xs,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
