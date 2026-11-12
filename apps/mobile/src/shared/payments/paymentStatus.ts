export const PAYMENT_STATUS = {
  approved: 'aprobado',
  rejected: 'rechazado',
  processing: 'procesando',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
