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
  },
};

export type Texts = typeof es;
