import type { ApiErrorDetail } from '@aip/types';

export class ApiClientError extends Error {
  code: string;
  details?: ApiErrorDetail[];
  status?: number;

  constructor(code: string, message: string, details?: ApiErrorDetail[], status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}
