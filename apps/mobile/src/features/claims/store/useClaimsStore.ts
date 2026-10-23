import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { photoLimit } from '../constants';
import { texts } from '../texts';
import { formatClock } from '../utils';
import { ClaimPhoto, ClaimPhotos, ClaimVideo } from './types';

function photoOf(photo: Omit<ClaimPhoto, 'label' | 'capturedAt'> & { capturedAt?: string }, position: number) {
  return {
    ...photo,
    label: texts.report.photoLabel(position),
    capturedAt: photo.capturedAt ?? formatClock(new Date()),
  };
}

function videoOf(video: Omit<ClaimVideo, 'label' | 'capturedAt'> & { capturedAt?: string }, position: number) {
  return {
    ...video,
    label: texts.report.videoLabel(position),
    capturedAt: video.capturedAt ?? formatClock(new Date()),
  };
}

export const useClaimsStore = create<ClaimPhotos>()(
  immer((set) => {
    const isFull = (state: Pick<ClaimPhotos, 'photos' | 'videos'>) =>
      state.photos.length + state.videos.length >= photoLimit;

    return {
      photos: [],
      videos: [],
      addPhoto: (photo) =>
        set((state) => {
          if (!isFull(state)) {
            state.photos.push(photoOf(photo, state.photos.length + 1));
          }
        }),
      addVideo: (video) =>
        set((state) => {
          if (!isFull(state)) {
            state.videos.push(videoOf(video, state.videos.length + 1));
          }
        }),
      replaceEvidence: (files) =>
        set((state) => {
          const next: Pick<ClaimPhotos, 'photos' | 'videos'> = { photos: [], videos: [] };
          for (const { kind, ...file } of files) {
            if (isFull(next)) {
              break;
            }
            if (kind === 'photo') {
              next.photos.push(photoOf(file, next.photos.length + 1));
            } else {
              next.videos.push(videoOf(file, next.videos.length + 1));
            }
          }
          state.photos = next.photos;
          state.videos = next.videos;
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
    };
  }),
);
