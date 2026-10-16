import { readReportText, reportFilePath } from './directory';
import { type ReportFile } from './saveReport';

export type StoredReport = {
  poliza_id: string;
  tipo: string;
  ocurrido_en: string;
  descripcion: string;
  ubicacion?: string;
  files: ReportFile[];
};

type StoredFile = {
  kind: 'photo' | 'video';
  bytes: number;
  capturedAt: string;
  file: string;
};

type StoredBody = {
  poliza_id: string;
  tipo: string;
  ocurrido_en: string;
  descripcion: string;
  ubicacion?: string;
  evidencias?: StoredFile[];
};

export async function listReports(): Promise<StoredReport[]> {
  const text = await readReportText('report.json');
  if (text == null) {
    return [];
  }

  const saved = JSON.parse(text) as StoredBody;
  return [
    {
      poliza_id: saved.poliza_id,
      tipo: saved.tipo,
      ocurrido_en: saved.ocurrido_en,
      descripcion: saved.descripcion,
      ubicacion: saved.ubicacion,
      files: (saved.evidencias ?? []).map((file) => ({
        kind: file.kind,
        bytes: file.bytes,
        capturedAt: file.capturedAt,
        filePath: reportFilePath(file.file),
      })),
    },
  ];
}
