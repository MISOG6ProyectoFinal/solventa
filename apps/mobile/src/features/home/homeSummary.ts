export type HomeDestination = 'Policies' | 'Claims' | 'Buy';

export type HomeShortcut = {
  id: string;
  title: string;
  hint: string;
  destination: HomeDestination;
};

export type HomeRenewal = {
  badge: string;
  productName: string;
  policyNumber: string;
  validUntil: string;
};

export type HomeSummary = {
  greeting: string;
  coverageLabel: string;
  policyCount: number;
  shortcuts: HomeShortcut[];
  renewal: HomeRenewal;
};

export const homeSummary: HomeSummary = {
  greeting: 'Hola, María',
  coverageLabel: 'Cobertura activa',
  policyCount: 3,
  shortcuts: [
    {
      id: 'claims',
      title: 'Siniestros',
      hint: 'Consulta y reporta',
      destination: 'Claims',
    },
    {
      id: 'buy',
      title: 'Comprar seguro',
      hint: 'Cotiza y paga en minutos',
      destination: 'Buy',
    },
  ],
  renewal: {
    badge: 'Próxima a renovar',
    productName: 'Protección Celular',
    policyNumber: 'SLV-2025-01820',
    validUntil: '2026-10-05',
  },
};
