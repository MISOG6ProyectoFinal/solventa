import { View } from 'react-native';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';

import { Button, Screen, VideoPlayer } from '../../../../shared/ui';
import { formatFileSize, photoUri } from '../../photo';
import { useClaimsStore } from '../../store/useClaimsStore';
import { texts } from '../../texts';
import styles from './styles';

type Props = StaticScreenProps<{
  filePath: string;
}>;

export default function VideoPreviewScreen({ route }: Props) {
  const navigation = useNavigation();
  const video = useClaimsStore((state) =>
    state.videos.find((item) => item.filePath === route.params.filePath),
  );
  const removeVideo = useClaimsStore((state) => state.removeVideo);

  const remove = () => {
    if (!video) {
      return;
    }

    removeVideo(video.filePath);
    navigation.goBack();
  };

  return (
    <Screen
      testID="video-preview-screen"
      header={{ title: texts.savedVideo.screenTitle, subtitle: video?.label }}
    >
      {video ? (
        <View style={styles.body}>
          <View style={styles.frame}>
            <VideoPlayer
              testID="video-preview"
              uri={photoUri(video.filePath)}
              playLabel={texts.savedVideo.playButton}
              pauseLabel={texts.savedVideo.pauseButton}
              caption={formatFileSize(video.bytes)}
            />
          </View>
          <Button title={texts.savedVideo.removeButton} variant="danger" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}
