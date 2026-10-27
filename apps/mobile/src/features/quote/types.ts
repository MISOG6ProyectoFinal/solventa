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
  vigente_hasta: string;
  version_reglas: string;
};

export type SimulacionPago = 'rechazado' | 'vencida';

export type ResultadoPago = {
  id: string;
  cotizacion_id: string;
  estado: 'aprobado' | 'rechazado' | 'procesando';
  monto: string;
  moneda: string;
};

export type QuoteFormError = 'required' | 'departureInPast' | 'returnBeforeDeparture' | 'travelersAtLeastOne';

export type QuoteFormValues = {
  nombre: string;
  cedula: string;
  destino: string;
  fechaSalida: string;
  fechaRegreso: string;
  viajeros: string;
};

export const destinos = ['Estados Unidos', 'España', 'México', 'Otro país'] as const;
