import { useState } from 'react';
import { StackActions, useNavigation } from '@react-navigation/native';

import { errorMessage } from '../../../../shared/api/client';
import { SubmitAvisoError, submitAviso } from '../../api/submitAviso';
import { toEvidenceFiles } from '../../evidenceFiles';
import { deleteReport } from '../../offline/deleteReport';
import { saveReport } from '../../offline/saveReport';
import { useClaimsStore } from '../../store/useClaimsStore';
import { useTexts } from '../../texts';

type ReportFields = {
  policy: string;
  claimType: string;
  occurredAt: string;
  description: string;
  address: string;
};

// Files the report, or keeps it on the device when the aviso could not even be created.
export function useSubmitReport(fields: ReportFields) {
  const navigation = useNavigation();
  const texts = useTexts();
  const photos = useClaimsStore((state) => state.photos);
  const videos = useClaimsStore((state) => state.videos);
  const [submitted, setSubmitted] = useState(false);
  const [filing, setFiling] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const submit = async () => {
    const files = toEvidenceFiles(photos, videos);
    setSubmitted(true);
    setSendError(null);
    if (fields.description.trim() === '' || files.length === 0) {
      return;
    }

    const report = {
      policy: fields.policy,
      claimType: fields.claimType,
      occurredAt: fields.occurredAt,
      location: fields.address,
      description: fields.description.trim(),
      files,
    };
    setFiling(true);
    try {
      const filed = await submitAviso(report);
      await deleteReport();
      navigation.dispatch(StackActions.replace('AvisoDetail', { aviso: filed }));
    } catch (error) {
      if (error instanceof SubmitAvisoError && !error.avisoCreated) {
        try {
          await saveReport(report);
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

  return { submit, submitted, filing, sendError };
}
