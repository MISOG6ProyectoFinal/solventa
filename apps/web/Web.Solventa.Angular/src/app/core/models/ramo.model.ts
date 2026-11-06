export type RamoId = string;

export interface RamoProduct {
  readonly id: string;
  readonly name: string;
  readonly requiresConsent: boolean;
}

export interface Ramo {
  readonly id: RamoId;
  readonly name: string;
  readonly requiresConsent: boolean;
  readonly products: readonly RamoProduct[];
}
