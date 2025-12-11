import { Response } from 'express';

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  message: string;
  errors?: string[] | Record<string, unknown>;
};

export const sendSuccess = <T>(res: Response, data: T, message?: string, status = 200) => {
  const payload: ApiSuccess<T> = {
    success: true,
    data,
    message,
  };
  return res.status(status).json(payload);
};

export const sendError = (res: Response, message: string, status = 400, errors?: ApiError['errors']) => {
  const payload: ApiError = {
    success: false,
    message,
    errors,
  };
  return res.status(status).json(payload);
};

