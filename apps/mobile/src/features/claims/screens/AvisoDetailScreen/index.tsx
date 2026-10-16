import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StaticScreenProps } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { AppText, Banner, Button, Card, Screen, StatusChip } from '../../../../shared/ui';
import { listEvidencias, type Evidencia } from '../../api/listEvidencias';
import { type Aviso } from '../../api/listAvisos';
import { texts } from '../../texts';
import { formatOccurredAt } from '../../utils';
import styles from './styles';

type Props = StaticScreenProps<{ aviso: Aviso }>;

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${Math.round(bytes / 1_000_000)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function evidenceTiles(items: Evidencia[]): { id: string; label: string; size: string }[] {
  let photos = 0;
  let videos = 0;

  return items.map((item) => {
    const video = item.content_type.startsWith('video/');
    const count = video ? ++videos : ++photos;
    return {
      id: item.id,
      label: video ? `Video ${count}` : `Foto ${count}`,
      size: formatSize(item.bytes),
    };
  });
}

export default function AvisoDetailScreen({ route }: Props) {
  const aviso = route.params.aviso;
  const filed = aviso.estado === 'radicado';
  const [evidencias, setEvidencias] = useState<Evidencia[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listEvidencias(aviso.id)
      .then((items) => {
        if (!cancelled) {
          setEvidencias(items);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setEvidencias([]);
          setError(errorMessage(cause, texts.detail.evidencesFailed));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [aviso.id]);

  const tiles = evidenceTiles(evidencias ?? []);

  return (
    <Screen testID="aviso-detail-screen" header={{ title: texts.detail.screenTitle }}>
      {loading ? (
        <ActivityIndicator testID="aviso-detail-loading" style={styles.loading} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {filed ? <Banner variant="success">{texts.detail.filed}</Banner> : null}
          {error ? <Banner variant="error">{error}</Banner> : null}
          <Card>
            <View style={styles.titleRow}>
              <AppText variant="button" style={styles.title}>
                {aviso.tipo}
              </AppText>
              <StatusChip variant={filed ? 'success' : 'pending'}>
                {filed ? texts.detail.status : texts.claims.statusDraft}
              </StatusChip>
            </View>
            <AppText variant="bodySmall">{aviso.poliza_id}</AppText>
            <AppText variant="bodySmall">
              {texts.detail.occurred(formatOccurredAt(aviso.ocurrido_en), aviso.ubicacion ?? '')}
            </AppText>
            <AppText variant="bodySmall" style={styles.description}>
              {aviso.descripcion}
            </AppText>
          </Card>
          {evidencias ? (
            <Card>
              <AppText variant="button" style={styles.title}>
                {texts.detail.evidences(tiles.length)}
              </AppText>
              <View style={styles.thumbs}>
                {tiles.map((tile) => (
                  <View key={tile.id} style={styles.thumb}>
                    <AppText variant="caption" style={styles.thumbLabel}>
                      {tile.label}
                    </AppText>
                    <AppText variant="caption" style={styles.thumbSize}>
                      {tile.size}
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
          {filed ? <Button title={texts.detail.assistButton} variant="secondary" /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}
