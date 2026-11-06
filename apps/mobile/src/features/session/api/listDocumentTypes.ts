import { apiClient } from '../../../shared/api/client';

export function listDocumentTypes(): Promise<string[]> {
  return apiClient.get('/movil/tipos-documento');
}
