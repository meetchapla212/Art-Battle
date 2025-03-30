import * as async from 'async';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import * as passport from 'passport';
import { default as User, UserDocument } from '../models/User';
import UserDTO, { AuthToken } from '../../../shared/UserDTO';
import { Request, Response, NextFunction } from 'express';
import { LocalStrategyInfo } from 'passport-local';
import { WriteError } from 'mongodb';
import { sanitize } from 'express-validator';
const request = require('express-validator');
const { check, validationResult } = require('express-validator');
import logger from '../config/logger';
import RegistrationModel from '../models/Registration';
import PreferenceModel from '../models/Preference';
import sendNotification from '../common/Apns';
import { MultiCast } from '../common/FCM';
/**
 * GET /login
 * Login page.
 */
export let getLogin = (req: Request, res: Response) => {
  if (req.user) {
    return res.redirect(`${process.env.ADMIN_URL}` + '/');
  }
  res.render('account/login', {
    title: 'Login'
  });
};

/**
 * POST /login
 * Sign in using email and password.
 */
export let postLogin = async(req: Request, res: Response, next: NextFunction) => {
  await check('email', 'Email is not valid').isEmail().run(req);
  await check('password', 'Password cannot be blank').not().isEmpty().run(req);
  await sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);

  const result = validationResult(req);
  const hasErrors = !result.isEmpty();
  if (hasErrors) {
    req.flash('errors', result.array());
    return res.redirect(`${process.env.ADMIN_URL}` + '/login');
  }

  passport.authenticate('local', (err: Error, user: UserDocument, info: LocalStrategyInfo) => {
    if (err) { return next(err); }
    if (!user) {
      req.flash('errors', info.message);
      return res.redirect(`${process.env.ADMIN_URL}` + '/login');
    }
    req.logIn(user, (err: Error) => {
      if (err) { return next(err); }
      req.flash('success', { msg: 'Success! You are logged in.' });
      res.redirect(req.session.returnTo || '/');
    });
  })(req, res, next);
};

/**
 * GET /logout
 * Log out.
 */
export let logout = (req: Request, res: Response) => {
  res.clearCookie('jwt');
  req.logout();
  res.redirect(`${process.env.ADMIN_URL}` + '/');
};

/**
 * GET /signup
 * Signup page.
 */
export let getSignup = (req: Request, res: Response) => {
  if (req.user) {
    return res.redirect(`${process.env.ADMIN_URL}`);
  }
  res.render('account/signup', {
    title: 'Create Account'
  });
};

/**
 * POST /signup
 * Create a new local account.
 */
export let postSignup = async(req: Request, res: Response, next: NextFunction) => {
  await check('email', 'Email is not valid').isEmail().run(req);
  await check('password', 'Password must be at least 4 characters long').isLength({ min: 4 }).run(req);
  await check('confirmPassword', 'Passwords do not match').isLength({ min: 4 }).equals(req.body.password).run(req);
  await sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);

  const result = validationResult(req);
  const hasErrors = !result.isEmpty();

  if (hasErrors) {
    req.flash('errors', result.array());
    return res.redirect('/signup');
  }

  const user = new User({
    email: req.body.email,
    password: req.body.password
  });

  User.findOne({ email: req.body.email }, (err, existingUser) => {
    if (err) { return next(err); }
    if (existingUser) {
      req.flash('errors', { msg: 'Account with that email address already exists.' });
      return res.redirect('/signup');
    }
    user.save((err: Error) => {
      if (err) { return next(err); }
      req.logIn(user, (err: Error) => {
        if (err) {
          return next(err);
        }
        res.redirect(`${process.env.ADMIN_URL}`);
      });
    });
  });
};

/**
 * GET /account
 * Profile page.
 */
export let getAccount = (req: Request, res: Response) => {
  if (!req.user) {
    res.clearCookie('jwt');
    req.logout();
    res.redirect(`${process.env.ADMIN_URL}`);
    return ;
  }
  res.render('account/profile', {
    title: 'Account Management'
  });
};

/**
 * POST /account/profile
 * Update profile information.
 */
