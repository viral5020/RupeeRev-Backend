import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import User from '../models/user';
import { sendError } from '../utils/apiResponse';
export interface AuthPayload {
  sub: string;
  roles: string[];
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return sendError(res, 'Authentication required', 401);
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.auth = { id: decoded.sub, roles: decoded.roles };
    const user = await User.findById(decoded.sub);
    if (!user) {
      return sendError(res, 'User not found', 401);
    }
    req.user = user;
    return next();
  } catch (error) {
    return sendError(res, 'Invalid token', 401);
  }
};

export const authorize =
  (roles: string[] = []) =>
    (req: Request, res: Response, next: NextFunction) => {
      if (roles.length === 0) {
        return next();
      }
      const userRoles = req.auth?.roles || [];
      const isAllowed = roles.some((role) => userRoles.includes(role));
      if (!isAllowed) {
        return sendError(res, 'Forbidden', 403);
      }
      return next();
    };

