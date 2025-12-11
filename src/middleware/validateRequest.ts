import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';

export const validateRequest =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    if (!result.success) {
      return sendError(res, 'Validation failed', 422, result.error.flatten());
    }
    const parsed = result.data as {
      body?: Record<string, unknown>;
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
    };
    if (parsed.body) req.body = parsed.body;
    if (parsed.params) req.params = parsed.params as typeof req.params;
    if (parsed.query) req.query = parsed.query as typeof req.query;
    return next();
  };

