export type PolicyCoverage = {
  id: string;
  nombre: string;
};

export type Policy = {
  id: string;
  numero: string;
  cotizacion_id: string;
  cobro_id: string;
  producto_id: string;
  prima: string;
  estado: string;
  vigencia: {
    desde: string;
    hasta: string;
  };
  coberturas: PolicyCoverage[];
};
