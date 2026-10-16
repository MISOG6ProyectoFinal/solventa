import { removeReportDirectory } from './directory';

export function deleteReport(): Promise<void> {
  return removeReportDirectory();
}
