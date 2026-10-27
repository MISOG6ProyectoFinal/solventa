import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../../../../shared/theme';
import { AppText, Card, StatusChip } from '../../../../shared/ui';
import { type Aviso } from '../../api/listAvisos';
import { type StoredReport } from '../../offline/listReports';
import { useTexts } from '../../texts';
import { type Texts } from '../../texts/es';

export type ClaimItem = { kind: 'pending'; report: StoredReport } | { kind: 'filed'; aviso: Aviso };

type ClaimRowProps = {
  item: ClaimItem;
  onOpen: (item: ClaimItem) => void;
};

export function claimKey(item: ClaimItem): string {
  return item.kind === 'pending' ? `pending-${item.report.poliza_id}` : item.aviso.id;
}

function claimStatus(estado: string, texts: Texts): { label: string; variant: 'pending' | 'success' } {
  if (estado === 'radicado') {
    return { label: texts.claims.statusFiled, variant: 'success' };
  }
  return { label: texts.claims.statusDraft, variant: 'pending' };
}

export const ClaimRow = memo(function ClaimRow({ item, onOpen }: Readonly<ClaimRowProps>) {
  const texts = useTexts();
  const claim = item.kind === 'pending' ? item.report : item.aviso;
  const status =
    item.kind === 'pending'
      ? { label: texts.claims.statusPendingSync, variant: 'pending' as const }
      : claimStatus(item.aviso.estado, texts);

  return (
    <Card testID="claim-item" onPress={() => onOpen(item)}>
      <View style={styles.titleRow}>
        <AppText variant="button" style={styles.title}>
          {claim.tipo}
        </AppText>
        <StatusChip variant={status.variant}>{status.label}</StatusChip>
      </View>
      <AppText variant="bodySmall">{claim.poliza_id}</AppText>
    </Card>
  );
});

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  title: {
    flex: 1,
    color: theme.colors.text,
  },
});
