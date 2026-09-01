import type { InstitutionVerificationStatus } from '@aip/config';

export interface Institution {
  id: string;
  name: string;
  code: string;
  domain: string;
  address: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  verificationStatus: InstitutionVerificationStatus;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Publicly safe institution data — returned to unauthenticated clients.
 * Excludes: code, secret, verification details, contact info.
 */
export interface PublicInstitution {
  id: string;
  name: string;
}
