import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StackActions, useNavigation } from '@react-navigation/native';

import { Aviso } from '../../api/listAvisos';
import AssistanceConfirmScreen from './index';

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

const PLACE = {
  address: 'Calle 85 #12-34, Chapinero, Bogotá',
  gps: 'GPS 4.6683, -74.0531 (±8 m)',
  latitude: 4.6683,
  longitude: -74.0531,
};

const AVISO: Aviso = {
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

const ASISTENCIA = {
  id: 'as-1',
  aviso_id: 'aviso-2',
  servicio: 'grua',
  ubicacion: PLACE.address,
  gps: PLACE.gps,
  numero: 'AST-3170',
  eta_min: 25,
  eta_max: 40,
  estado: 'solicitada',
};

const params = { aviso: AVISO, service: 'grua' as const, place: PLACE };

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('AssistanceConfirmScreen', () => {
  beforeEach(() => {
    useNavigation().dispatch.mockClear();
    global.fetch = jest.fn(async () => jsonResponse(ASISTENCIA, 201)) as typeof fetch;
  });

  it('summarizes the request', async () => {
    const { getByText } = await render(<AssistanceConfirmScreen route={{ params }} />);

    expect(getByText('Asistencia en sitio')).toBeTruthy();
    expect(getByText('Póliza SLV-2026-03105 activa · incluye asistencia en sitio.')).toBeTruthy();
    expect(getByText('Confirma tu solicitud')).toBeTruthy();
    expect(getByText('Grúa')).toBeTruthy();
    expect(getByText(PLACE.address)).toBeTruthy();
    expect(getByText('SIN-18247')).toBeTruthy();
  });

  it('posts the request and returns to the detail with the assistance', async () => {
    const { getByText } = await render(<AssistanceConfirmScreen route={{ params }} />);

    await fireEvent.press(getByText('Confirmar asistencia'));

    await waitFor(() =>
      expect(useNavigation().dispatch).toHaveBeenCalledWith(
        StackActions.popTo('AvisoDetail', { aviso: AVISO, asistencia: ASISTENCIA }),
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/movil\/siniestros\/aviso-2\/asistencias$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ servicio: 'grua', ubicacion: PLACE.address, gps: PLACE.gps }),
      }),
    );
  });

  it('keeps the confirmation open with the error when the request fails', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ detail: 'Servicio no disponible.' }, 503)) as typeof fetch;
    const { findByText, getByText } = await render(<AssistanceConfirmScreen route={{ params }} />);

    await fireEvent.press(getByText('Confirmar asistencia'));

    expect(await findByText('Servicio no disponible.')).toBeTruthy();
    expect(getByText('Confirmar asistencia')).toBeTruthy();
    expect(useNavigation().dispatch).not.toHaveBeenCalled();
  });

  it('reads Solicitando while the request is pending and ignores a second tap', async () => {
    let release: (value: ReturnType<typeof jsonResponse>) => void = () => undefined;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ) as typeof fetch;
    const { getByText, queryByText } = await render(<AssistanceConfirmScreen route={{ params }} />);

    // Not awaited: the request stays pending, and awaiting would wait for it.
    fireEvent.press(getByText('Confirmar asistencia'));

    await waitFor(() => expect(getByText('Solicitando...')).toBeTruthy());
    expect(queryByText('Confirmar asistencia')).toBeNull();
    fireEvent.press(getByText('Solicitando...'));
    expect(fetch).toHaveBeenCalledTimes(1);

    release(jsonResponse(ASISTENCIA, 201));
    await waitFor(() => expect(useNavigation().dispatch).toHaveBeenCalledTimes(1));
  });

  it('shows the existing request when the server says one already exists', async () => {
    global.fetch = jest.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? jsonResponse({ detail: 'Ya solicitaste asistencia para este siniestro.' }, 409)
        : jsonResponse([ASISTENCIA]),
    ) as typeof fetch;
    const { getByText } = await render(<AssistanceConfirmScreen route={{ params }} />);

    await fireEvent.press(getByText('Confirmar asistencia'));

    await waitFor(() =>
      expect(useNavigation().dispatch).toHaveBeenCalledWith(
        StackActions.popTo('AvisoDetail', { aviso: AVISO, asistencia: ASISTENCIA }),
      ),
    );
  });
});
