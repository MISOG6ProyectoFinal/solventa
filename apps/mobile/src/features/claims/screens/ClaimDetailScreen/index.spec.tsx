import { render } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';

import ClaimDetailScreen from './index';

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

const report = {
  radicado: 'SIN-18247',
  claimType: 'Accidente con vehículo de alquiler',
  policy: 'Viaje Internacional · SLV-2026-03105',
  occurredAt: '2026-09-12 10:30',
  location: 'Calle 85 #12-34, Chapinero, Bogotá',
  description: 'Descripción...',
  evidences: [{ label: 'Foto 1', capturedAt: '00:45' }],
};

describe('ClaimDetailScreen', () => {
  beforeEach(() => {
    useNavigation().goBack.mockClear();
  });

  it('shows the filed report', async () => {
    const { getByText } = await render(<ClaimDetailScreen route={{ params: report }} />);

    expect(getByText('Detalle del reporte')).toBeTruthy();
    expect(getByText('Siniestro #SIN-18247 radicado exitosamente.')).toBeTruthy();
    expect(getByText('Accidente con vehículo de alquiler')).toBeTruthy();
    expect(getByText('Radicado')).toBeTruthy();
    expect(getByText('Viaje Internacional · SLV-2026-03105')).toBeTruthy();
    expect(getByText('Ocurrió 2026-09-12 10:30 · Calle 85 #12-34, Chapinero, Bogotá')).toBeTruthy();
    expect(getByText('Descripción...')).toBeTruthy();
    expect(getByText('Evidencias (1)')).toBeTruthy();
    expect(getByText('Foto 1')).toBeTruthy();
    expect(getByText('00:45')).toBeTruthy();
    expect(getByText('Solicitar asistencia en sitio')).toBeTruthy();
  });
});