export let postUpdateProfile = async (req: Request, res: Response, next: NextFunction) => {
  await check('email', 'Please enter a valid email address.').isEmail().run(req);
  await sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);

  const errors = validationResult();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, (err: any, user: UserDocument) => {
    if (err) { return next(err); }
    user.email = req.body.email || '';
    user.profile.name = req.body.name || '';
    user.profile.gender = req.body.gender || '';
    user.profile.location = req.body.location || '';
    user.profile.website = req.body.website || '';
    user.save((err: WriteError) => {
      if (err) {
        if (err.code === 11000) {
          req.flash('errors', { msg: 'The email address you have entered is already associated with an account.' });
          return res.redirect('/account');
        }
        return next(err);
      }
      req.flash('success', { msg: 'Profile information has been updated.' });
      res.redirect('/account');
    });
  });
};

/**
 * POST /account/password
 * Update current password.
 */
export let postUpdatePassword = async(req: Request, res: Response, next: NextFunction) => {
  await check('password', 'Password must be at least 4 characters long').isLength({ min: 4 }).run(req);
  await check('confirmPassword', 'Passwords do not match').isLength({ min: 4 }).equals(req.body.password).run(req);

  const errors = validationResult(req);

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, (err: any, user: UserDocument) => {
    if (err) { return next(err); }
    user.password = req.body.password;
    user.save((err: WriteError) => {
      if (err) { return next(err); }
      req.flash('success', { msg: 'Password has been changed.' });
      res.redirect('/account');
    });
  });
};

/**
 * POST /account/delete
 * Delete user account.
 */
export let postDeleteAccount = (req: Request, res: Response, next: NextFunction) => {
  User.remove({ _id: req.user.id }, (err) => {
    if (err) { return next(err); }
    req.logout();
    req.flash('info', { msg: 'Your account has been deleted.' });
    res.redirect(`${process.env.ADMIN_URL}`);
  });
};

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
export let getOauthUnlink = (req: Request, res: Response, next: NextFunction) => {
  const provider = req.params.provider;
  User.findById(req.user.id, (err: any, user: any) => {
    if (err) { return next(err); }
    user[provider] = undefined;
    user.tokens = user.tokens.filter((token: AuthToken) => token.kind !== provider);
    user.save((err: WriteError) => {
      if (err) { return next(err); }
      req.flash('info', { msg: `${provider} account has been unlinked.` });
      res.redirect('/account');
    });
  });
};

/**
 * GET /reset/:token
 * Reset Password page.
 */
export let getReset = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return res.redirect(`${process.env.ADMIN_URL}`);
  }
  User
    .findOne({ passwordResetToken: req.params.token })
    .where('passwordResetExpires').gt(Date.now())
    .exec((err: Error, user: UserDTO) => {
      if (err) { return next(err); }
      if (!user) {
        req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
        return res.redirect('/forgot');
      }
      res.render('account/reset', {
        title: 'Password Reset'
      });
    });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
