import { NEARBY_RADIUS_KM } from './constants';

export const texts = {
  providers: {
    screenTitle: 'Asistencia cercana',
    refreshButton: 'Actualizar',
    locationPending: 'Buscando tu ubicación...',
    locationUnavailable: 'No se pudo obtener la ubicación',
    refreshLocation: 'Actualizar ubicación',
    loading: 'Cargando prestadores...',
    loadFailed: 'No se pudieron cargar los prestadores.',
    retryButton: 'Reintentar',
    empty: (scope: string) => `No hay ${scope} en ${NEARBY_RADIUS_KM} km.`,
    emptyScope: 'prestadores',
    attribution: 'Datos: © colaboradores de OpenStreetMap',
    distance: (km: string) => `${km} km`,
    eta: (minutes: number) => `Llegada estimada: ~${minutes} min`,
    rating: (value: string) => `Calificación: ${value} / 5`,
    noRating: 'Sin calificación',
    filters: {
      all: 'Todos',
      grua: 'Grúas',
      taller: 'Talleres',
      perito: 'Peritos',
      ambulancia: 'Ambulancias',
    },
    categories: {
      grua: 'Grúa',
      taller: 'Taller',
      perito: 'Perito',
      ambulancia: 'Ambulancia',
    },
  },
};
