import { Image, View } from 'react-native';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';

import { Button, Screen } from '../../../../shared/ui';
import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import { photoUri } from '../../photoUtils';
import { texts } from '../../texts';
import styles from './styles';

type Props = StaticScreenProps<{
  filePath: string;
}>;

export default function PhotoPreviewScreen({ route }: Props) {
  const navigation = useNavigation();
  const photo = useClaimPhotosStore((state) =>
    state.photos.find((item) => item.filePath === route.params.filePath),
  );
  const removePhoto = useClaimPhotosStore((state) => state.removePhoto);

  const remove = () => {
    if (!photo) {
      return;
    }

    removePhoto(photo.filePath);
    navigation.goBack();
  };

  return (
    <Screen
      testID="photo-preview-screen"
      header={{ title: texts.savedPhoto.screenTitle, subtitle: photo?.label }}
    >
      {photo ? (
        <View style={styles.body}>
          <View style={styles.frame}>
            <Image
              testID="photo-preview"
              style={styles.photo}
              resizeMode="contain"
              source={{ uri: photoUri(photo.filePath) }}
            />
          </View>
          <Button title={texts.savedPhoto.removeButton} variant="danger" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}
