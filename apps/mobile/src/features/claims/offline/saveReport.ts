import { avisoPayload } from '../api/createAviso';
import { commitReportDirectory, copyReportFile, prepareReportDirectory, writeReportText } from './directory';

export type ReportFile = {
  kind: 'photo' | 'video';
  filePath: string;
  bytes: number;
  capturedAt: string;
};

export type ReportDraft = {
  policy: string;
  claimType: string;
  occurredAt: string;
  location: string;
  description: string;
  files: ReportFile[];
};

type StoredEvidence = {
  kind: 'photo' | 'video';
  bytes: number;
  capturedAt: string;
  file: string;
};

let savedCopies = 0;

export async function saveReport(draft: ReportDraft): Promise<void> {
  await prepareReportDirectory();
  const evidencias: StoredEvidence[] = [];
  const copy = `${Date.now().toString(36)}-${(savedCopies += 1).toString(36)}`;

  for (const [index, file] of draft.files.entries()) {
    const name = `evidencia-${index + 1}-${copy}${file.kind === 'photo' ? '.jpg' : '.mp4'}`;
    await copyReportFile(file.filePath, name);
    evidencias.push({
      kind: file.kind,
      bytes: file.bytes,
      capturedAt: file.capturedAt,
      file: name,
    });
  }

  await writeReportText(
    'report.json',
    JSON.stringify({
      ...avisoPayload({
        policy: draft.policy,
        claimType: draft.claimType,
        occurredAt: draft.occurredAt,
        location: draft.location,
        description: draft.description,
      }),
      evidencias,
    }),
  );
  await commitReportDirectory();
}
