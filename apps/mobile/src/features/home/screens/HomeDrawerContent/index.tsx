import { View } from 'react-native';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';

import { AppText, Button } from '../../../../shared/ui';
import { useSessionStore } from '../../../session/store/useSessionStore';
import { useTexts } from '../../texts';
import styles from './styles';

function displayName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter((part) => part).join(' ');
}

export default function HomeDrawerContent(props: Readonly<DrawerContentComponentProps>) {
  const texts = useTexts();
  const firstName = useSessionStore((state) => state.firstName);
  const lastName = useSessionStore((state) => state.lastName);
  const email = useSessionStore((state) => state.email);
  const signOut = useSessionStore((state) => state.signOut);
  const name = displayName(firstName, lastName);
  const rootNavigation = useNavigation();
  const leave = async () => {
    await signOut();
  };
  const openSettings = () => {
    props.navigation.closeDrawer();
    rootNavigation.navigate('Settings');
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.content}>
      <View style={styles.profile}>
        {name ? <AppText variant="subtitle">{name}</AppText> : null}
        {email ? <AppText variant="bodySmall">{email}</AppText> : null}
      </View>
      <View style={styles.footer}>
        <Button title={texts.home.settingsButton} variant="secondary" icon="ajustes" onPress={openSettings} />
        <Button title={texts.home.signOutButton} variant="secondary" onPress={() => void leave()} />
      </View>
    </DrawerContentScrollView>
  );
}
