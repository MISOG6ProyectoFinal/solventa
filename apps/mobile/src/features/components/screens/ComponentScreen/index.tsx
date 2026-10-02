import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StaticScreenProps } from '@react-navigation/native';

import { theme } from '../../../../shared/theme';
import { AppHeader, AppText, OptionList, Screen, Switch, TextField } from '../../../../shared/ui';
import { findComponent, PlaygroundValues } from '../../catalog';

type Props = StaticScreenProps<{
  id: string;
}>;

export default function ComponentScreen({ route }: Props) {
  const item = findComponent(route.params.id);
  const [values, setValues] = useState<PlaygroundValues>(item?.initial ?? {});

  useEffect(() => {
    setValues(item?.initial ?? {});
  }, [item]);

  const update = (key: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  if (!item) {
    return (
      <Screen withHeader>
        <AppHeader title="Componente" />
        <AppText variant="body">No se encontró el componente</AppText>
      </Screen>
    );
  }

  return (
    <Screen withHeader>
      <AppHeader title={item.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.preview}>{item.render(values, update)}</View>
        {item.fields.length > 0 ? <AppText variant="subtitle">Propiedades</AppText> : null}
        {item.fields.map((field) => {
          if (field.kind === 'text') {
            return (
              <TextField
                key={field.key}
                label={field.label}
                value={String(values[field.key] ?? '')}
                onChangeText={(value) => update(field.key, value)}
              />
            );
          }

          if (field.kind === 'switch') {
            return (
              <View key={field.key} style={styles.switchRow}>
                <AppText variant="body">{field.label}</AppText>
                <Switch
                  value={Boolean(values[field.key])}
                  onValueChange={(value) => update(field.key, value)}
                />
              </View>
            );
          }

          return (
            <View key={field.key} style={styles.choice}>
              <AppText variant="label">{field.label}</AppText>
              <OptionList
                options={field.options}
                value={String(values[field.key] ?? '')}
                onChange={(id) => update(field.key, id)}
              />
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.space.lg,
    gap: theme.space.lg,
  },
  preview: {
    gap: theme.space.md,
  },
  choice: {
    gap: theme.space.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
