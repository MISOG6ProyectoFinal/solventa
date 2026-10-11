import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StackActions, useNavigation } from '@react-navigation/native';

import { readLocation } from '../../../../shared/location';
import { useClaimsStore } from '../../store/useClaimsStore';
import ReportClaimScreen from './index';

jest.mock('@react-navigation/native', () => {
  const { StackActions } = jest.requireActual('@react-navigation/native');
  const goBack = jest.fn();
  const navigate = jest.fn();
  const dispatch = jest.fn();
  return {
    StackActions,
    useNavigation: () => ({
      goBack,
      navigate,
      dispatch,
      canGoBack: () => true,
    }),
  };
});

jest.mock('../../../../shared/location', () => ({
  readLocation: jest.fn(() =>
    Promise.resolve({
      address: 'Carrera 7 #32-16, La Candelaria, Bogotá',
      gps: 'GPS 4.5981, -74.0760 (±12 m)',
    }),
  ),
}));

const currentPlace = {
  address: 'Carrera 7 #32-16, La Candelaria, Bogotá',
  gps: 'GPS 4.5981, -74.0760 (±12 m)',
};

const fixedNow = new Date(2026, 8, 12, 10, 30, 0);

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob([Uint8Array.from([0xff, 0xd8, 0xff])]),
  };
}

function mockFiling() {
  return jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
    if (String(url).startsWith('file://')) {
      return jsonResponse(null);
    }

    if (init?.method === 'PUT') {
      return jsonResponse(null);
    }

    if (init?.method === 'POST' && String(url).endsWith('/movil/siniestros')) {
      return jsonResponse({ id: 'aviso-1', estado: 'borrador' }, 201);
    }

    if (String(url).includes('/evidencias/cargas')) {
      const payload = JSON.parse(init?.body ?? '{}') as { content_type: string; bytes: number };
      return jsonResponse(
        {
          evidencia_id: 'ev-1',
          upload_url: 'http://uploads.test/foto',
          headers: { 'Content-Type': payload.content_type, 'Content-Length': String(payload.bytes) },
        },
        201,
      );
    }

    if (String(url).endsWith('/confirmar')) {
      return jsonResponse({ estado: 'disponible' });
    }

    return jsonResponse({ detail: 'No se pudo enviar el reporte.' }, 500);
  });
}

