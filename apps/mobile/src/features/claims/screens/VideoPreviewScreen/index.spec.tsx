import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import ReportClaimScreen from '../ReportClaimScreen';
import VideoPreviewScreen from './index';

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
  const navigate = jest.fn();
  return {
    useNavigation: () => ({
      goBack,
      navigate,
      canGoBack: () => true,
    }),
  };
});

const route = { params: { filePath: '/tmp/video.mp4' } };

describe('VideoPreviewScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
    useClaimPhotosStore.getState().clear();
    useClaimPhotosStore.getState().addVideo({ filePath: '/tmp/video.mp4', bytes: 1536 });
    useClaimPhotosStore.getState().addVideo({ filePath: '/tmp/otro.mp4', bytes: 2048 });
  });

  it('plays the saved video', async () => {
    const { getByText, getByTestId, getByLabelText } = await render(<VideoPreviewScreen route={route} />);
    const video = getByTestId('video-preview');

    expect(getByText('Evidencia')).toBeTruthy();
    expect(getByText('Video 1')).toBeTruthy();
    expect(video.props.source).toEqual({ uri: 'file:///tmp/video.mp4' });
    expect(video.props.paused).toBe(true);
    expect(getByText('Eliminar')).toBeTruthy();
    expect(getByLabelText('Volver')).toBeTruthy();

    await fireEvent.press(getByLabelText('Reproducir'));

    expect(getByTestId('video-preview').props.paused).toBe(false);

    await fireEvent.press(getByLabelText('Pausar'));

    expect(getByTestId('video-preview').props.paused).toBe(true);

    await fireEvent.press(getByLabelText('Reproducir'));
    await fireEvent(getByTestId('video-preview'), 'onEnd');

    expect(getByTestId('video-preview').props.paused).toBe(true);
    expect(getByLabelText('Reproducir')).toBeTruthy();
  });

  it('returns to the report without removing the video', async () => {
    const preview = await render(<VideoPreviewScreen route={route} />);

    await fireEvent.press(preview.getByLabelText('Volver'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);

    const report = await render(<ReportClaimScreen />);

    expect(report.getByText('Video 1')).toBeTruthy();
    expect(report.getByText('Video 2')).toBeTruthy();
    expect(report.getByText('2/10')).toBeTruthy();
  });

  it('removes the video and returns to the report', async () => {
    const preview = await render(<VideoPreviewScreen route={route} />);

    await fireEvent.press(preview.getByText('Eliminar'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);

    const report = await render(<ReportClaimScreen />);

    expect(report.queryByText('Video 1')).toBeNull();
    expect(report.getByText('Video 2')).toBeTruthy();
    expect(report.getByText('1/10')).toBeTruthy();
  });
});
