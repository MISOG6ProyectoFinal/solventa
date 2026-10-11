export type CoberturaMovil = {
  id: string;
  nombre: string;
};

export type ProductoMovil = {
  id: string;
  nombre: string;
  descripcion: string;
  precio_desde: string;
  disponible: boolean;
  coberturas: CoberturaMovil[];
};

export type OfertaCotizacion = {
  id: string;
  producto_id: string;
  prima: string;
  coberturas: CoberturaMovil[];
  vigencia_propuesta: {
    desde: string;
    hasta: string;
  };
  version_reglas: string;
};

export type QuoteFormValues = {
  nombre: string;
  cedula: string;
  destino: string;
  fechaSalida: string;
  fechaRegreso: string;
  viajeros: string;
};

export const destinos = ['Estados Unidos', 'España', 'México', 'Otro país'] as const;