describe('ReportClaimScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: fixedNow, advanceTimers: true });
    useNavigation().goBack.mockClear();
    useNavigation().navigate.mockClear();
    useClaimsStore.getState().clear();
    jest.mocked(readLocation).mockReset();
    jest.mocked(readLocation).mockResolvedValue(currentPlace);
    global.fetch = mockFiling() as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the online report form', async () => {
    const { getByText, getByPlaceholderText, queryByText } = await render(<ReportClaimScreen />);

    expect(getByText('Reportar siniestro')).toBeTruthy();
    expect(getByText(/Póliza afectada/)).toBeTruthy();
    expect(getByText('Viaje Internacional · SLV-2026-03105')).toBeTruthy();
    expect(getByText(/Tipo de siniestro/)).toBeTruthy();
    expect(getByText('Accidente con vehículo de alquiler')).toBeTruthy();
    expect(getByText(/Fecha y hora de ocurrencia/)).toBeTruthy();
    expect(getByText('12/09/2026 10:30')).toBeTruthy();
    expect(getByText('Ubicación')).toBeTruthy();

    await waitFor(() => {
      expect(getByText('Carrera 7 #32-16, La Candelaria, Bogotá')).toBeTruthy();
    });
    expect(getByText('GPS 4.5981, -74.0760 (±12 m)')).toBeTruthy();
    expect(getByText(/Descripción/)).toBeTruthy();
    expect(getByPlaceholderText('Describe lo ocurrido')).toBeTruthy();
    expect(getByText('Evidencias')).toBeTruthy();
    expect(getByText('0/10')).toBeTruthy();
    expect(
      getByText('Videos de máximo 30 s y 50 MB. Los archivos se comprimen en tu teléfono antes de enviarse.'),
    ).toHaveStyle({ fontSize: 12, lineHeight: 16 });
    expect(getByText('Tomar foto')).toBeTruthy();
    expect(getByText('Grabar video')).toBeTruthy();
    expect(getByText('Enviar reporte')).toBeTruthy();
    expect(queryByText('Sin conexión')).toBeNull();
    expect(queryByText('Obligatorio')).toBeNull();
    expect(queryByText('Agrega al menos una evidencia')).toBeNull();
  });

  it('asks for a description and evidence when the report is sent empty', async () => {
    const { getByText, getByPlaceholderText, queryByText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByText('Enviar reporte'));

    expect(getByText('Obligatorio')).toBeTruthy();
    expect(getByText('Agrega al menos una evidencia')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('Describe lo ocurrido'), 'Choque en la calle 85');
    await fireEvent.press(getByText('Enviar reporte'));

    expect(queryByText('Obligatorio')).toBeNull();
    expect(getByText('Agrega al menos una evidencia')).toBeTruthy();
  });

  it('changes the occurrence time', async () => {
    const { getByLabelText, getByText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByText('12/09/2026 10:30'));
    await fireEvent.press(getByLabelText('12 de septiembre de 2026'));
    await fireEvent.changeText(getByLabelText('Hora'), '11');
    await fireEvent.press(getByText('Listo'));

    expect(getByText('12/09/2026 11:30')).toBeTruthy();
  });

  it('shows a progress indicator while the report is filed', async () => {
    let releaseFiling: (value: unknown) => void = () => undefined;
    const filing = mockFiling();
    global.fetch = jest.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST' && String(url).endsWith('/movil/siniestros')) {
        return new Promise((resolve) => {
          releaseFiling = () => resolve(filing(url, init));
        });
      }

      return filing(url, init);
    }) as typeof fetch;

    useClaimsStore.getState().addPhoto({ filePath: '/tmp/foto.jpg', bytes: 1536 });
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = await render(<ReportClaimScreen />);

    await waitFor(() => {
      expect(getByText(currentPlace.address)).toBeTruthy();
    });
    await fireEvent.changeText(getByPlaceholderText('Describe lo ocurrido'), 'Golpe en la puerta');
    await fireEvent.press(getByText('Enviar reporte'));

    expect(getByTestId('button-progress')).toBeTruthy();
    expect(queryByText('Enviando...')).toBeNull();
    expect(queryByText('Enviar reporte')).toBeNull();
    expect(getByTestId('submit-report').props.disabled).toBe(true);

    releaseFiling(undefined);

    await waitFor(() => {
      expect(useNavigation().dispatch).toHaveBeenCalledWith(
        StackActions.replace(
          'ClaimReport',
          expect.objectContaining({
            screen: 'ClaimDetail',
            params: expect.objectContaining({
              radicado: expect.stringMatching(/^SIN-\d{5}$/),
              claimType: 'Accidente con vehículo de alquiler',
              policy: 'Viaje Internacional · SLV-2026-03105',
              location: currentPlace.address,
              description: 'Golpe en la puerta',
              evidences: [expect.objectContaining({ label: 'Foto 1' })],
            }),
          }),
        ),
      );
    });

    const createCall = jest.mocked(fetch).mock.calls.find(([, init]) => {
      const request = init as { method?: string; body?: string } | undefined;
      return request?.method === 'POST' && request.body?.includes('poliza_id');
    });
    const body = JSON.parse((createCall?.[1] as { body: string }).body);
    expect(body.poliza_id).toBe('SLV-2026-03105');
    expect(body.tipo).toBe('Accidente con vehículo de alquiler');
    expect(body.descripcion).toBe('Golpe en la puerta');
    expect(body.ubicacion).toBe(currentPlace.address);
    expect(body.ocurrido_en).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/);

    const uploadCall = jest.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/evidencias/cargas'));
    const upload = JSON.parse((uploadCall?.[1] as { body: string }).body) as { bytes: number };
    expect(upload.bytes).toBe(3);
  });

  it('keeps the form open when the report cannot be filed', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ detail: 'El archivo no pasó la validación.' }, 422)) as typeof fetch;
    useClaimsStore.getState().addPhoto({ filePath: '/tmp/foto.jpg', bytes: 1536 });
    const { findByText, getByPlaceholderText, getByText, queryByTestId } = await render(<ReportClaimScreen />);

    await waitFor(() => {
      expect(getByText(currentPlace.address)).toBeTruthy();
    });
    await fireEvent.changeText(getByPlaceholderText('Describe lo ocurrido'), 'Golpe en la puerta');
    await fireEvent.press(getByText('Enviar reporte'));

    expect(await findByText('El archivo no pasó la validación.')).toBeTruthy();
    expect(queryByTestId('button-progress')).toBeNull();
    expect(getByText('Enviar reporte')).toBeTruthy();
    expect(useNavigation().navigate).not.toHaveBeenCalled();
  });

  it('opens the camera to take a photo', async () => {
    const { getByText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByText('Tomar foto'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport', { screen: 'TakePhoto' });
  });

  it('opens the camera to record a video', async () => {
    const { getByText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByText('Grabar video'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport', { screen: 'RecordVideo' });
  });

  it('tells the user when the report already has 10 files', async () => {
    for (let index = 0; index < 10; index += 1) {
      useClaimsStore.getState().addPhoto({ filePath: `/tmp/foto-${index}.jpg`, bytes: 100 });
    }
    const { getByText, queryByText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByText('Tomar foto'));
    await fireEvent.press(getByText('Grabar video'));

    expect(getByText('Este reporte ya tiene 10 evidencias.')).toBeTruthy();
    expect(useNavigation().navigate).not.toHaveBeenCalled();
    expect(queryByText('11/10')).toBeNull();
  });

  it('opens a saved video', async () => {
    useClaimsStore.getState().addVideo({ filePath: '/tmp/video.mp4', bytes: 1536 });
    const { getByLabelText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByLabelText('Video 1'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport', {
      screen: 'VideoPreview',
      params: { filePath: '/tmp/video.mp4' },
    });
  });

  it('accepts a video as evidence', async () => {
    useClaimsStore.getState().addVideo({ filePath: '/tmp/video.mp4', bytes: 1536 });
    const { getByText, getByPlaceholderText, queryByText } = await render(<ReportClaimScreen />);

    expect(getByText('Video 1')).toBeTruthy();
    expect(getByText('1,5 KB')).toBeTruthy();
    expect(getByText('1/10')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('Describe lo ocurrido'), 'Choque en la calle 85');
    await fireEvent.press(getByText('Enviar reporte'));

    expect(queryByText('Agrega al menos una evidencia')).toBeNull();
  });

  it('opens a saved photo', async () => {
    useClaimsStore.getState().addPhoto({ filePath: '/tmp/foto.jpg', bytes: 1536 });
    const { getByLabelText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByLabelText('Foto 1'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport', {
      screen: 'PhotoPreview',
      params: { filePath: '/tmp/foto.jpg' },
    });
  });

  it('returns to the claims list', async () => {
    const { getByLabelText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByLabelText('Volver'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);
  });

  it('replaces the location when it is updated', async () => {
    let finishRefresh: (place: { address: string; gps: string }) => void = () => undefined;
    jest
      .mocked(readLocation)
      .mockResolvedValueOnce(currentPlace)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
      );

    const { getByText, getByLabelText, queryByText } = await render(<ReportClaimScreen />);

    await waitFor(() => {
      expect(getByText(currentPlace.address)).toBeTruthy();
    });

    await fireEvent.press(getByLabelText('Actualizar ubicación'));

    expect(getByText('Obteniendo ubicación')).toBeTruthy();
    expect(queryByText(currentPlace.address)).toBeNull();

    finishRefresh({
      address: 'Calle 85 #12-34, Chapinero, Bogotá',
      gps: 'GPS 4.7110, -74.0721 (±8 m)',
    });

    await waitFor(() => {
      expect(getByText('Calle 85 #12-34, Chapinero, Bogotá')).toBeTruthy();
    });
    expect(getByText('GPS 4.7110, -74.0721 (±8 m)')).toBeTruthy();
    expect(queryByText('Obteniendo ubicación')).toBeNull();
  });

  it('shows an error when the location cannot be read', async () => {
    jest.mocked(readLocation).mockRejectedValueOnce(new Error('denied'));
    const { findByText, queryByText } = await render(<ReportClaimScreen />);

    expect(await findByText('No se pudo obtener la ubicación')).toBeTruthy();
    expect(queryByText(/GPS /)).toBeNull();
  });

  it('shows that the location is still being read', async () => {
    jest.mocked(readLocation).mockReturnValueOnce(new Promise(() => undefined));
    const { getByText } = await render(<ReportClaimScreen />);

    expect(getByText('Obteniendo ubicación')).toBeTruthy();
  });
});
