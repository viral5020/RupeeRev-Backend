import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { loginUser, refreshTokens, registerUser, logoutUser, issueTokens } from '../services/authService';
import { sendSuccess, sendError } from '../utils/apiResponse';
import env from '../config/env';
import { IUserDocument } from '../models/user';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const result = await registerUser(name, email, password);
  return sendSuccess(res, result);
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await loginUser(email, password);
  return sendSuccess(res, result);
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await refreshTokens(refreshToken);
  return sendSuccess(res, result);
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await logoutUser(refreshToken);
  res.clearCookie('token');
  return sendSuccess(res, { ok: true });
};

// Google OAuth Controllers
export const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', { session: false }, async (err: Error, user: IUserDocument) => {
    if (err) {
      return res.redirect(`${env.frontendUrl}/login?error=auth_failed`);
    }
    if (!user) {
      return res.redirect(`${env.frontendUrl}/login?error=no_user`);
    }

    try {
      // Generate Tokens using authService to ensure consistency
      const { accessToken } = await issueTokens(user);

      // Set httpOnly cookie
      res.cookie('token', accessToken, {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Handle redirect parameter
      const redirectParam = req.query.redirect as string;
      let redirectUrl = `${env.frontendUrl}/dashboard`;

      // Validate redirect URL (must start with / or be empty)
      if (redirectParam && typeof redirectParam === 'string' && redirectParam.startsWith('/')) {
        redirectUrl = `${env.frontendUrl}${redirectParam}`;
      }

      // Redirect to dashboard or specified page
      return res.redirect(redirectUrl);
    } catch (error) {
      return res.redirect(`${env.frontendUrl}/login?error=token_generation_failed`);
    }
  })(req, res, next);
};

export const logoutGoogle = (req: Request, res: Response) => {
  res.clearCookie('token');
  return sendSuccess(res, { message: 'Logged out successfully' });
};

export const getMe = async (req: Request, res: Response) => {
  return sendSuccess(res, { user: req.user });
};

