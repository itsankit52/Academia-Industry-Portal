import type { DocumentType, VerificationStatus } from '@aip/config';

export interface Document {
  id: string;
  user: string;
  documentType: DocumentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  title?: string;
  issuer?: string;
  issuedDate?: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioStudent {
  fullName: string;
  institution?: { name: string; code: string };
  degree?: string;
  branch?: string;
  graduationYear?: number;
  bio?: string;
}

export interface PortfolioSkill {
  name: string;
  proficiency: string;
  category: string;
}

export interface PortfolioProject {
  title: string;
  description: string;
  link?: string;
}

export interface PortfolioCertification {
  title: string;
  issuer: string;
  verifiedAt?: string;
}

export interface PortfolioAchievement {
  title: string;
  description?: string;
  date?: string;
}

export interface PortfolioDocument {
  documentType: DocumentType;
  title?: string;
  issuer?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface PublicPortfolio {
  student: PortfolioStudent;
  skills: PortfolioSkill[];
  projects: PortfolioProject[];
  certifications: PortfolioCertification[];
  achievements: PortfolioAchievement[];
  verifiedDocuments: PortfolioDocument[];
}
