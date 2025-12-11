import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/apiResponse';
import logger from '../utils/logger';

export const notFound = (req: Request, res: Response) => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  if (err instanceof ZodError) {
    return sendError(res, 'Validation error', 422, err.flatten());
  }
  if (err.message === 'Invalid credentials') {
    return sendError(res, err.message, 401);
  }
  if (err.message === 'Email already registered') {
    return sendError(res, err.message, 409);
  }
  return sendError(res, err.message || 'Server error', 500);
};

