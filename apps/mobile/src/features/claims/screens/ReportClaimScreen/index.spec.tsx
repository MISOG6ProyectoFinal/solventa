import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import ReportClaimScreen from './index';

jest.mock('@react-navigation/native', () => {
  const goBack = jest.fn();
  return {
    useNavigation: () => ({
      goBack,
      canGoBack: () => true,
    }),
  };
});

describe('ReportClaimScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
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
    expect(getByText('Calle 85 #12-34, Chapinero, Bogotá')).toBeTruthy();
    expect(getByText('GPS 4.6683, -74.0531 (±8 m)')).toBeTruthy();
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

  it('returns to the claims list', async () => {
    const { getByLabelText } = await render(<ReportClaimScreen />);

    await fireEvent.press(getByLabelText('Volver'));

    expect(useNavigation().goBack).toHaveBeenCalledTimes(1);
  });
});
