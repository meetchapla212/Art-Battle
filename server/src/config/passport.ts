import * as passport from 'passport';
import * as passportLocal from 'passport-local';
import * as passportFacebook from 'passport-facebook';
import * as _ from 'lodash';
import * as passportAnonymous from 'passport-anonymous';


import { default as User } from '../models/User';
import { Request, Response, NextFunction } from 'express';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import RegistrationModel from '../models/Registration';
import RegistrationDTO from '../../../shared/RegistrationDTO';
import { JsonWebTokenError } from 'jsonwebtoken';
import { default as EventModel } from '../models/Event';
import fromExtractors = ExtractJwt.fromExtractors;
import logger from './logger';
const LocalStrategy = passportLocal.Strategy;
const FacebookStrategy = passportFacebook.Strategy;

passport.serializeUser<any, any>((user, done) => {
  if (user && user.IsEventAdmin) {
    done(undefined, `reg_id${user.id}`);
  } else {
    done(undefined, `user_id${user.id}`);
  }
});

passport.deserializeUser((id: string, done) => {
  if (id.indexOf('user') > -1) {
    User.findById(id.replace('user_id', ''), (err, user) => {
      done(err, user);
    });
  } else {
    RegistrationModel.findById(id.replace('reg_id', ''), (err, user) => {
      done(err, user);
    });
  }
});

/**
 * Sign in using JWT
 * @param req
 */
const cookieExtractor = function(req: Request) {
  let token = null;
  if (req && req.signedCookies) {
    token = req.signedCookies['jwt'];
  }
  return token;
};
const opts = {
  jwtFromRequest: fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
  secretOrKey: process.env.JWT_SECRET,
  // issuer: 'vote.artbattle.com',
  // audience: 'vote.artbattle.com'
};
passport.use(new JwtStrategy(opts, function(jwtPayload, done) {
  // logger.info('jwt_payload.sub', jwtPayload);
  RegistrationModel.findById(jwtPayload.registrationId, function(err, user) {
    if (err) {
      return done(err, false);
    }
    if (user) {
      interface Profile extends RegistrationDTO {
        profile?: {
          name: string;
          email: string;
          picture: string;
        };
      }

      const profile: Profile = user;
      profile.profile = {
        name: user.NickName || user.PhoneNumber,
        email: user.Email,
        picture: 'https://gravatar.com/avatar/9c822c080f177fca313624127446a9b7?s=200&d=retro'
      };
      return done(null, user);
    } else {
      return done(null, false);
      // or you could create a new account
    }
  });
}));

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  User.findOne({ email: email.toLowerCase() }, (err, user: any) => {
    if (err) { return done(err); }
    if (!user) {
      return done(undefined, false, { message: `Email ${email} not found.` });
    }
    user.comparePassword(password, (err: Error, isMatch: boolean) => {
      if (err) { return done(err); }
      if (isMatch) {
        return done(undefined, user);
      }
      return done(undefined, false, { message: 'Invalid email or password.' });
    });
  });
}));


/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */


/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_ID,
  clientSecret: process.env.FACEBOOK_SECRET,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['name', 'email', 'link', 'locale', 'timezone'],
  passReqToCallback: true
}, (req: any, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    User.findOne({ facebook: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, (err, user: any) => {
          if (err) { return done(err); }
          user.facebook = profile.id;
          user.tokens.push({ kind: 'facebook', accessToken });
          user.profile.name = user.profile.name || `${profile.name.givenName} ${profile.name.familyName}`;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || `https://graph.facebook.com/${profile.id}/picture?type=large`;
          user.save((err: Error) => {
            req.flash('info', { msg: 'Facebook account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ facebook: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        return done(undefined, existingUser);
      }
      User.findOne({ email: profile._json.email }, (err, existingEmailUser) => {
        if (err) { return done(err); }
        if (existingEmailUser) {
          req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.' });
          done(err);
        } else {
          const user: any = new User();
          user.email = profile._json.email;
          user.facebook = profile.id;
          user.tokens.push({ kind: 'facebook', accessToken });
          user.profile.name = `${profile.name.givenName} ${profile.name.familyName}`;
          user.profile.gender = profile._json.gender;
          user.profile.picture = `https://graph.facebook.com/${profile.id}/picture?type=large`;
          user.profile.location = (profile._json.location) ? profile._json.location.name : '';
          user.save((err: Error) => {
            done(err, user);
          });
        }
      });
    });
  }
}));

passport.use(new passportAnonymous.Strategy());

/**
 * Login Required middleware.
 */
export let isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  } else if (req.signedCookies && req.signedCookies.jwt && req.signedCookies.jwt.length > 0) {
    isJwtAuthorizedOptional(req, res, next);
  } else {
    res.redirect(process.env.MP + '/login');
  }
};

