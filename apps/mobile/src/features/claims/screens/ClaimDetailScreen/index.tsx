import { ScrollView, View } from 'react-native';
import { StaticScreenProps } from '@react-navigation/native';

import { AppText, Banner, Button, Card, Screen, StatusChip } from '../../../../shared/ui';
import { texts } from '../../texts';
import styles from './styles';

export type FiledReport = {
  radicado: string;
  claimType: string;
  policy: string;
  occurredAt: string;
  location: string;
  description: string;
  evidences: { label: string; capturedAt: string; }[];
};

type Props = StaticScreenProps<FiledReport>;

export default function ClaimDetailScreen({ route }: Props) {
  const report = route.params;

  return (
    <Screen testID="claim-detail-screen" header={{ title: texts.detail.screenTitle }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Banner variant="success">{texts.detail.filedSuccess(report.radicado)}</Banner>
        <Card>
          <View style={styles.titleRow}>
            <AppText variant="button" style={styles.title}>
              {report.claimType}
            </AppText>
            <StatusChip variant="success">{texts.detail.status}</StatusChip>
          </View>
          <AppText variant="bodySmall">{report.policy}</AppText>
          <AppText variant="bodySmall">{texts.detail.occurred(report.occurredAt, report.location)}</AppText>
          <AppText variant="bodySmall" style={styles.description}>
            {report.description}
          </AppText>
        </Card>
        <Card>
          <AppText variant="button" style={styles.title}>
            {texts.detail.evidences(report.evidences.length)}
          </AppText>
          <View style={styles.thumbs}>
            {report.evidences.map((evidence) => (
              <View key={evidence.label} style={styles.thumb}>
                <AppText variant="caption" style={styles.thumbLabel}>
                  {evidence.label}
                </AppText>
                <AppText variant="caption" style={styles.thumbTime}>
                  {evidence.capturedAt}
                </AppText>
              </View>
            ))}
          </View>
        </Card>
        <Button title={texts.detail.assistButton} variant="secondary" />
      </ScrollView>
    </Screen>
  );
}
