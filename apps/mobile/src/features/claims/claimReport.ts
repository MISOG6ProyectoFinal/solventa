import { ClaimReport } from "./types";

export const claimReport: ClaimReport = {
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
