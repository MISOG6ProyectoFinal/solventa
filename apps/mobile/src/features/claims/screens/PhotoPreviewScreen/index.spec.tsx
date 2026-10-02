import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import { useClaimPhotos } from '../../claimPhotos';
import ReportClaimScreen from '../ReportClaimScreen';
import PhotoPreviewScreen from './index';

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

const route = { params: { filePath: '/tmp/foto.jpg' } };

describe('PhotoPreviewScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
    useClaimPhotos.getState().clear();
    useClaimPhotos.getState().addPhoto({ filePath: '/tmp/foto.jpg', bytes: 1536 });
    useClaimPhotos.getState().addPhoto({ filePath: '/tmp/otra.jpg', bytes: 2048 });
  });

  it('shows the saved photo in full', async () => {
    const { getByText, getByTestId, getByLabelText } = await render(<PhotoPreviewScreen route={route} />);
    const photo = getByTestId('photo-preview');

    expect(getByText('Evidencia')).toBeTruthy();
    expect(getByText('Foto 1')).toBeTruthy();
    expect(photo.props.source).toEqual({ uri: 'file:///tmp/foto.jpg' });
    expect(photo.props.resizeMode).toBe('contain');
    expect(getByText('Eliminar')).toBeTruthy();
    expect(getByLabelText('Volver')).toBeTruthy();
  });

  it('returns to the report without removing the photo', async () => {
    const preview = await render(<PhotoPreviewScreen route={route} />);

    await fireEvent.press(preview.getByLabelText('Volver'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);

    const report = await render(<ReportClaimScreen />);

    expect(report.getByText('Foto 1')).toBeTruthy();
    expect(report.getByText('Foto 2')).toBeTruthy();
    expect(report.getByText('2/10')).toBeTruthy();
  });

  it('removes the photo and returns to the report', async () => {
    const preview = await render(<PhotoPreviewScreen route={route} />);

    await fireEvent.press(preview.getByText('Eliminar'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);

    const report = await render(<ReportClaimScreen />);

    expect(report.queryByText('Foto 1')).toBeNull();
    expect(report.getByText('Foto 2')).toBeTruthy();
    expect(report.getByText('1/10')).toBeTruthy();
  });
});
