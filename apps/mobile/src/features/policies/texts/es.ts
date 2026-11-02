export const es = {
  policies: {
    screenTitle: 'Pólizas',
    emptyMessage: 'Aún no tienes pólizas activas.',
    loadFailed: 'No se pudieron cargar las pólizas.',
    statusActive: 'ACTIVA',
    issued: 'Tu póliza fue emitida y tu seguro ya está activo',
    issueFailed:
      'La compra no pudo finalizar: el pago fue aprobado pero la póliza no se emitió, por lo que no tienes cobertura activa. Contacta soporte.',
    policyNumber: (numero: string) => `Póliza ${numero}`,
    start: (fecha: string) => `Inicio ${fecha}`,
    end: (fecha: string) => `Fin ${fecha}`,
    prima: (amount: string) => `Prima ${amount}`,
    viewPolicy: 'Ver mi póliza',
    detailTitle: 'Mi póliza',
    renewalOfferAvailable: 'Oferta de renovación disponible',
    renewalOfferTitle: 'Oferta de renovación',
    renewalOfferBody: (days: number) =>
      `Tu póliza vence en ${days} días. Consultar la oferta no modifica tu póliza actual.`,
    seeRenewalOffer: 'Ver oferta de renovación',
  },
  renewal: {
    screenTitle: 'Oferta de renovación',
    loading: 'Cargando',
    loadFailed: 'No se pudo consultar la oferta de renovación.',
    retryButton: 'Reintentar',
    disclaimer: 'Consultar esta oferta no modifica tu póliza actual.',
    currentPremium: 'Prima actual',
    newPremium: 'Nueva prima',
    newValidityPrefix: 'Nueva vigencia:',
  },
};

export type Texts = typeof es;
