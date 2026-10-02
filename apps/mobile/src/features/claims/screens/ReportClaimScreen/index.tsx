import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  AppText,
  Button,
  Card,
  DateField,
  Screen,
  SelectField,
  TextField,
} from '../../../../shared/ui';
import { claimReport } from '../../claimReport';
import styles from './styles';

export default function ReportClaimScreen() {
  const navigation = useNavigation();
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const descriptionMissing = submitted && description.trim() === '';

  return (
    <Screen testID="report-claim-screen" withHeader>
      <AppHeader
        variant="flow"
        title={claimReport.title}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Card>
          <SelectField label={claimReport.policyLabel} value={claimReport.policy} required />
          <SelectField label={claimReport.typeLabel} value={claimReport.type} required />
          <DateField label={claimReport.occurredAtLabel} value={claimReport.occurredAt} required />
          <View>
            <AppText variant="label" style={styles.locationLabel}>
              {claimReport.locationLabel}
            </AppText>
            <AppText variant="bodySmall" style={styles.address}>
              {claimReport.address}
            </AppText>
            <AppText variant="bodySmall" style={styles.detail}>
              {claimReport.gps}
            </AppText>
          </View>
          <TextField
            label={claimReport.descriptionLabel}
            value={description}
            onChangeText={setDescription}
            placeholder={claimReport.descriptionPlaceholder}
            multiline
            required
            error={descriptionMissing}
          />
        </Card>
        <Card>
          <View style={styles.evidenceHeader}>
            <AppText variant="button" style={styles.evidenceTitle}>
              {claimReport.evidenceTitle}
            </AppText>
            <AppText variant="caption">{claimReport.evidenceCount}</AppText>
          </View>
          <AppText variant="bodySmall" style={styles.evidenceHint}>
            {claimReport.evidenceHint}
          </AppText>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title={claimReport.takePhoto} variant="outlined" />
            </View>
            <View style={styles.action}>
              <Button title={claimReport.recordVideo} variant="outlined" />
            </View>
          </View>
          {submitted ? (
            <AppText variant="caption" style={styles.evidenceError}>
              {claimReport.evidenceError}
            </AppText>
          ) : null}
        </Card>
        <Button title={claimReport.submit} onPress={() => setSubmitted(true)} />
      </ScrollView>
    </Screen>
  );
}
