import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import User from '../models/user';
import RefreshToken from '../models/refreshToken';
import env from '../config/env';
import { IUserDocument } from '../models/user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const buildTokenPayload = (user: IUserDocument) => ({
  sub: user.id,
  roles: user.roles,
});

export const issueTokens = async (user: IUserDocument): Promise<AuthTokens> => {
  const payload = buildTokenPayload(user);
  const accessToken = jwt.sign(payload, env.jwtSecret as jwt.Secret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign(payload, env.refreshSecret as jwt.Secret, {
    expiresIn: env.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
  await RefreshToken.create({
    user: user.id,
    token: refreshToken,
    expiresAt: dayjs().add(7, 'day').toDate(),
  });
  return { accessToken, refreshToken };
};

export const registerUser = async (name: string, email: string, password: string) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('Email already registered');
  }
  const user = await User.create({ name, email, password });
  const tokens = await issueTokens(user);
  return { user, tokens };
};

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid credentials');
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }
  const tokens = await issueTokens(user);
  return { user, tokens };
};

export const refreshTokens = async (token: string) => {
  const stored = await RefreshToken.findOne({ token });
  if (!stored) {
    throw new Error('Invalid refresh token');
  }
  try {
    const decoded = jwt.verify(token, env.refreshSecret as jwt.Secret) as jwt.JwtPayload;
    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new Error('User no longer exists');
    }
    await stored.deleteOne();
    const tokens = await issueTokens(user);
    return { user, tokens };
  } catch (error) {
    await stored.deleteOne();
    throw new Error('Invalid refresh token');
  }
};

export const logoutUser = async (token: string) => {
  await RefreshToken.deleteOne({ token });
  return true;
};

