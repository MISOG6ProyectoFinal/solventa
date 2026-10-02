import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../../../../shared/theme';
import { AppText, Screen } from '../../../../shared/ui';
import { catalog } from '../../catalog';

export default function ComponentsScreen() {
  const navigation = useNavigation();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {catalog.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            style={styles.row}
            onPress={() => navigation.navigate('Component', { id: item.id })}
          >
            <AppText variant="body">{item.title}</AppText>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
  row: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
});
