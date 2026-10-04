/** Datos capturados en el paso de edición del endoso. */
export interface EndorsementDraft {
  readonly type: string;
  readonly effectiveDate: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly reason: string;
}
