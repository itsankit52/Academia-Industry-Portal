import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { HTTP_STATUS } from '@aip/config';
import type { ApiError, ApiErrorDetail } from '@aip/types';
import { AppError } from '../utils/AppError';
import { describeValidationFailure } from '../utils/validationMessage';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface MongoDuplicateError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateError {
  return (
    err instanceof Error &&
    (err as { code?: number }).code === 11000 &&
    err.name === 'MongoServerError'
  );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status: number = HTTP_STATUS.INTERNAL;
  let code: string = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: ApiErrorDetail[] | undefined;

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = HTTP_STATUS.UNPROCESSABLE;
    code = 'VALIDATION_ERROR';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    message = describeValidationFailure(details);
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = HTTP_STATUS.UNPROCESSABLE;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    message = describeValidationFailure(details);
  } else if (err instanceof mongoose.Error.CastError) {
    status = HTTP_STATUS.BAD_REQUEST;
    code = 'INVALID_ID';
    message = `Invalid value for ${err.path}`;
  } else if (isDuplicateKeyError(err)) {
    status = HTTP_STATUS.CONFLICT;
    code = 'DUPLICATE';
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : undefined;
    message = field ? `Duplicate value for field: ${field}` : 'Duplicate value';
    if (field) details = [{ path: field, message: 'must be unique' }];
  } else if (err instanceof jwt.TokenExpiredError) {
    status = HTTP_STATUS.UNAUTHORIZED;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = HTTP_STATUS.UNAUTHORIZED;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  } else if (err instanceof multer.MulterError) {
    status = HTTP_STATUS.BAD_REQUEST;
    code = 'UPLOAD_ERROR';
    message = err.message;
    if (err.field) details = [{ path: err.field, message: err.code }];
  }

  // `err` goes through the logger's serializer, which keeps only codes and field
  // names for database/validation errors. The path drops the query string and
  // the log message is the error code, not the client-facing message (which
  // can quote input, e.g. validation details). `requestId` matches pino-http's
  // request line for correlation.
  const logPayload = {
    err,
    requestId: (req as { id?: unknown }).id,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    status,
    code,
  };
  if (status >= 500) logger.error(logPayload, `Request failed: ${code}`);
  else logger.warn(logPayload, `Request rejected: ${code}`);

  const body: ApiError = {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };

  if (status >= 500 && env.NODE_ENV !== 'production') {
    (body.error as unknown as { stack?: string }).stack = (err as Error)?.stack;
  }

  res.status(status).json(body);
};
