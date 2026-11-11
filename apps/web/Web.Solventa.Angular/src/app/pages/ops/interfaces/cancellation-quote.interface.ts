/** Recálculo de la devolución que hace Cotización y Rating al cancelar una póliza. */
export interface CancellationQuote {
  readonly termDays: number;
  readonly unearnedDays: number;
  readonly refund: number;
}
