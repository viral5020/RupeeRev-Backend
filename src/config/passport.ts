import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/user';
import env from './env';

passport.use(
    new GoogleStrategy(
        {
            clientID: env.googleClientId,
            clientSecret: env.googleClientSecret,
            callbackURL: env.googleCallbackUrl,
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                // Check if user already exists
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // Check if user exists with same email
                const email = profile.emails?.[0]?.value;
                if (email) {
                    user = await User.findOne({ email });
                    if (user) {
                        // Link google account to existing user
                        user.googleId = profile.id;
                        user.provider = 'google';
                        if (!user.avatar) {
                            user.avatar = profile.photos?.[0]?.value;
                        }
                        await user.save();
                        return done(null, user);
                    }
                }

                // Create new user
                user = await User.create({
                    name: profile.displayName,
                    email: email,
                    googleId: profile.id,
                    provider: 'google',
                    avatar: profile.photos?.[0]?.value,
                    password: '', // No password for google users
                });

                return done(null, user);
            } catch (error) {
                return done(error as Error, undefined);
            }
        }
    )
);

export default passport;
