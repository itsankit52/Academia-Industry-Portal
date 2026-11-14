import { HTTP_STATUS } from '@aip/config';
import type { ApiErrorDetail } from '@aip/types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];
  public readonly isOperational = true;

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, details?: ApiErrorDetail[]): AppError {
    return new AppError(HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', message);
  }

  static conflict(message: string): AppError {
    return new AppError(HTTP_STATUS.CONFLICT, 'CONFLICT', message);
  }

  static unsupportedMediaType(message: string): AppError {
    return new AppError(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_MEDIA_TYPE', message);
  }

  static unprocessable(message: string, details?: ApiErrorDetail[]): AppError {
    return new AppError(HTTP_STATUS.UNPROCESSABLE, 'VALIDATION_ERROR', message, details);
  }

  static tooMany(message = 'Too many requests'): AppError {
    return new AppError(HTTP_STATUS.TOO_MANY, 'TOO_MANY_REQUESTS', message);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(HTTP_STATUS.INTERNAL, 'INTERNAL_ERROR', message);
  }

  static serviceUnavailable(message: string): AppError {
    return new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', message);
  }
}
