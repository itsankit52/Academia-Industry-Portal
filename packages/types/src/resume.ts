export type ResumeStorageMode = 'DATABASE' | 'CLOUDINARY';

export interface Resume {
  id: string;
  studentId: string;
  storageMode: ResumeStorageMode;
  filename?: string;
  cloudinaryPublicId?: string;
  url?: string;
  mimeType: string;
  sizeBytes: number;
  parsedSkills: string[];
  version: number;
  createdAt: string;
}
