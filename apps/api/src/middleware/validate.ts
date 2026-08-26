import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';
import { describeValidationFailure } from '../utils/validationMessage';

type Target = 'body' | 'params' | 'query';

export function validate<T>(schema: ZodSchema<T>, target: Target = 'body'): RequestHandler {
  return (req, _res, next) => {
    const source = req[target];
    const result = schema.safeParse(source);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(
        AppError.unprocessable(
          describeValidationFailure(details, target === 'body' ? undefined : target),
          details,
        ),
      );
    }
    (req as unknown as Record<Target, unknown>)[target] = result.data;
    next();
  };
}
