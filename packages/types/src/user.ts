import type { Role } from '@aip/config';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  authProvider?: string;
  googleAvatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuthTokens {
  accessToken: string;
}
