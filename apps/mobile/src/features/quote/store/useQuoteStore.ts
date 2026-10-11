import { create } from 'zustand';

import { OfertaCotizacion, ProductoMovil } from '../types';

type QuoteState = {
  product: ProductoMovil | null;
  oferta: OfertaCotizacion | null;
  selectProduct: (product: ProductoMovil) => void;
  setOferta: (oferta: OfertaCotizacion) => void;
  clear: () => void;
};

export const useQuoteStore = create<QuoteState>((set) => ({
  product: null,
  oferta: null,
  selectProduct: (product) => set({ product, oferta: null }),
  setOferta: (oferta) => set({ oferta }),
  clear: () => set({ product: null, oferta: null }),
}));
