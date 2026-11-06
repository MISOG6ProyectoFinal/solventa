export interface RamoProduct {
  readonly id: string;
  readonly name: string;
  readonly requiresConsent: boolean;
}

export interface Ramo {
  readonly id: string;
  readonly name: string;
  readonly requiresConsent: boolean;
  readonly products: readonly RamoProduct[];
}
