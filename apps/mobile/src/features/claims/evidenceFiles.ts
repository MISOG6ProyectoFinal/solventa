import { type ReportFile } from './offline/saveReport';
import { type ClaimPhoto, type ClaimVideo } from './store/types';

export function toEvidenceFiles(photos: ClaimPhoto[], videos: ClaimVideo[]): ReportFile[] {
  const files = (kind: ReportFile['kind'], items: Array<ClaimPhoto | ClaimVideo>) =>
    items.map(({ filePath, bytes, capturedAt }) => ({ kind, filePath, bytes, capturedAt }));
  return [...files('photo', photos), ...files('video', videos)];
}
