import type { Response } from 'express';
import { HTTP_STATUS } from '@aip/config';
import type { ApiSuccess } from '@aip/types';

export function ok<T>(res: Response, data: T, message?: string, statusCode = HTTP_STATUS.OK): Response {
  const body: ApiSuccess<T> = { success: true, data, ...(message ? { message } : {}) };
  return res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T, message?: string): Response {
  const body: ApiSuccess<T> = { success: true, data, ...(message ? { message } : {}) };
  return res.status(HTTP_STATUS.CREATED).json(body);
}

export function noContent(res: Response): Response {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
}
