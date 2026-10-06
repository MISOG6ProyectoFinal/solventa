import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { useVideoOutput } from 'react-native-vision-camera';

import { useClaimPhotosStore } from '../../store/useClaimPhotosStore';
import ReportClaimScreen from '../ReportClaimScreen';
import RecordVideoScreen from './index';

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
  let finish: (filePath: string, reason: string) => void = () => undefined;
  const recorder = {
    recordedFileSize: 1536,
    recordedDuration: 0,
    filePath: '/tmp/video.mp4',
    isRecording: false,
    isPaused: false,
    startRecording: jest.fn((onFinished: (filePath: string, reason: string) => void) => {
      finish = onFinished;
      return Promise.resolve();
    }),
    stopRecording: jest.fn(() => {
      finish('/tmp/video.mp4', 'stopped');
      return Promise.resolve();
    }),
    cancelRecording: jest.fn(() => Promise.resolve()),
  };
  const createRecorder = jest.fn(() => Promise.resolve(recorder));
  const requestPermission = jest.fn(() => Promise.resolve(true));
  const useVideoOutput = jest.fn(() => ({ createRecorder }));

  return {
    Camera: (props: object) => React.createElement('Camera', props),
    useVideoOutput,
    recorder,
    useCameraPermission: () => ({
      hasPermission: true,
      canRequestPermission: false,
      requestPermission,
      status: 'authorized',
    }),
    useMicrophonePermission: () => ({
      hasPermission: true,
      canRequestPermission: false,
      requestPermission,
      status: 'authorized',
    }),
    finishRecording: (reason: string) => finish('/tmp/video.mp4', reason),
  };
});

describe('RecordVideoScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
    useVideoOutput().createRecorder.mockClear();
    useClaimPhotosStore.getState().clear();
    jest.requireMock('react-native-vision-camera').recorder.recordedFileSize = 1536;
  });

  it('shows the viewfinder with a 30 second limit', async () => {
    const { getByText, getByLabelText } = await render(<RecordVideoScreen />);

    expect(getByText('Grabar video')).toBeTruthy();
    expect(getByText('Máximo 30 s')).toBeTruthy();
    expect(getByText('Grabar')).toBeTruthy();
    expect(getByText('Cancelar')).toBeTruthy();
    expect(getByLabelText('Volver')).toBeTruthy();
    await waitFor(() => {
      expect(getByText('GPS 4.5981, -74.0760 (±12 m)')).toBeTruthy();
    });
  });

  it('records for at most 30 seconds and asks to confirm', async () => {
    const { getByText } = await render(<RecordVideoScreen />);

    await fireEvent.press(getByText('Grabar'));

    await waitFor(() => {
      expect(getByText('Detener')).toBeTruthy();
    });
    expect(useVideoOutput().createRecorder).toHaveBeenCalledWith({ maxDuration: 30 });

    await fireEvent.press(getByText('Detener'));

    await waitFor(() => {
      expect(getByText('Confirmar')).toBeTruthy();
    });
    expect(getByText('Vista previa')).toBeTruthy();
  });

  it('plays the recorded video from the preview', async () => {
    const { getByText, getByLabelText, getByTestId } = await render(<RecordVideoScreen />);

    await fireEvent.press(getByText('Grabar'));
    await waitFor(() => {
      expect(getByText('Detener')).toBeTruthy();
    });
    await fireEvent.press(getByText('Detener'));

    const video = await waitFor(() => getByTestId('video-preview'));

    expect(video.props.source).toEqual({ uri: 'file:///tmp/video.mp4' });
    expect(video.props.paused).toBe(true);

    await fireEvent.press(getByLabelText('Reproducir'));

    expect(getByTestId('video-preview').props.paused).toBe(false);

    await fireEvent.press(getByLabelText('Pausar'));

    expect(getByTestId('video-preview').props.paused).toBe(true);
    expect(getByLabelText('Reproducir')).toBeTruthy();

    await fireEvent.press(getByLabelText('Reproducir'));
    await fireEvent(getByTestId('video-preview'), 'onEnd');

    expect(getByTestId('video-preview').props.paused).toBe(true);
    expect(getByLabelText('Reproducir')).toBeTruthy();
  });

  it('shows the confirm step when the 30 second limit stops the recording', async () => {
    const { finishRecording } = jest.requireMock('react-native-vision-camera');
    const { getByText, queryByText } = await render(<RecordVideoScreen />);

    await fireEvent.press(getByText('Grabar'));
    await waitFor(() => {
      expect(getByText('Detener')).toBeTruthy();
    });
    await act(async () => {
      finishRecording('max-duration-reached');
    });

    await waitFor(() => {
      expect(getByText('Confirmar')).toBeTruthy();
    });
    expect(queryByText('Detener')).toBeNull();
  });

  it('returns to the report without a video', async () => {
    const { getByText } = await render(<RecordVideoScreen />);

    await fireEvent.press(getByText('Cancelar'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);
    expect(useVideoOutput().createRecorder).not.toHaveBeenCalled();
  });

  it('returns to the camera when the preview is cancelled', async () => {
    const { getByText, queryByText } = await render(<RecordVideoScreen />);

    await fireEvent.press(getByText('Grabar'));
    await waitFor(() => {
      expect(getByText('Detener')).toBeTruthy();
    });
    await fireEvent.press(getByText('Detener'));
    await waitFor(() => {
      expect(getByText('Confirmar')).toBeTruthy();
    });
    await fireEvent.press(getByText('Cancelar'));

    expect(getByText('Grabar')).toBeTruthy();
    expect(queryByText('Confirmar')).toBeNull();
    expect(useNavigation().goBack).not.toHaveBeenCalled();
  });

  it('shows Video 1 on the report when the video is confirmed', async () => {
    const camera = await render(<RecordVideoScreen />);

    await fireEvent.press(camera.getByText('Grabar'));
    await waitFor(() => {
      expect(camera.getByText('Detener')).toBeTruthy();
    });
    await fireEvent.press(camera.getByText('Detener'));
    await waitFor(() => {
      expect(camera.getByText('Confirmar')).toBeTruthy();
    });
    await fireEvent.press(camera.getByText('Confirmar'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);

    const report = await render(<ReportClaimScreen />);

    expect(report.getByText('Video 1')).toBeTruthy();
    expect(report.getByText('1,5 KB')).toBeTruthy();
    expect(report.getByText('1/10')).toBeTruthy();
  });

  it('records a compressed mp4', async () => {
    await render(<RecordVideoScreen />);

    expect(useVideoOutput).toHaveBeenCalledWith({
      enableAudio: true,
      targetBitRate: 4_000_000,
      fileType: 'mp4',
    });
  });

  it('refuses a video larger than 50 MB', async () => {
    const { recorder } = jest.requireMock('react-native-vision-camera');
    recorder.recordedFileSize = 52_428_801;
    const camera = await render(<RecordVideoScreen />);

    await fireEvent.press(camera.getByText('Grabar'));
    await waitFor(() => {
      expect(camera.getByText('Detener')).toBeTruthy();
    });
    await fireEvent.press(camera.getByText('Detener'));
    await waitFor(() => {
      expect(camera.getByText('Confirmar')).toBeTruthy();
    });
    await fireEvent.press(camera.getByText('Confirmar'));

    expect(camera.getByText('El archivo supera 50 MB.')).toBeTruthy();
    expect(useNavigation().goBack).not.toHaveBeenCalled();

    const report = await render(<ReportClaimScreen />);
    expect(report.getByText('0/10')).toBeTruthy();
  });
});
