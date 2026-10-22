import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { readLocation } from '../../../../shared/location';
import { Aviso } from '../../api/listAvisos';
import AssistanceServiceScreen from './index';

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

jest.mock('../../../../shared/location', () => ({
  readLocation: jest.fn(),
}));

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

const readLocationMock = readLocation as jest.Mock;

describe('AssistanceServiceScreen', () => {
  beforeEach(() => {
    useNavigation().navigate.mockClear();
    readLocationMock.mockReset();
    readLocationMock.mockResolvedValue(PLACE);
  });

  it('shows the policy banner, the three services and the current location', async () => {
    const { findByText, getByText } = await render(<AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />);

    expect(getByText('Asistencia en sitio')).toBeTruthy();
    expect(getByText('Póliza SLV-2026-03105 activa · incluye asistencia en sitio.')).toBeTruthy();
    expect(getByText('Grúa')).toBeTruthy();
    expect(getByText('Ambulancia')).toBeTruthy();
    expect(getByText('Perito')).toBeTruthy();
    expect(await findByText(PLACE.address)).toBeTruthy();
    expect(getByText(PLACE.gps)).toBeTruthy();
  });

  it('shows the location without a refresh control when it was read', async () => {
    const { findByText, queryByLabelText } = await render(
      <AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />,
    );
    await findByText(PLACE.address);

    expect(queryByLabelText('Actualizar ubicación')).toBeNull();
  });

  it('continues with Grúa selected by default', async () => {
    const { findByText, getByText } = await render(<AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />);
    await findByText(PLACE.address);

    await fireEvent.press(getByText('Continuar'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('AssistanceConfirm', {
      aviso: AVISO,
      service: 'grua',
      place: PLACE,
    });
  });

  it('continues with the service the person picked', async () => {
    const { findByText, getByText } = await render(<AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />);
    await findByText(PLACE.address);

    await fireEvent.press(getByText('Perito'));
    await fireEvent.press(getByText('Continuar'));

    expect(useNavigation().navigate).toHaveBeenCalledWith(
      'AssistanceConfirm',
      expect.objectContaining({ service: 'perito' }),
    );
  });

  it('opens the nearby providers map for the selected service', async () => {
    const { getByText } = await render(<AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />);

    await fireEvent.press(getByText('Ver prestadores cercanos'));
    expect(useNavigation().navigate).toHaveBeenLastCalledWith('NearbyProviders', { filter: 'grua' });

    await fireEvent.press(getByText('Ambulancia'));
    await fireEvent.press(getByText('Ver prestadores cercanos'));
    expect(useNavigation().navigate).toHaveBeenLastCalledWith('NearbyProviders', { filter: 'ambulancia' });
  });

  it('opens the nearby providers map without waiting for the location', async () => {
    readLocationMock.mockReturnValue(new Promise(() => undefined));
    const { getByText } = await render(<AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />);

    await fireEvent.press(getByText('Ver prestadores cercanos'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('NearbyProviders', { filter: 'grua' });
  });

  it('does not continue while the location is loading', async () => {
    let resolve: (place: typeof PLACE) => void = () => undefined;
    readLocationMock.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { findByText, getByText } = await render(<AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />);

    expect(getByText('Obteniendo ubicación')).toBeTruthy();
    await fireEvent.press(getByText('Continuar'));
    expect(useNavigation().navigate).not.toHaveBeenCalled();

    await act(async () => resolve(PLACE));
    await findByText(PLACE.address);
    await fireEvent.press(getByText('Continuar'));
    expect(useNavigation().navigate).toHaveBeenCalledTimes(1);
  });

  it('blocks continuing when the location cannot be read until it is refreshed', async () => {
    readLocationMock.mockRejectedValueOnce(new Error('sin GPS'));
    const { findByText, getByLabelText, getByText } = await render(
      <AssistanceServiceScreen route={{ params: { aviso: AVISO } }} />,
    );

    expect(await findByText('No se pudo obtener la ubicación')).toBeTruthy();
    await fireEvent.press(getByText('Continuar'));
    expect(useNavigation().navigate).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('Actualizar ubicación'));
    await waitFor(() => expect(getByText(PLACE.address)).toBeTruthy());
    await fireEvent.press(getByText('Continuar'));
    expect(useNavigation().navigate).toHaveBeenCalledTimes(1);
  });
});
