import { View } from 'react-native';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';

import { AppText, Button } from '../../../../shared/ui';
import { useSessionStore } from '../../../session/store/useSessionStore';
import { texts } from '../../texts';
import styles from './styles';

function displayName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter((part) => part).join(' ');
}

export default function HomeDrawerContent(props: DrawerContentComponentProps) {
  const firstName = useSessionStore((state) => state.firstName);
  const lastName = useSessionStore((state) => state.lastName);
  const email = useSessionStore((state) => state.email);
  const signOut = useSessionStore((state) => state.signOut);
  const name = displayName(firstName, lastName);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.content}>
      <View style={styles.profile}>
        {name ? <AppText variant="subtitle">{name}</AppText> : null}
        {email ? <AppText variant="bodySmall">{email}</AppText> : null}
      </View>
      <View style={styles.signOut}>
        <Button title={texts.home.signOutButton} variant="secondary" onPress={() => void signOut()} />
      </View>
    </DrawerContentScrollView>
  );
}