export let postReset = async(req: Request, res: Response, next: NextFunction) => {
  await check('password', 'Password must be at least 4 characters long').isLength({ min: 4 }).run(req);
  await check('confirm', 'Passwords do not match').isLength({ min: 4 }).equals(req.body.password).run(req);

  const errors = validationResult(req);

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function resetPassword(done: Function) {
      User
        .findOne({ passwordResetToken: req.params.token })
        .where('passwordResetExpires').gt(Date.now())
        .exec((err: any, user: any) => {
          if (err) { return next(err); }
          if (!user) {
            req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
            return res.redirect('back');
          }
          user.password = req.body.password;
          user.passwordResetToken = undefined;
          user.passwordResetExpires = undefined;
          user.save((err: WriteError) => {
            if (err) { return next(err); }
            req.logIn(user, (err: any) => {
              done(err, user);
            });
          });
        });
    },
    function sendResetPasswordEmail(user: UserDocument, done: Function) {
      const transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USER,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
      const mailOptions = {
        to: user.email,
        from: 'express-ts@starter.com',
        subject: 'Your password has been changed',
        text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`
      };
      transporter.sendMail(mailOptions, (err: any) => {
        req.flash('success', { msg: 'Success! Your password has been changed.' });
        done(err);
      });
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect(`${process.env.ADMIN_URL}`);
  });
};

/**
 * GET /forgot
 * Forgot Password page.
 */
export let getForgot = (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    return res.redirect(`${process.env.ADMIN_URL}`);
  }
  res.render('account/forgot', {
    title: 'Forgot Password'
  });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
export let postForgot = async(req: Request, res: Response, next: NextFunction) => {
  await check('email', 'Please enter a valid email address.').isEmail().run(req);
  await sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);

  const errors = validationResult(req);

  if (errors) {
    req.flash('errors', errors);
    return res.redirect(`${process.env.ADMIN_URL}` + '/forgot');
  }

  async.waterfall([
    function createRandomToken(done: Function) {
      crypto.randomBytes(16, (err, buf) => {
        const token = buf.toString('hex');
        done(err, token);
      });
    },
    function setRandomToken(token: AuthToken, done: Function) {
      User.findOne({ email: req.body.email }, (err, user: any) => {
        if (err) { return done(err); }
        if (!user) {
          req.flash('errors', { msg: 'Account with that email address does not exist.' });
          return res.redirect(`${process.env.ADMIN_URL}` + '/forgot');
        }
        user.passwordResetToken = token;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        user.save((err: WriteError) => {
          done(err, token, user);
        });
      });
    },
    function sendForgotPasswordEmail(token: AuthToken, user: UserDocument, done: Function) {
      const transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USER,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
      const mailOptions = {
        to: user.email,
        from: 'hackathon@starter.com',
        subject: 'Reset your password on Hackathon Starter',
        text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          http://${req.headers.host}/reset/${token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`
      };
      transporter.sendMail(mailOptions, (err) => {
        req.flash('info', { msg: `An e-mail has been sent to ${user.email} with further instructions.` });
        done(err);
      });
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect(`${process.env.ADMIN_URL}` + '/forgot');
  });
};

export const userInformation = async(req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await Promise.all([
        RegistrationModel.findById(req.params.id),
        PreferenceModel.find({})
    ]);
    const registration = results[0];
    const preferences = results[1];
    if (registration) {
      const userPreferences = [];
      for (let i = 0; i < preferences.length; i++) {
        if (registration.Preferences.indexOf(preferences[i]._id.toString()) > -1) {
           userPreferences.push({
             preference: preferences[i],
             enabled: true
           });
        } else {
          userPreferences.push({
            preference: preferences[i],
            enabled: false
          });
        }
      }
      res.render('user/profile', {
        title: 'User profile',
        phoneNumber: registration.PhoneNumber,
        nickName: registration.NickName,
        preferences: userPreferences,
        deviceTokens: registration.DeviceTokens || [],
        registrationId: registration._id
      });
    } else {
       next({
         status: 404,
         message: 'user not found'
       });
    }
  } catch (e) {
    next(e);
  }
};

export const sendNotificationToUser = async(req: Request, res: Response, next: NextFunction) => {
  try {
      const registration = await RegistrationModel.findById(req.params.id);
      if (!registration) {
          next({
              status: 404,
              message: 'user not found'
          });
          return ;
      }
      const badDeviceTokens = await sendNotification(registration.DeviceTokens, 'Artbattle test notification', 'Artbattle  test').catch(e => logger.info(`push notification failed`, e));
      const androidRes = await MultiCast({
        DeviceTokens: registration.AndroidDeviceTokens,
        link: 'https://app.artbattle.com/profile',
        title: 'WebView Test',
        message: 'Clicking on me would send you to a webview',
        priority: 'normal',
        analyticsLabel: 'WebView Test'
      });
      logger.info('test notification on android ' + JSON.stringify(androidRes, null, 1));
      req.flash('success', { msg: 'Success! notification sent.' });
      res.redirect(`${process.env.ADMIN_URL}` + `/user/info/${registration._id}`);
  } catch (e) {
    next(e);
  }
};