export type ClaimPhoto = {
  label: string;
  filePath: string;
  bytes: number;
};

type NewPhoto = {
  filePath: string;
  bytes: number;
};

export type ClaimPhotos = {
  photos: ClaimPhoto[];
  addPhoto: (photo: NewPhoto) => void;
  removePhoto: (filePath: string) => void;
  clear: () => void;
};
