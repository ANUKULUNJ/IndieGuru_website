import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Expert from '../models/Expert.js';
// Check for environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.JWT_SECRET) {
  console.error('Error: Google client ID, secret, and JWT secret must be provided.');
  process.exit(1);
}

const generateToken = (user) => {
  return jwt.sign({ id: user.id, userType: user.userType }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user.id, userType: user.userType }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

passport.use('google-user', new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BACKEND_URL}:${process.env.PORT}/api/v1/user/auth/google/callback`, // Use PORT from .env
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await User.findOne({ gid: profile.id, authType: 'gmail' });
    if (existingUser) {
      const token = generateToken(existingUser);
      const refreshToken = generateRefreshToken(existingUser);
      return done(null, { user: existingUser, token, refreshToken });
    }

    // Split the display name into firstName and lastName
    const [firstName, ...lastNameParts] = profile.displayName.split(" ");
    const lastName = lastNameParts.join(" ");

    const newUser = new User({
      firstName,
      lastName,
      email: profile.emails[0].value,
      gid: profile.id,
      authType: 'gmail',
      emailVerified: true,
    });

    await newUser.save();
    const token = generateToken(newUser);
    const refreshToken = generateRefreshToken(newUser);
    done(null, { user: newUser, token, refreshToken });
  } catch (error) {
    console.error('Error during Google user authentication:', error);
    done(error, false);
  }
}));

passport.use('google-expert', new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BACKEND_URL}:${process.env.PORT}/api/v1/expert/auth/google/callback`, // Use PORT from .env
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await Expert.findOne({ gid: profile.id, userType: 'expert' });
    if (existingUser) {
      const token = generateToken(existingUser);
      const refreshToken = generateRefreshToken(existingUser);
      return done(null, { user: existingUser, token, refreshToken });
    }

    // Split the display name into firstName and lastName
    const [firstName, ...lastNameParts] = profile.displayName.split(" ");
    const lastName = lastNameParts.join(" ");

    const newUser = new Expert({
      firstName,
      lastName,
      email: profile.emails[0].value,
      gid: profile.id,
      authType: 'gmail',
      emailVerified: true,
      userType: 'expert',
    });

    await newUser.save();
    const token = generateToken(newUser);
    const refreshToken = generateRefreshToken(newUser);
    done(null, { user: newUser, token, refreshToken });
  } catch (error) {
    console.error('Error during Google expert authentication:', error);
    done(error, false);
  }
}));

passport.serializeUser((user, done) => {
  done(null, { id: user._id, userType: user.userType }); // Include userType in the serialized data
});

passport.deserializeUser(async (data, done) => {
  try {
    const { id, userType } = data;
    const model = userType === 'expert' ? Expert : User; // Determine the model based on userType
    const user = await model.findById(id);
    done(null, user);
  } catch (error) {
    console.error('Error during deserialization:', error);
    done(error, false);
  }
});

