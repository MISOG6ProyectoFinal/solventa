import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';

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
import { photoLimit } from '../../constants';
import { useClaimsStore } from '../../store/useClaimsStore';
import { formatFileSize, photoUri } from '../../photo';
import { claimReport } from '../../claimReport';
import { SubmitAvisoError, submitAviso } from '../../api/submitAviso';
import { deleteReport } from '../../offline/deleteReport';
import { listReports } from '../../offline/listReports';
import { saveReport } from '../../offline/saveReport';
import { errorMessage } from '../../../../shared/api/client';
import { useLocation } from '../../../../shared/useLocation';
import { texts } from '../../texts';
import styles from './styles';
import { displayOccurredAt, formatDate, fromIsoOccurredAt } from '../../utils';

export default function ReportClaimScreen() {
  const navigation = useNavigation();
  const [policy, setPolicy] = useState(claimReport.policy);
  const [claimType, setClaimType] = useState(claimReport.claimType);
  const [occurredAt, setOccurredAt] = useState(() => formatDate(new Date()));
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [filing, setFiling] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [restoredAddress, setRestoredAddress] = useState<string | null>(null);
  const { location, failed: locationFailed, refresh } = useLocation();
  const photos = useClaimsStore((state) => state.photos);
  const videos = useClaimsStore((state) => state.videos);
  const evidenceCount = photos.length + videos.length;
  const descriptionMissing = submitted && description.trim() === '';
  const evidenceMissing = submitted && evidenceCount === 0;
  const address = restoredAddress ?? location?.address ?? '';

  const submit = async () => {
    const files = [
      ...photos.map((photo) => ({
        kind: 'photo' as const,
        filePath: photo.filePath,
        bytes: photo.bytes,
        capturedAt: photo.capturedAt,
      })),
      ...videos.map((video) => ({
        kind: 'video' as const,
        filePath: video.filePath,
        bytes: video.bytes,
        capturedAt: video.capturedAt,
      })),
    ];
    setSubmitted(true);
    setSendError(null);
    if (description.trim() === '' || files.length === 0) {
      return;
    }

    setFiling(true);
    try {
      const filed = await submitAviso({
        policy,
        claimType,
        occurredAt,
        location: address,
        description: description.trim(),
        files,
      });
      await deleteReport();
      navigation.dispatch(
        StackActions.replace('ClaimReport', {
          screen: 'ClaimDetail',
          params: {
            radicado: filed.radicado,
            claimType,
            policy,
            occurredAt: displayOccurredAt(occurredAt),
            location: address,
            description: description.trim(),
            evidences: [...photos, ...videos].map((item) => ({
              label: item.label,
              capturedAt: item.capturedAt,
            })),
          },
        }),
      );
    } catch (error) {
      if (error instanceof SubmitAvisoError && !error.avisoCreated) {
        try {
          await saveReport({
            policy,
            claimType,
            occurredAt,
            location: address,
            description: description.trim(),
            files,
          });
          navigation.navigate('Main', { screen: 'Claims' });
          return;
        } catch (saveError) {
          setSendError(errorMessage(saveError, texts.report.sendFailed));
          return;
        }
      }
      const cause = error instanceof SubmitAvisoError ? error.cause : error;
      setSendError(errorMessage(cause, texts.report.sendFailed));
    } finally {
      setFiling(false);
    }
  };

  const openCamera = (screen: 'TakePhoto' | 'RecordVideo') => {
    if (evidenceCount >= photoLimit) {
      setLimitReached(true);
      return;
    }

    navigation.navigate('ClaimReport', { screen });
  };

  useEffect(() => {
    let active = true;
    listReports().then((reports) => {
      if (!active) {
        return;
      }
      const saved = reports[0];
      if (!saved) {
        return;
      }
      const policyMatch = claimReport.policies.find((option) => option.value.split(' · ').pop() === saved.poliza_id);
      setPolicy(policyMatch?.value ?? saved.poliza_id);
      setClaimType(saved.tipo);
      setOccurredAt(fromIsoOccurredAt(saved.ocurrido_en));
      setDescription(saved.descripcion);
      if (saved.ubicacion) {
        setRestoredAddress(saved.ubicacion);
      }
      useClaimsStore.getState().replaceEvidence(saved.files);
    });
    return () => {
      active = false;
      useClaimsStore.getState().clear();
    };
  }, []);

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
                onPress={() => {
                  setRestoredAddress(null);
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
              {videos.map((video) => (
                <Pressable
                  key={video.filePath}
                  accessibilityRole="button"
                  accessibilityLabel={video.label}
                  style={styles.thumb}
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
                  <AppText variant="caption" style={styles.thumbLabel}>
                    {video.label}
                  </AppText>
                  <AppText variant="caption" style={styles.thumbSize}>
                    {formatFileSize(video.bytes)}
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
