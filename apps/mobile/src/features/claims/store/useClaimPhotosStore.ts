import { create } from 'zustand';
import { photoLimit } from '../constants';
import { ClaimPhotos } from './types';

export const useClaimPhotosStore = create<ClaimPhotos>((set) => ({
  photos: [],
  addPhoto: (photo) =>
    set((state) => {
      if (state.photos.length >= photoLimit) {
        return state;
      }

      return {
        photos: [
          ...state.photos,
          { ...photo, label: `Foto ${state.photos.length + 1}` },
        ],
      };
    }),
  removePhoto: (filePath) =>
    set((state) => ({
      photos: state.photos.filter((photo) => photo.filePath !== filePath),
    })),
  clear: () => set({ photos: [] }),
}));
