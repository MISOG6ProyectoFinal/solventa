import { ClaimReport } from "./types";

export const claimReport: ClaimReport = {
  policy: 'Viaje Internacional · SLV-2026-03105',
  policies: [
    {
      value: 'Viaje Internacional · SLV-2026-03105',
      label: 'Viaje Internacional · SLV-2026-03105',
    },
    {
      value: 'Protección Celular · SLV-2025-01820',
      label: 'Protección Celular · SLV-2025-01820',
    },
  ],
  claimType: 'Accidente con vehículo de alquiler',
  claimTypes: [
    {
      value: 'Accidente con vehículo de alquiler',
      label: 'Accidente con vehículo de alquiler',
    },
    { value: 'Pérdida de equipaje', label: 'Pérdida de equipaje' },
    { value: 'Emergencia médica', label: 'Emergencia médica' },
  ],
  occurredAt: '2026-09-12 10:30',
};
