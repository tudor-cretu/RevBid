const passport      = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User          = require('../models/User');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  '/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Cauta userul dupa googleId
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      // User existent — updateaza avatar
      user.avatar = profile.photos?.[0]?.value || null;
      await user.save();
      return done(null, user);
    }

    // Cauta dupa email (daca are cont cu email deja)
    user = await User.findOne({ email: profile.emails?.[0]?.value });
    if (user) {
      // Leaga contul Google de contul existent
      user.googleId  = profile.id;
      user.isVerified = true;
      user.avatar    = profile.photos?.[0]?.value || null;
      await user.save();
      return done(null, user);
    }

    // Creeaza cont nou
    user = await User.create({
      googleId:   profile.id,
      firstName:  profile.name?.givenName  || 'User',
      lastName:   profile.name?.familyName || '',
      email:      profile.emails?.[0]?.value,
      isVerified: true, // Google verifica emailul
      avatar:     profile.photos?.[0]?.value || null,
    });

    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;