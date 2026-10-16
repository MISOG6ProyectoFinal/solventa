import { render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { Aviso } from '../../api/listAvisos';
import AvisoDetailScreen from './index';

jest.mock('@react-navigation/native', () => {
  const goBack = jest.fn();
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      goBack,
      navigate,
      canGoBack: () => true,
    }),
  };
});

const FILED: Aviso = {
  id: 'aviso-2',
  cliente_id: 'cliente-demo',
  poliza_id: 'SLV-2026-03105',
  tipo: 'Pérdida de equipaje',
  ocurrido_en: '2026-10-02T15:00:00Z',
  descripcion: 'La maleta no llegó',
  ubicacion: 'Madrid',
  estado: 'radicado',
};

const DRAFT: Aviso = {
  ...FILED,
  id: 'aviso-1',
  tipo: 'Accidente con vehículo de alquiler',
  ocurrido_en: '2026-09-12T15:30:00Z',
  descripcion: 'Golpe en la puerta',
  ubicacion: null,
  estado: 'borrador',
};

const EVIDENCIAS = [
  {
    id: 'ev-1',
    url: 's3://solventa-evidencias/foto',
    content_type: 'image/jpeg',
    bytes: 1200,
    estado: 'disponible',
    download_url: 'https://download.test/ev-1',
  },
  {
    id: 'ev-2',
    url: 's3://solventa-evidencias/video',
    content_type: 'video/mp4',
    bytes: 2_000_000,
    estado: 'disponible',
    download_url: 'https://download.test/ev-2',
  },
];

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('AvisoDetailScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
    global.fetch = jest.fn(async () => jsonResponse(EVIDENCIAS)) as typeof fetch;
  });

  it('shows a loading indicator until the evidences arrive', async () => {
    let release: (value: ReturnType<typeof jsonResponse>) => void = () => undefined;
    global.fetch = jest.fn(
      () => new Promise((resolve) => {
        release = resolve;
      }),
    ) as typeof fetch;
    const { findByText, getByTestId, queryByTestId, queryByText } = await render(
      <AvisoDetailScreen route={{ params: { aviso: FILED } }} />,
    );

    expect(getByTestId('aviso-detail-loading')).toBeTruthy();
    expect(queryByText('Pérdida de equipaje')).toBeNull();
    expect(queryByText('Evidencias (2)')).toBeNull();

    release(jsonResponse(EVIDENCIAS));

    expect(await findByText('Evidencias (2)')).toBeTruthy();
    expect(queryByTestId('aviso-detail-loading')).toBeNull();
  });

  it('shows a filed aviso with its evidences', async () => {
    const { findByText, getByText } = await render(<AvisoDetailScreen route={{ params: { aviso: FILED } }} />);

    expect(getByText('Detalle del reporte')).toBeTruthy();
    expect(await findByText('Siniestro radicado exitosamente.')).toBeTruthy();
    expect(getByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText('Radicado')).toBeTruthy();
    expect(getByText('SLV-2026-03105')).toBeTruthy();
    expect(getByText('Ocurrió 2026-10-02 15:00 · Madrid')).toBeTruthy();
    expect(getByText('La maleta no llegó')).toBeTruthy();
    expect(await findByText('Evidencias (2)')).toBeTruthy();
    expect(getByText('Foto 1')).toBeTruthy();
    expect(getByText('1 KB')).toBeTruthy();
    expect(getByText('Video 1')).toBeTruthy();
    expect(getByText('2 MB')).toBeTruthy();
    expect(getByText('Solicitar asistencia en sitio')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/movil\/siniestros\/aviso-2\/evidencias$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('shows a draft without the filed banner or assistance', async () => {
    global.fetch = jest.fn(async () => jsonResponse([])) as typeof fetch;
    const { findByText, getByText, queryByText } = await render(
      <AvisoDetailScreen route={{ params: { aviso: DRAFT } }} />,
    );

    expect(await findByText('Borrador')).toBeTruthy();
    expect(getByText('Ocurrió 2026-09-12 15:30')).toBeTruthy();
    expect(getByText('Golpe en la puerta')).toBeTruthy();
    expect(queryByText('Siniestro radicado exitosamente.')).toBeNull();
    expect(queryByText('Solicitar asistencia en sitio')).toBeNull();
    expect(await findByText('Evidencias (0)')).toBeTruthy();
  });

  it('keeps the report when the evidences cannot be loaded', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ detail: 'No se encontró el reporte.' }, 404)) as typeof fetch;
    const { findByText, getByText } = await render(<AvisoDetailScreen route={{ params: { aviso: FILED } }} />);

    expect(await findByText('No se encontró el reporte.')).toBeTruthy();
    expect(getByText('La maleta no llegó')).toBeTruthy();
  });
});
