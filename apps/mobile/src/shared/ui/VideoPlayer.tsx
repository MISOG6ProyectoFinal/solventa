import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Video, { type VideoRef } from 'react-native-video';

import { theme } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type VideoPlayerProps = {
  uri: string;
  playLabel: string;
  pauseLabel: string;
  caption?: string;
  testID?: string;
};

export function VideoPlayer({ uri, playLabel, pauseLabel, caption, testID }: VideoPlayerProps) {
  const videoRef = useRef<VideoRef>(null);
  const finished = useRef(false);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }

    if (finished.current) {
      videoRef.current?.seek(0);
      finished.current = false;
    }

    setPlaying(true);
  };

  return (
    <View style={styles.player}>
      <Video
        ref={videoRef}
        testID={testID}
        source={{ uri }}
        style={styles.video}
        resizeMode="contain"
        paused={!playing}
        ignoreSilentSwitch="ignore"
        onEnd={() => {
          finished.current = true;
          setPlaying(false);
        }}
      />
      <View pointerEvents="box-none" style={styles.control}>
        <View style={styles.badge}>
          <IconButton
            label={playing ? pauseLabel : playLabel}
            icon={playing ? 'pausar' : 'reproducir'}
            color="onNavy"
            onPress={toggle}
          />
        </View>
      </View>
      {caption ? (
        <View pointerEvents="none" style={styles.caption}>
          <AppText variant="bodySmall" style={styles.captionText}>
            {caption}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  player: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  control: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.navy,
  },
  caption: {
    position: 'absolute',
    left: theme.space.lg,
    right: theme.space.lg,
    bottom: theme.space.md,
    alignItems: 'center',
  },
  captionText: {
    color: theme.colors.onNavy,
    textAlign: 'center',
  },
});
