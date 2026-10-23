import { NEARBY_RADIUS_KM } from '../constants';
import { type Texts } from './es';

export const en: Texts = {
  providers: {
    screenTitle: 'Nearby assistance',
    refreshButton: 'Refresh',
    locationPending: 'Finding your location...',
    locationUnavailable: 'Could not get your location',
    refreshLocation: 'Refresh location',
    loading: 'Loading providers...',
    loadFailed: 'Could not load the providers.',
    retryButton: 'Retry',
    empty: (scope) => `No ${scope} within ${NEARBY_RADIUS_KM} km.`,
    emptyScope: 'providers',
    attribution: 'Data: © OpenStreetMap contributors',
    distance: (km) => `${km} km`,
    eta: (minutes) => `Estimated arrival: ~${minutes} min`,
    rating: (value) => `Rating: ${value} / 5`,
    noRating: 'No rating',
    filters: {
      all: 'All',
      grua: 'Tow trucks',
      taller: 'Workshops',
      perito: 'Adjusters',
      ambulancia: 'Ambulances',
    },
    categories: {
      grua: 'Tow truck',
      taller: 'Workshop',
      perito: 'Adjuster',
      ambulancia: 'Ambulance',
    },
  },
};
