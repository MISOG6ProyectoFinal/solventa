export type ClaimPhoto = {
  label: string;
  filePath: string;
  bytes: number;
  capturedAt: string;
};

type NewPhoto = {
  filePath: string;
  bytes: number;
  capturedAt?: string;
};

export type ClaimVideo = {
  label: string;
  filePath: string;
  bytes: number;
  capturedAt: string;
};

type NewVideo = {
  filePath: string;
  bytes: number;
  capturedAt?: string;
};

export type ClaimPhotos = {
  photos: ClaimPhoto[];
  videos: ClaimVideo[];
  addPhoto: (photo: NewPhoto) => void;
  addVideo: (video: NewVideo) => void;
  removePhoto: (filePath: string) => void;
  removeVideo: (filePath: string) => void;
  clear: () => void;
};
