import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Camera,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
  type Recorder,
} from 'react-native-vision-camera';

import { AppText, Banner, Button, Screen, VideoPlayer } from '../../../../shared/ui';
import { useLocation } from '../../../../shared/useLocation';
import { maxEvidenceBytes, videoMaxDuration, videoTargetBitRate } from '../../constants';
import { formatFileSize, photoUri } from '../../photoUtils';
import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import { texts } from '../../texts';
import styles from './styles';

type CapturedVideo = {
  filePath: string;
  bytes: number;
};

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

export default function RecordVideoScreen() {
  const navigation = useNavigation();
  // iOS defaults to mov. The report only accepts MP4.
  const videoOutput = useVideoOutput({
    enableAudio: true,
    targetBitRate: videoTargetBitRate,
    fileType: 'mp4',
  });
  const { hasPermission, requestPermission } = useCameraPermission();
  const { hasPermission: hasMicrophone, requestPermission: requestMicrophone } = useMicrophonePermission();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [captured, setCaptured] = useState<CapturedVideo | null>(null);
  const [tooLarge, setTooLarge] = useState(false);
  const recorderRef = useRef<Recorder | null>(null);
  const { location, failed: locationFailed } = useLocation();
  const addVideo = useClaimPhotosStore((state) => state.addVideo);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
    if (!hasMicrophone) {
      requestMicrophone();
    }
  }, [hasMicrophone, hasPermission, requestMicrophone, requestPermission]);

  useEffect(() => {
    const recorder = recorderRef.current;
    if (!recording || !recorder) {
      return;
    }

    const timer = setInterval(() => {
      setElapsed(recorder.recordedDuration);
    }, 200);

    return () => {
      clearInterval(timer);
    };
  }, [recording]);

  const start = async () => {
    const recorder = await videoOutput.createRecorder({ maxDuration: videoMaxDuration });
    recorderRef.current = recorder;
    setElapsed(0);
    await recorder.startRecording(
      (filePath) => {
        setCaptured({ filePath, bytes: recorder.recordedFileSize });
        setRecording(false);
      },
      () => {
        setRecording(false);
      },
    );
    setRecording(true);
  };

  const stop = async () => {
    await recorderRef.current?.stopRecording();
  };

  const cancel = async () => {
    if (captured) {
      setCaptured(null);
      setTooLarge(false);
      return;
    }

    if (recording) {
      await recorderRef.current?.cancelRecording();
    }

    navigation.goBack();
  };

  const confirm = () => {
    if (!captured) {
      return;
    }

    if (captured.bytes > maxEvidenceBytes) {
      setTooLarge(true);
      return;
    }

    addVideo(captured);
    navigation.goBack();
  };

  return (
    <Screen
      testID="record-video-screen"
      header={{ title: captured ? texts.video.previewTitle : texts.video.screenTitle }}
    >
      <View style={styles.body}>
        <View style={styles.preview}>
          {captured ? (
            <VideoPlayer
              testID="video-preview"
              uri={photoUri(captured.filePath)}
              playLabel={texts.video.playButton}
              pauseLabel={texts.video.pauseButton}
              caption={formatFileSize(captured.bytes)}
            />
          ) : (
            <>
              {hasPermission ? (
                <View style={styles.camera}>
                  <Camera style={styles.camera} device="back" isActive outputs={[videoOutput]} />
                </View>
              ) : null}
              <View pointerEvents="none" style={styles.overlay}>
                <AppText variant="bodySmall" style={styles.hint}>
                  {recording
                    ? `${formatDuration(elapsed)} / ${formatDuration(videoMaxDuration)}`
                    : texts.video.durationLimit}
                </AppText>
                <AppText variant="caption" style={styles.gps}>
                  {location?.gps ??
                    (locationFailed ? texts.report.locationUnavailable : texts.report.locationPending)}
                </AppText>
              </View>
            </>
          )}
        </View>
        {tooLarge ? <Banner variant="error">{texts.report.fileTooLarge}</Banner> : null}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button title={texts.video.cancelButton} variant="outlined" onPress={cancel} />
          </View>
          <View style={styles.action}>
            {captured ? (
              <Button title={texts.video.confirmButton} variant="accent" onPress={confirm} />
            ) : (
              <Button
                title={recording ? texts.video.stopButton : texts.video.recordButton}
                variant="accent"
                onPress={recording ? stop : start}
              />
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}
