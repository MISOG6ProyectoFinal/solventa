/** Datos capturados en el formulario de endoso de datos del asegurado. */
export interface EndorsementDraft {
  readonly effectiveDate: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly reason: string;
}
