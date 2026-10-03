import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { photoLimit } from '../constants';
import { ClaimPhotos } from './types';

export const useClaimPhotosStore = create<ClaimPhotos>()(
  immer((set) => ({
    photos: [],
    videos: [],
    addPhoto: (photo) =>
      set((state) => {
        if (state.photos.length + state.videos.length >= photoLimit) {
          return;
        }

        state.photos.push({
          ...photo,
          label: `Foto ${state.photos.length + 1}`,
        });
      }),
    addVideo: (video) =>
      set((state) => {
        if (state.photos.length + state.videos.length >= photoLimit) {
          return;
        }

        state.videos.push({
          ...video,
          label: `Video ${state.videos.length + 1}`,
        });
      }),
    removePhoto: (filePath) =>
      set((state) => {
        state.photos = state.photos.filter((photo) => photo.filePath !== filePath);
      }),
    removeVideo: (filePath) =>
      set((state) => {
        state.videos = state.videos.filter((video) => video.filePath !== filePath);
      }),
    clear: () =>
      set((state) => {
        state.photos = [];
        state.videos = [];
      }),
  })),
);
