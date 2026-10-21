import { fireEvent, render } from '@testing-library/react-native';
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
  radicado: 'SIN-18247',
};

const DRAFT: Aviso = {
  ...FILED,
  id: 'aviso-1',
  tipo: 'Accidente con vehículo de alquiler',
  ocurrido_en: '2026-09-12T15:30:00Z',
  descripcion: 'Golpe en la puerta',
  ubicacion: null,
  estado: 'borrador',
  radicado: null,
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

const ASISTENCIA = {
  id: 'as-1',
  aviso_id: 'aviso-2',
  servicio: 'grua',
  ubicacion: 'Calle 85 #12-34, Chapinero, Bogotá',
  gps: 'GPS 4.6683, -74.0531 (±8 m)',
  numero: 'AST-3170',
  eta_min: 25,
  eta_max: 40,
  estado: 'solicitada',
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

type Routes = { evidencias?: ReturnType<typeof jsonResponse>; asistencias?: ReturnType<typeof jsonResponse> };

function mockFetch({
  evidencias = jsonResponse(EVIDENCIAS),
  asistencias = jsonResponse([]),
}: Routes = {}) {
  return jest.fn(async (url: string) => (String(url).endsWith('/asistencias') ? asistencias : evidencias)) as typeof fetch;
}

describe('AvisoDetailScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
    useNavigation().navigate.mockClear();
    global.fetch = mockFetch();
  });

  it('shows a loading indicator until the evidences arrive', async () => {
    let release: (value: ReturnType<typeof jsonResponse>) => void = () => undefined;
    global.fetch = jest.fn(
      (url: string) =>
        String(url).endsWith('/asistencias')
          ? Promise.resolve(jsonResponse([]))
          : new Promise((resolve) => {
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
    expect(await findByText('Siniestro #SIN-18247 radicado exitosamente.')).toBeTruthy();
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
    global.fetch = mockFetch({ evidencias: jsonResponse([]) });
    const { findByText, getByText, queryByText } = await render(
      <AvisoDetailScreen route={{ params: { aviso: DRAFT } }} />,
    );

    expect(await findByText('Borrador')).toBeTruthy();
    expect(getByText('Ocurrió 2026-09-12 15:30')).toBeTruthy();
    expect(getByText('Golpe en la puerta')).toBeTruthy();
    expect(queryByText('Siniestro #SIN-18247 radicado exitosamente.')).toBeNull();
    expect(queryByText('Solicitar asistencia en sitio')).toBeNull();
    expect(await findByText('Evidencias (0)')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/asistencias$/), expect.anything());
  });

  it('keeps the report when the evidences cannot be loaded', async () => {
    global.fetch = mockFetch({ evidencias: jsonResponse({ detail: 'No se encontró el reporte.' }, 404) });
    const { findByText, getByText } = await render(<AvisoDetailScreen route={{ params: { aviso: FILED } }} />);

    expect(await findByText('No se encontró el reporte.')).toBeTruthy();
    expect(getByText('La maleta no llegó')).toBeTruthy();
  });

  it('opens the service screen from the assistance button', async () => {
    const { findByText, getByText } = await render(<AvisoDetailScreen route={{ params: { aviso: FILED } }} />);
    await findByText('Evidencias (2)');

    await fireEvent.press(getByText('Solicitar asistencia en sitio'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('AssistanceService', { aviso: FILED });
  });

  it('shows the assistance card instead of the button when a request exists', async () => {
    global.fetch = mockFetch({ asistencias: jsonResponse([ASISTENCIA]) });
    const { findByText, getByText, queryByText } = await render(
      <AvisoDetailScreen route={{ params: { aviso: FILED } }} />,
    );

    expect(await findByText('Asistencia solicitada')).toBeTruthy();
    expect(getByText('Grúa')).toBeTruthy();
    expect(getByText('Solicitud AST-3170')).toBeTruthy();
    expect(getByText('Llegada estimada: 25-40 min')).toBeTruthy();
    expect(queryByText('Solicitar asistencia en sitio')).toBeNull();
  });

  it('shows the assistance card from the route params without asking the server', async () => {
    const { findByText, queryByText } = await render(
      <AvisoDetailScreen route={{ params: { aviso: FILED, asistencia: ASISTENCIA } }} />,
    );

    expect(await findByText('Asistencia solicitada')).toBeTruthy();
    expect(queryByText('Solicitar asistencia en sitio')).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/asistencias$/), expect.anything());
  });

  it('keeps the detail and hides the assistance button when the assistance cannot be loaded', async () => {
    global.fetch = mockFetch({ asistencias: jsonResponse({ detail: 'Servicio no disponible.' }, 503) });
    const { findByText, getByText, queryByText } = await render(<AvisoDetailScreen route={{ params: { aviso: FILED } }} />);

    expect(await findByText('No se pudo cargar la asistencia.')).toBeTruthy();
    expect(getByText('La maleta no llegó')).toBeTruthy();
    expect(queryByText('Solicitar asistencia en sitio')).toBeNull();
  });
});
