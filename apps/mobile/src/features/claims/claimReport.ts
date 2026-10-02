export type ClaimReport = {
  title: string;
  policyLabel: string;
  policy: string;
  typeLabel: string;
  type: string;
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
  typeLabel: 'Tipo de siniestro',
  type: 'Accidente con vehículo de alquiler',
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
