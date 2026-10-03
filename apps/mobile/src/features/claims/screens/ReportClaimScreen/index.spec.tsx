import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { readLocation } from '../../../../shared/location';
import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import ReportClaimScreen from './index';

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

describe('ReportClaimScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
    useNavigation().navigate.mockClear();
    useClaimPhotosStore.getState().clear();
    jest.mocked(readLocation).mockReset();
    jest.mocked(readLocation).mockResolvedValue(currentPlace);
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

  it('opens a saved video', async () => {
    useClaimPhotosStore.getState().addVideo({ filePath: '/tmp/video.mp4', bytes: 1536 });
    const { getByLabelText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByLabelText('Video 1'));

    expect(useNavigation().navigate).toHaveBeenCalledWith('ClaimReport', {
      screen: 'VideoPreview',
      params: { filePath: '/tmp/video.mp4' },
    });
  });

  it('accepts a video as evidence', async () => {
    useClaimPhotosStore.getState().addVideo({ filePath: '/tmp/video.mp4', bytes: 1536 });
    const { getByText, getByPlaceholderText, queryByText } = await render(<ReportClaimScreen />);

    expect(getByText('Video 1')).toBeTruthy();
    expect(getByText('1,5 KB')).toBeTruthy();
    expect(getByText('1/10')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('Describe lo ocurrido'), 'Choque en la calle 85');
    await fireEvent.press(getByText('Enviar reporte'));

    expect(queryByText('Agrega al menos una evidencia')).toBeNull();
  });

  it('opens a saved photo', async () => {
    useClaimPhotosStore.getState().addPhoto({ filePath: '/tmp/foto.jpg', bytes: 1536 });
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
