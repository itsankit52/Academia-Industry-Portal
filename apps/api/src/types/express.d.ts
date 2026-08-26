import type { Role } from '@aip/config';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
      requestId?: string;
    }
  }
}

export {};
