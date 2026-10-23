export type ClaimPhoto = {
  position: number;
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
  position: number;
  filePath: string;
  bytes: number;
  capturedAt: string;
};

type NewVideo = {
  filePath: string;
  bytes: number;
  capturedAt?: string;
};

export type EvidenceFile = {
  kind: 'photo' | 'video';
  filePath: string;
  bytes: number;
  capturedAt?: string;
};

export type ClaimPhotos = {
  photos: ClaimPhoto[];
  videos: ClaimVideo[];
  addPhoto: (photo: NewPhoto) => void;
  addVideo: (video: NewVideo) => void;
  replaceEvidence: (files: EvidenceFile[]) => void;
  removePhoto: (filePath: string) => void;
  removeVideo: (filePath: string) => void;
  clear: () => void;
};
