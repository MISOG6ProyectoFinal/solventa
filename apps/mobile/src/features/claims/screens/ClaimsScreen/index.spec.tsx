import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../../../../shared/theme';
import ClaimsScreen from './index';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const navigate = jest.fn();
  const goBack = jest.fn();
  return {
    useNavigation: () => ({
      navigate,
      goBack,
      canGoBack: () => true,
    }),
    useFocusEffect: (effect: () => undefined | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

const AVISOS = [
  {
    id: 'aviso-2',
    cliente_id: 'cliente-demo',
    poliza_id: 'SLV-2026-03105',
    tipo: 'Pérdida de equipaje',
    ocurrido_en: '2026-10-02T15:00:00Z',
    descripcion: 'La maleta no llegó',
    ubicacion: 'Madrid',
    estado: 'radicado',
  },
  {
    id: 'aviso-1',
    cliente_id: 'cliente-demo',
    poliza_id: 'SLV-2025-01820',
    tipo: 'Accidente con vehículo de alquiler',
    ocurrido_en: '2026-09-12T15:30:00Z',
    descripcion: 'Golpe en la puerta',
    ubicacion: null,
    estado: 'borrador',
  },
];

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('ClaimsScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    useNavigation().goBack.mockClear();
    global.fetch = jest.fn(async () => jsonResponse([])) as typeof fetch;
  });

  it('shows the empty claims list while online', async () => {
    const { findByText, getByText, queryByText } = await render(<ClaimsScreen />);

    expect(getByText('Siniestros')).toHaveStyle({
      fontFamily: 'Fraunces-SemiBold',
      fontSize: 18,
      lineHeight: 22.5,
      color: theme.colors.onNavy,
    });
    expect(queryByText('Conectado')).toBeNull();
    expect(await findByText('Aún no tienes reportes.')).toHaveStyle({ textAlign: 'center' });
    expect(getByText('Reportar siniestro')).toBeTruthy();
    expect(queryByText('Reportar')).toBeNull();
    expect(queryByText('Sin conexión')).toBeNull();
  });

  it('opens the report flow', async () => {
    const { findByText } = await render(<ClaimsScreen />);

    await fireEvent.press(await findByText('Reportar siniestro'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport');
  });

  it('does not offer a back button', async () => {
    const { queryByLabelText } = await render(<ClaimsScreen />);

    expect(queryByLabelText('Volver')).toBeNull();
  });

  it('lists the client avisos with type, status, and policy', async () => {
    global.fetch = jest.fn(async () => jsonResponse(AVISOS)) as typeof fetch;
    const { findByText, getAllByText, getByText, queryByText } = await render(<ClaimsScreen />);

    expect(await findByText('Pérdida de equipaje')).toBeTruthy();
    expect(getByText('Accidente con vehículo de alquiler')).toBeTruthy();
    expect(getByText('Radicado')).toBeTruthy();
    expect(getAllByText('Borrador')).toHaveLength(1);
    expect(getByText('SLV-2026-03105')).toBeTruthy();
    expect(getByText('SLV-2025-01820')).toBeTruthy();
    expect(queryByText('Aún no tienes reportes.')).toBeNull();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/movil\/siniestros$/), expect.objectContaining({
      method: 'GET',
    }));

    await fireEvent.press(getByText('Reportar'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport');
  });

  it('opens the aviso detail', async () => {
    global.fetch = jest.fn(async () => jsonResponse(AVISOS)) as typeof fetch;
    const { findByText } = await render(<ClaimsScreen />);

    await fireEvent.press(await findByText('Pérdida de equipaje'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('AvisoDetail', {
      aviso: expect.objectContaining({ id: 'aviso-2', estado: 'radicado' }),
    });
  });

  it('shows a banner when the avisos cannot be loaded', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ detail: 'Siniestros no disponible.' }, 503)) as typeof fetch;
    const { findByText, queryByText } = await render(<ClaimsScreen />);

    expect(await findByText('Siniestros no disponible.')).toBeTruthy();
    expect(queryByText('Aún no tienes reportes.')).toBeNull();
  });

  it('falls back to the list error copy when the API has no detail', async () => {
    global.fetch = jest.fn(async () => jsonResponse({}, 500)) as typeof fetch;
    const { findByText } = await render(<ClaimsScreen />);

    expect(await findByText('No se pudieron cargar los reportes.')).toBeTruthy();
  });

  it('reloads the avisos when the list is pulled', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse([AVISOS[1]]))
      .mockResolvedValueOnce(jsonResponse(AVISOS)) as typeof fetch;
    const { findByText, getByTestId, queryByText } = await render(<ClaimsScreen />);

    expect(await findByText('Accidente con vehículo de alquiler')).toBeTruthy();
    expect(queryByText('Pérdida de equipaje')).toBeNull();

    await fireEvent(getByTestId('claims-refresh'), 'refresh');

    expect(await findByText('Pérdida de equipaje')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the avisos when a refresh fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse([AVISOS[1]]))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Siniestros no disponible.' }, 503)) as typeof fetch;
    const { findByText, getByTestId, getByText } = await render(<ClaimsScreen />);

    await findByText('Accidente con vehículo de alquiler');
    await fireEvent(getByTestId('claims-refresh'), 'refresh');

    expect(await findByText('Siniestros no disponible.')).toBeTruthy();
    expect(getByText('Accidente con vehículo de alquiler')).toBeTruthy();
  });
});
