import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type ThumbnailProps = {
  name: string;
  size: string;
  testID?: string;
};

export function Thumbnail({ name, size, testID }: ThumbnailProps) {
  return (
    <View style={styles.item}>
      <View testID={testID} style={styles.preview} />
      <Text style={theme.type.body}>{name}</Text>
      <Text style={theme.type.caption}>{size}</Text>
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
