import { Router } from 'express';
import { z } from 'zod';
import { register, login, refresh, logout, googleAuth, googleCallback, logoutGoogle, getMe } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { authLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

router.post('/register', authLimiter, validateRequest(registerSchema), register);
router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.post('/refresh', validateRequest(refreshSchema), refresh);
router.post('/logout', validateRequest(refreshSchema), logout);

// Google OAuth Routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/logout-google', logoutGoogle);
router.get('/me', authenticate, getMe);

export default router;

