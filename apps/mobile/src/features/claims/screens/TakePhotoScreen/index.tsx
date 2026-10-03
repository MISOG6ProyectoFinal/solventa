import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { AppText, Button, Screen } from '../../../../shared/ui';
import { useLocation } from '../../../../shared/useLocation';
import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import { photoUri } from '../../photoUtils';
import { texts } from '../../texts';
import styles from './styles';

type CapturedPhoto = {
  filePath: string;
  bytes: number;
};

export default function TakePhotoScreen() {
  const navigation = useNavigation();
  const photoOutput = usePhotoOutput();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const { location, failed: locationFailed } = useLocation();
  const addPhoto = useClaimPhotosStore((state) => state.addPhoto);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const capture = async () => {
    const photo = await photoOutput.capturePhoto({}, {});

    try {
      const data = await photo.getFileDataAsync();
      const filePath = await photo.saveToTemporaryFileAsync();
      setCaptured({ filePath, bytes: data.byteLength });
    } finally {
      photo.dispose();
    }
  };

  const confirm = () => {
    if (!captured) {
      return;
    }

    addPhoto(captured);
    navigation.goBack();
  };

  return (
    <Screen testID="take-photo-screen" header={{ title: captured ? texts.camera.previewTitle : texts.camera.screenTitle }}>
      <View style={styles.body}>
        <View style={styles.preview}>
          {captured ? (
            <Image testID="photo-preview" style={styles.photo} source={{ uri: photoUri(captured.filePath) }} />
          ) : (
            <>
              {hasPermission ? (
                <Camera
                  testID="camera-preview"
                  style={styles.camera}
                  device="back"
                  isActive
                  outputs={[photoOutput]}
                />
              ) : null}
              <View pointerEvents="none" style={styles.overlay}>
                <AppText variant="subtitle" style={styles.cameraLabel}>
                  {texts.camera.viewfinderLabel}
                </AppText>
                <AppText variant="bodySmall" style={styles.hint}>
                  {texts.camera.framingHint}
                </AppText>
                <AppText variant="caption" style={styles.gps}>
                  {location?.gps ??
                    (locationFailed ? texts.report.locationUnavailable : texts.report.locationPending)}
                </AppText>
              </View>
            </>
          )}
        </View>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              title={texts.camera.cancelButton}
              variant="outlined"
              onPress={() => (captured ? setCaptured(null) : navigation.goBack())}
            />
          </View>
          <View style={styles.action}>
            {captured ? (
              <Button title={texts.camera.confirmButton} variant="accent" onPress={confirm} />
            ) : (
              <Button title={texts.camera.captureButton} variant="accent" onPress={capture} />
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}
