export type ClaimChoice = {
  value: string;
  label: string;
};

export type ClaimReport = {
  title: string;
  policyLabel: string;
  policy: string;
  policies: ClaimChoice[];
  typeLabel: string;
  type: string;
  types: ClaimChoice[];
  occurredAtLabel: string;
  occurredAt: string;
  locationLabel: string;
  address: string;
  gps: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  evidenceTitle: string;
  evidenceCount: string;
  evidenceHint: string;
  takePhoto: string;
  recordVideo: string;
  submit: string;
  evidenceError: string;
};

export const claimReport: ClaimReport = {
  title: 'Reportar siniestro',
  policyLabel: 'Póliza afectada',
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
  typeLabel: 'Tipo de siniestro',
  type: 'Accidente con vehículo de alquiler',
  types: [
    {
      value: 'Accidente con vehículo de alquiler',
      label: 'Accidente con vehículo de alquiler',
    },
    { value: 'Pérdida de equipaje', label: 'Pérdida de equipaje' },
    { value: 'Emergencia médica', label: 'Emergencia médica' },
  ],
  occurredAtLabel: 'Fecha y hora de ocurrencia',
  occurredAt: '2026-09-12 10:30',
  locationLabel: 'Ubicación',
  address: 'Calle 85 #12-34, Chapinero, Bogotá',
  gps: 'GPS 4.6683, -74.0531 (±8 m)',
  descriptionLabel: 'Descripción',
  descriptionPlaceholder: 'Describe lo ocurrido',
  evidenceTitle: 'Evidencias',
  evidenceCount: '0/10',
  evidenceHint:
    'Videos de máximo 30 s y 50 MB. Los archivos se comprimen en tu teléfono antes de enviarse.',
  takePhoto: 'Tomar foto',
  recordVideo: 'Grabar video',
  submit: 'Enviar reporte',
  evidenceError: 'Agrega al menos una evidencia',
};
