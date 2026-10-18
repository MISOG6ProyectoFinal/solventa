export interface CoberturaOfertaDto {
  readonly id: string;
  readonly nombre: string;
}

export interface VigenciaPropuestaDto {
  readonly desde: string;
  readonly hasta: string;
}

export interface OfertaCotizacionResponse {
  readonly id: string;
  readonly producto_id: string;
  readonly prima: number;
  readonly coberturas: readonly CoberturaOfertaDto[];
  readonly vigencia_propuesta: VigenciaPropuestaDto;
  readonly version_reglas: string;
}
