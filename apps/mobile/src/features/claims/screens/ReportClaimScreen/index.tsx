import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AppText,
  Banner,
  Button,
  Card,
  DateField,
  Icon,
  IconButton,
  Screen,
  SelectField,
  TextField,
} from '../../../../shared/ui';
import { useLocation } from '../../../../shared/useLocation';
import { claimReport } from '../../claimReport';
import { EvidenceTile } from '../../components/EvidenceTile';
import { photoLimit } from '../../constants';
import { photoUri } from '../../photo';
import { useClaimsStore } from '../../store/useClaimsStore';
import { texts } from '../../texts';
import styles from './styles';
import { useReportForm } from './useReportForm';
import { useSubmitReport } from './useSubmitReport';

export default function ReportClaimScreen() {
  const navigation = useNavigation();
  const form = useReportForm();
  const { policy, claimType, occurredAt, description, restoredAddress } = form;
  const [limitReached, setLimitReached] = useState(false);
  const { location, failed: locationFailed, refresh } = useLocation();
  const photos = useClaimsStore((state) => state.photos);
  const videos = useClaimsStore((state) => state.videos);
  const evidenceCount = photos.length + videos.length;
  const address = restoredAddress ?? location?.address ?? '';
  const { submit, submitted, filing, sendError } = useSubmitReport({
    policy,
    claimType,
    occurredAt,
    description,
    address,
  });
  const descriptionMissing = submitted && description.trim() === '';
  const evidenceMissing = submitted && evidenceCount === 0;

  const openCamera = (screen: 'TakePhoto' | 'RecordVideo') => {
    if (evidenceCount >= photoLimit) {
      setLimitReached(true);
      return;
    }

    navigation.navigate('ClaimReport', { screen });
  };

  return (
    <Screen testID="report-claim-screen" header={{ title: texts.report.screenTitle }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card>
          <SelectField
            label={texts.report.policyLabel}
            value={policy}
            options={claimReport.policies}
            onChange={form.setPolicy}
            required
          />
          <SelectField
            label={texts.report.claimTypeLabel}
            value={claimType}
            options={claimReport.claimTypes}
            onChange={form.setClaimType}
            required
          />
          <DateField
            label={texts.report.occurredAtLabel}
            value={occurredAt}
            onChange={form.setOccurredAt}
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
                onPress={() => {
                  form.setRestoredAddress(null);
                  refresh();
                }}
              />
            </View>
            <AppText variant="bodySmall" style={styles.address}>
              {address !== ''
                ? address
                : locationFailed
                  ? texts.report.locationUnavailable
                  : texts.report.locationPending}
            </AppText>
            {location && restoredAddress == null ? (
              <AppText variant="bodySmall" style={styles.detail}>
                {location.gps}
              </AppText>
            ) : null}
          </View>
          <TextField
            label={texts.report.descriptionLabel}
            value={description}
            onChangeText={form.setDescription}
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
              {`${evidenceCount}/${photoLimit}`}
            </AppText>
          </View>
          <AppText variant="bodySmall" style={styles.evidenceHint}>
            {texts.report.evidenceHint}
          </AppText>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title={texts.report.takePhotoButton} variant="outlined" onPress={() => openCamera('TakePhoto')} />
            </View>
            <View style={styles.action}>
              <Button
                title={texts.report.recordVideoButton}
                variant="outlined"
                onPress={() => openCamera('RecordVideo')}
              />
            </View>
          </View>
          {limitReached ? <Banner variant="error">{texts.report.evidenceLimit}</Banner> : null}
          {evidenceCount > 0 ? (
            <View style={styles.thumbs}>
              {photos.map((photo) => (
                <EvidenceTile
                  key={photo.filePath}
                  label={photo.label}
                  bytes={photo.bytes}
                  onPress={() =>
                    navigation.navigate('ClaimReport', {
                      screen: 'PhotoPreview',
                      params: { filePath: photo.filePath },
                    })
                  }
                >
                  <Image testID="evidence-photo" style={styles.thumbPhoto} source={{ uri: photoUri(photo.filePath) }} />
                </EvidenceTile>
              ))}
              {videos.map((video) => (
                <EvidenceTile
                  key={video.filePath}
                  label={video.label}
                  bytes={video.bytes}
                  onPress={() =>
                    navigation.navigate('ClaimReport', {
                      screen: 'VideoPreview',
                      params: { filePath: video.filePath },
                    })
                  }
                >
                  <View style={styles.thumbVideo}>
                    <Icon name="video" size={24} color="primary" />
                  </View>
                </EvidenceTile>
              ))}
            </View>
          ) : null}
          {evidenceMissing ? (
            <AppText variant="caption" style={styles.evidenceError}>
              {texts.report.missingEvidence}
            </AppText>
          ) : null}
        </Card>
        {sendError ? <Banner variant="error">{sendError}</Banner> : null}
        <Button
          testID="submit-report"
          title={texts.report.submitButton}
          loading={filing}
          onPress={() => {
            void submit();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
