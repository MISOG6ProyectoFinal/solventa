import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { photoLimit } from '../constants';
import { formatClock } from '../utils';
import { ClaimPhoto, ClaimPhotos, ClaimVideo } from './types';

export const useClaimsStore = create<ClaimPhotos>()(
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
          capturedAt: photo.capturedAt ?? formatClock(new Date()),
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
          capturedAt: video.capturedAt ?? formatClock(new Date()),
        });
      }),
    replaceEvidence: (files) =>
      set((state) => {
        const nextPhotos: ClaimPhoto[] = [];
        const nextVideos: ClaimVideo[] = [];
        for (const file of files) {
          if (nextPhotos.length + nextVideos.length >= photoLimit) {
            break;
          }
          const capturedAt = file.capturedAt ?? formatClock(new Date());
          if (file.kind === 'photo') {
            nextPhotos.push({
              filePath: file.filePath,
              bytes: file.bytes,
              capturedAt,
              label: `Foto ${nextPhotos.length + 1}`,
            });
          } else {
            nextVideos.push({
              filePath: file.filePath,
              bytes: file.bytes,
              capturedAt,
              label: `Video ${nextVideos.length + 1}`,
            });
          }
        }
        state.photos = nextPhotos;
        state.videos = nextVideos;
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
