export interface CoberturaOfertaDto {
  readonly id: string;
  readonly nombre: string;
}

export interface VigenciaPropuestaDto {
  readonly desde: string;
  readonly hasta: string;
}

export interface DesgloseCotizacionDto {
  readonly prima_basica: number;
  readonly recargo_riesgo: number;
  readonly coberturas_adicionales: number;
  readonly impuestos: number;
  readonly total: number;
}

export interface OfertaCotizacionResponse {
  readonly id: string;
  readonly producto_id: string;
  readonly prima: number;
  readonly coberturas: readonly CoberturaOfertaDto[];
  readonly vigencia_propuesta: VigenciaPropuestaDto;
  readonly version_reglas: string;
  readonly estado?: string;
  readonly vigente_hasta?: string;
  readonly degradada?: boolean;
  readonly desglose?: DesgloseCotizacionDto | null;
  readonly cliente_id?: string | null;
  readonly consentimiento_id?: string | null;
}
