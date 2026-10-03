import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { usePhotoOutput } from 'react-native-vision-camera';

import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import ReportClaimScreen from '../ReportClaimScreen';
import TakePhotoScreen from './index';

jest.mock('../../../../shared/location', () => ({
  readLocation: jest.fn(() =>
    Promise.resolve({
      address: 'Carrera 7 #32-16, La Candelaria, Bogotá',
      gps: 'GPS 4.5981, -74.0760 (±12 m)',
    }),
  ),
}));

jest.mock('@react-navigation/native', () => {
  const goBack = jest.fn();
  return {
    useNavigation: () => ({
      goBack,
      canGoBack: () => true,
    }),
  };
});

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const photo = {
    getFileDataAsync: () => Promise.resolve(new Uint8Array(1536).buffer),
    saveToTemporaryFileAsync: () => Promise.resolve('/tmp/foto.jpg'),
    dispose: () => undefined,
  };
  const capturePhoto = jest.fn(() => Promise.resolve(photo));
  const requestPermission = jest.fn(() => Promise.resolve(true));

  return {
    Camera: (props: object) => React.createElement('Camera', props),
    usePhotoOutput: () => ({ capturePhoto }),
    useCameraPermission: () => ({
      hasPermission: true,
      canRequestPermission: false,
      requestPermission,
      status: 'authorized',
    }),
  };
});

describe('TakePhotoScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
    usePhotoOutput().capturePhoto.mockClear();
    useClaimPhotosStore.getState().clear();
  });

  it('shows the viewfinder for the damage photo', async () => {
    const { getByText, getByLabelText } = await render(<TakePhotoScreen />);

    expect(getByText('Tomar foto')).toBeTruthy();
    expect(getByText('Cámara')).toBeTruthy();
    expect(getByText('Encuadra el daño y captura')).toBeTruthy();
    await waitFor(() => {
      expect(getByText('GPS 4.5981, -74.0760 (±12 m)')).toBeTruthy();
    });
    expect(getByText('Cancelar')).toBeTruthy();
    expect(getByText('Capturar')).toBeTruthy();
    expect(getByLabelText('Volver')).toBeTruthy();
  });

  it('returns to the report without a photo', async () => {
    const { getByText } = await render(<TakePhotoScreen />);

    await fireEvent.press(getByText('Cancelar'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);
    expect(usePhotoOutput().capturePhoto).not.toHaveBeenCalled();
  });

  it('captures a photo from the back camera and asks to confirm it', async () => {
    const { getByTestId, getByText, queryByText } = await render(<TakePhotoScreen />);
    const camera = getByTestId('camera-preview');

    expect(camera.props.device).toBe('back');
    expect(camera.props.isActive).toBe(true);

    await fireEvent.press(getByText('Capturar'));

    expect(usePhotoOutput().capturePhoto).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(getByText('Vista previa')).toBeTruthy();
    });
    expect(getByTestId('photo-preview').props.source).toEqual({ uri: 'file:///tmp/foto.jpg' });
    expect(getByText('Confirmar')).toBeTruthy();
    expect(getByText('Cancelar')).toBeTruthy();
    expect(queryByText('Capturar')).toBeNull();
    expect(useNavigation().goBack).not.toHaveBeenCalled();
  });

  it('returns to the camera when the preview is cancelled', async () => {
    const { getByText, queryByText } = await render(<TakePhotoScreen />);

    await fireEvent.press(getByText('Capturar'));
    await waitFor(() => {
      expect(getByText('Confirmar')).toBeTruthy();
    });
    await fireEvent.press(getByText('Cancelar'));

    expect(getByText('Capturar')).toBeTruthy();
    expect(queryByText('Confirmar')).toBeNull();
    expect(queryByText('Vista previa')).toBeNull();
    expect(useNavigation().goBack).not.toHaveBeenCalled();
  });

  it('shows Foto 1 on the report when the photo is confirmed', async () => {
    const camera = await render(<TakePhotoScreen />);

    await fireEvent.press(camera.getByText('Capturar'));
    await waitFor(() => {
      expect(camera.getByText('Confirmar')).toBeTruthy();
    });
    await fireEvent.press(camera.getByText('Confirmar'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);

    const report = await render(<ReportClaimScreen />);

    expect(report.getByText('Foto 1')).toBeTruthy();
    expect(report.getByText('1,5 KB')).toBeTruthy();
    expect(report.getByTestId('evidence-photo').props.source).toEqual({ uri: 'file:///tmp/foto.jpg' });
    expect(report.getByText('1/10')).toBeTruthy();
  });
});