/**
 * Authorization Required middleware.
 */
export let isAuthorized = (req: Request, res: Response, next: NextFunction) => {
  const provider = req.path.split('/').slice(-1)[0];

  if (_.find(req.user.tokens, { kind: provider })) {
    next();
  } else {
    res.redirect(`/auth/${provider}`);
  }
};

export const isJwtAuthorized = (req: Request, res: Response, next: NextFunction) => {
  const { headers: { cookie } } = req;
  if (cookie) {
    const values = cookie.split(';').reduce((res, item) => {
      const data = item.trim().split('=');
      return { ...res, [data[0]]: data[1] };
    }, {});
    console.log('cookies print', values);
  } else {
    console.log('no cookie');
  }
  passport.authenticate('jwt', { session: true }, function(err: Error, user: RegistrationDTO, info: JsonWebTokenError) {
    // If authentication failed, `user` will be set to false. If an exception occurred, `err` will be set.
    _processAuth(err, user, info, req, res, next);
  })(req, res, next);
};

export const isJwtAuthorizedOptional = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(['jwt', 'anonymous'], { session: true }, function(err: Error, user: RegistrationDTO, info: JsonWebTokenError) {
    // If authentication failed, `user` will be set to false. If an exception occurred, `err` will be set.
    _processAuth(err, user, info, req, res, next);
  })(req, res, next);
};

function _processAuth(err: Error, user: RegistrationDTO, info: JsonWebTokenError, req: Request, res: Response, next: NextFunction) {
  if (err || !user || _.isEmpty(user)) {
    // PASS THE ERROR OBJECT TO THE NEXT ROUTE i.e THE APP'S COMMON ERROR HANDLING MIDDLEWARE
    logger.info(`info.message', ${info && info.message}, 'info.name', ${info && info.name}`);
    return next({
      Success: false,
      status: 403,
      message: 'INVALID_TOKEN'
    });
  } else {
    req.logIn(user, (err: Error) => {
      if (err) {
        return next(err);
      } else {
        const eventIds: string[] = [];
        const eventPromise = EventModel.find({
          $and: [
            {
              'RegistrationsVoteFactor.Status': 'Admin', // at least have one admin
              'Enabled': true
            }
          ]
        }).select(['_id', 'RegistrationsVoteFactor']).sort({_id: -1});
        eventPromise.then( (events) => {
          for (let i = 0; i < events.length; i++) {
            const event = events[i];
            for (let j = 0; j < event.RegistrationsVoteFactor.length; j++) {
              const voteFactor = event.RegistrationsVoteFactor[j];
              if (voteFactor.RegistrationId.toString() === user._id.toString() && voteFactor.Status === 'Admin') {
                eventIds.push(events[i]._id);
                break;
              }
            }
          }
          // logger.info(`allowed admin of eventIds ${JSON.stringify(eventIds)} to ${JSON.stringify(req.user)}`);
          req.user = user;
          req.user.IsGuestUser = true;
          if (eventIds.length > 0) {
            req.user.IsEventAdmin = true;
            req.user.eventIds = eventIds;
          } else {
            req.user.IsEventAdmin = false;
            req.user.eventIds = [];
          }
          return next();
        }).catch(e => {
          logger.error(`${e.message} ${e.stack}`);
          next(e);
        });
      }
    });
  }
}

