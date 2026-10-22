import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { readLocation } from '../../../../shared/location';
import { NEARBY_RADIUS_KM } from '../../constants';
import NearbyProvidersScreen from './index';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('../../../../shared/location', () => ({
  readLocation: jest.fn(),
}));

const PLACE = {
  address: 'Calle 85 #12-34, Chapinero, Bogotá',
  gps: 'GPS 4.6683, -74.0531 (±8 m)',
  latitude: 4.6683,
  longitude: -74.0531,
};

const TOW_TRUCK = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-74.0636, 4.6533] },
  properties: {
    id: 'seed-grua-01',
    nombre: 'Grúas Aliadas Chapinero',
    tipo: 'grua',
    distancia_km: 2.4,
    eta_min: 11,
    calificacion: 4.5,
  },
};

const WORKSHOP = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-74.1, 4.65] },
  properties: {
    id: 'osm-node-101',
    nombre: 'Taller El Rayo',
    tipo: 'taller',
    distancia_km: 5.1,
    eta_min: 17,
    calificacion: null,
  },
};

const readLocationMock = readLocation as jest.Mock;

function collection(...features: unknown[]) {
  return { type: 'FeatureCollection', features };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function requestedUrls() {
  return jest.mocked(fetch).mock.calls.map(([url]) => String(url));
}

describe('NearbyProvidersScreen', () => {
  beforeEach(() => {
    readLocationMock.mockReset();
    readLocationMock.mockResolvedValue(PLACE);
    global.fetch = jest.fn(async () => jsonResponse(collection(TOW_TRUCK, WORKSHOP))) as typeof fetch;
  });

  it('shows the searching text and no map while the location loads', async () => {
    readLocationMock.mockReturnValue(new Promise(() => undefined));
    const { getByText, queryByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    expect(getByText('Buscando tu ubicación...')).toBeTruthy();
    expect(queryByTestId('pin-map')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('offers to read the location again when it fails', async () => {
    readLocationMock.mockRejectedValueOnce(new Error('denied')).mockResolvedValue(PLACE);
    const { findByTestId, findByText, getByLabelText, queryByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    expect(await findByText('No se pudo obtener la ubicación')).toBeTruthy();
    expect(queryByTestId('pin-map')).toBeNull();

    await fireEvent.press(getByLabelText('Actualizar ubicación'));

    expect(await findByTestId('pin-map')).toBeTruthy();
    expect(readLocationMock).toHaveBeenCalledTimes(2);
  });

  it('queries the configured radius around the position and centers the map on it', async () => {
    const { findByTestId, getByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);
    await findByTestId('provider-pin-seed-grua-01');

    expect(requestedUrls()).toEqual([expect.stringMatching(new RegExp(String.raw`lat=4\.6683&lon=-74\.0531&radio_km=${NEARBY_RADIUS_KM}$`))]);
    expect(getByTestId('pin-map').props.initialCamera).toEqual({
      center: { latitude: 4.6683, longitude: -74.0531 },
      zoom: 14,
      heading: 0,
      pitch: 0,
    });
  });

  it('starts with the category it was opened for', async () => {
    const { findByTestId, getByTestId } = await render(
      <NearbyProvidersScreen route={{ params: { filter: 'ambulancia' } }} />,
    );
    await findByTestId('provider-pin-seed-grua-01');

    expect(requestedUrls()).toEqual([expect.stringMatching(new RegExp(`radio_km=${NEARBY_RADIUS_KM}&servicio=ambulancia$`))]);
    expect(getByTestId('chip-ambulancia').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('chip-all').props.accessibilityState).toEqual({ selected: false });
  });

  it('draws one pin per provider', async () => {
    const { findAllByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    const pins = await findAllByTestId(/^provider-pin-/);

    expect(pins).toHaveLength(2);
  });

  it('queries again with the category chosen in the filter and without it for "Todos"', async () => {
    const { findByTestId, getByText } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);
    await findByTestId('provider-pin-seed-grua-01');

    await fireEvent.press(getByText('Grúas'));
    await waitFor(() => expect(requestedUrls()).toHaveLength(2));
    expect(requestedUrls()[1]).toMatch(new RegExp(`radio_km=${NEARBY_RADIUS_KM}&servicio=grua$`));

    await fireEvent.press(getByText('Todos'));
    await waitFor(() => expect(requestedUrls()).toHaveLength(3));
    expect(requestedUrls()[2]).not.toContain('servicio');
  });

  it('shows the name, category, distance, arrival and rating of a tapped pin', async () => {
    const { findByTestId, getByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    await fireEvent.press(await findByTestId('provider-pin-seed-grua-01'));

    const summary = within(getByTestId('provider-summary'));
    expect(summary.getByText('Grúas Aliadas Chapinero')).toBeTruthy();
    expect(summary.getByText('Grúa')).toBeTruthy();
    expect(summary.getByText('2,4 km')).toBeTruthy();
    expect(summary.getByText('Llegada estimada: ~11 min')).toBeTruthy();
    expect(summary.getByText('Calificación: 4,5 / 5')).toBeTruthy();
  });

  it('shows "Sin calificación" for a provider without a rating', async () => {
    const { findByTestId, getByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    await fireEvent.press(await findByTestId('provider-pin-osm-node-101'));

    expect(within(getByTestId('provider-summary')).getByText('Sin calificación')).toBeTruthy();
  });

  it('replaces the summary when another pin is tapped and clears it when the map is tapped', async () => {
    const { findByTestId, getByTestId, queryByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    await fireEvent.press(await findByTestId('provider-pin-seed-grua-01'));
    await fireEvent.press(getByTestId('provider-pin-osm-node-101'));

    const summary = within(getByTestId('provider-summary'));
    expect(summary.getByText('Taller El Rayo')).toBeTruthy();
    expect(summary.queryByText('Grúas Aliadas Chapinero')).toBeNull();

    await fireEvent.press(getByTestId('pin-map'));

    expect(queryByTestId('provider-summary')).toBeNull();
  });

  it('keeps the summary open when the map also reports the tap on a marker', async () => {
    const { findByTestId, getByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    await fireEvent.press(await findByTestId('provider-pin-seed-grua-01'));
    await fireEvent(getByTestId('pin-map'), 'press', { nativeEvent: { action: 'marker-press' } });

    expect(getByTestId('provider-summary')).toBeTruthy();
  });

  it('closes the summary when the filter changes', async () => {
    const { findByTestId, getByText, queryByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    await fireEvent.press(await findByTestId('provider-pin-seed-grua-01'));
    await fireEvent.press(getByText('Talleres'));

    expect(queryByTestId('provider-summary')).toBeNull();
  });

  it('says so when nothing is in range', async () => {
    global.fetch = jest.fn(async () => jsonResponse(collection())) as typeof fetch;
    const { findByText, getByText, queryAllByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    expect(await findByText(`No hay prestadores en ${NEARBY_RADIUS_KM} km.`)).toBeTruthy();
    expect(queryAllByTestId(/^provider-pin-/)).toHaveLength(0);

    await fireEvent.press(getByText('Grúas'));

    expect(await findByText(`No hay grúas en ${NEARBY_RADIUS_KM} km.`)).toBeTruthy();
  });

  it('shows an error with a retry that queries again', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'Servicio no disponible.' }, 503))
      .mockResolvedValue(jsonResponse(collection(TOW_TRUCK))) as typeof fetch;
    const { findByText, findByTestId, getByTestId, getByText, queryByText } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    expect(await findByText('No se pudieron cargar los prestadores.')).toBeTruthy();
    expect(getByTestId('pin-map')).toBeTruthy();

    await fireEvent.press(getByText('Reintentar'));

    expect(await findByTestId('provider-pin-seed-grua-01')).toBeTruthy();
    expect(queryByText('No se pudieron cargar los prestadores.')).toBeNull();
  });

  it('ignores a late answer for a filter that is no longer chosen', async () => {
    let releaseFirst: (value: ReturnType<typeof jsonResponse>) => void = () => undefined;
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValue(jsonResponse(collection(WORKSHOP))) as typeof fetch;
    const { findByTestId, getByText, queryByTestId } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await fireEvent.press(getByText('Talleres'));
    await findByTestId('provider-pin-osm-node-101');
    releaseFirst(jsonResponse(collection(TOW_TRUCK)));

    await waitFor(() => expect(queryByTestId('provider-pin-seed-grua-01')).toBeNull());
    expect(queryByTestId('provider-pin-osm-node-101')).toBeTruthy();
  });

  it('reads the location again and queries around the new position from the header', async () => {
    const { findByTestId, getByText } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);
    await findByTestId('provider-pin-seed-grua-01');
    readLocationMock.mockResolvedValueOnce({ ...PLACE, latitude: 4.711, longitude: -74.0721 });

    await fireEvent.press(getByText('Actualizar'));

    await waitFor(() => expect(requestedUrls()).toHaveLength(2));
    expect(readLocationMock).toHaveBeenLastCalledWith({ fresh: true });
    expect(requestedUrls()[1]).toMatch(new RegExp(String.raw`lat=4\.711&lon=-74\.0721&radio_km=${NEARBY_RADIUS_KM}$`));
  });

  it('credits OpenStreetMap', async () => {
    const { findByText } = await render(<NearbyProvidersScreen route={{ params: undefined }} />);

    expect(await findByText('Datos: © colaboradores de OpenStreetMap')).toBeTruthy();
  });
});
