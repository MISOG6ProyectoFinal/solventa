import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AppText,
  Button,
  Card,
  DateField,
  IconButton,
  Screen,
  SelectField,
  TextField,
} from '../../../../shared/ui';
import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import { formatFileSize, photoUri } from '../../photoUtils';
import { claimReport } from '../../claimReport';
import { useLocation } from '../../../../shared/useLocation';
import { texts } from '../../texts';
import styles from './styles';

export default function ReportClaimScreen() {
  const navigation = useNavigation();
  const [policy, setPolicy] = useState(claimReport.policy);
  const [claimType, setClaimType] = useState(claimReport.claimType);
  const [occurredAt, setOccurredAt] = useState(claimReport.occurredAt);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { location, failed: locationFailed, refresh } = useLocation();
  const photos = useClaimPhotosStore((state) => state.photos);
  const clearPhotos = useClaimPhotosStore((state) => state.clear);
  const descriptionMissing = submitted && description.trim() === '';
  const evidenceMissing = submitted && photos.length === 0;

  useEffect(() => {
    return () => {
      clearPhotos();
    };
  }, [clearPhotos]);

  return (
    <Screen testID="report-claim-screen" header={{ title: texts.report.screenTitle }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card>
          <SelectField
            label={texts.report.policyLabel}
            value={policy}
            options={claimReport.policies}
            onChange={setPolicy}
            required
          />
          <SelectField
            label={texts.report.claimTypeLabel}
            value={claimType}
            options={claimReport.claimTypes}
            onChange={setClaimType}
            required
          />
          <DateField
            label={texts.report.occurredAtLabel}
            value={occurredAt}
            onChange={setOccurredAt}
            required
            timeSelection
          />
          <View>
            <View style={styles.locationHeader}>
              <AppText variant="label" style={styles.locationLabel}>
                {texts.report.locationLabel}
              </AppText>
              <IconButton
                label={texts.report.refreshLocation}
                icon="sincronizar"
                color="primary"
                onPress={refresh}
              />
            </View>
            <AppText variant="bodySmall" style={styles.address}>
              {location?.address ??
                (locationFailed ? texts.report.locationUnavailable : texts.report.locationPending)}
            </AppText>
            {location ? (
              <AppText variant="bodySmall" style={styles.detail}>
                {location.gps}
              </AppText>
            ) : null}
          </View>
          <TextField
            label={texts.report.descriptionLabel}
            value={description}
            onChangeText={setDescription}
            placeholder={texts.report.descriptionPlaceholder}
            multiline
            required
            error={descriptionMissing}
          />
        </Card>
        <Card>
          <View style={styles.evidenceHeader}>
            <AppText variant="button" style={styles.evidenceTitle}>
              {texts.report.evidenceHeading}
            </AppText>
            <AppText variant="caption" style={styles.evidenceCount}>
              {`${photos.length}/10`}
            </AppText>
          </View>
          <AppText variant="bodySmall" style={styles.evidenceHint}>
            {texts.report.evidenceHint}
          </AppText>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title={texts.report.takePhotoButton} variant="outlined" onPress={() => navigation.navigate('ClaimReport', { screen: 'TakePhoto' })} />
            </View>
            <View style={styles.action}>
              <Button title={texts.report.recordVideoButton} variant="outlined" />
            </View>
          </View>
          {photos.length > 0 ? (
            <View style={styles.thumbs}>
              {photos.map((photo) => (
                <Pressable
                  key={photo.filePath}
                  accessibilityRole="button"
                  accessibilityLabel={photo.label}
                  style={styles.thumb}
                  onPress={() =>
                    navigation.navigate('ClaimReport', {
                      screen: 'PhotoPreview',
                      params: { filePath: photo.filePath },
                    })
                  }
                >
                  <Image
                    testID="evidence-photo"
                    style={styles.thumbPhoto}
                    source={{ uri: photoUri(photo.filePath) }}
                  />
                  <AppText variant="caption" style={styles.thumbLabel}>
                    {photo.label}
                  </AppText>
                  <AppText variant="caption" style={styles.thumbSize}>
                    {formatFileSize(photo.bytes)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
          {evidenceMissing ? (
            <AppText variant="caption" style={styles.evidenceError}>
              {texts.report.missingEvidence}
            </AppText>
          ) : null}
        </Card>
        <Button title={texts.report.submitButton} onPress={() => setSubmitted(true)} />
      </ScrollView>
    </Screen>
  );
}
